import { chromium } from 'playwright';
import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'http://localhost:5173';
const OUTPUT_DIR = join(process.cwd(), 'playstore-final');
const LOGO_PATH = join(process.cwd(), 'public', 'logo-black.png');

const PHONE_W = 390;
const PHONE_H = 844;
const SCALE = 2; // 2x for crisp output → final image = 780 x variable

const SCREENS = [
  {
    id: 1, path: '/', name: 'home',
    bannerTitle: 'Shop by Category',
    bannerSubtitle: 'Retail & Wholesale Groceries',
    promoText: 'Browse fresh produce, dairy, and daily essentials at the best prices in Lahore'
  },
  {
    id: 2, path: '/products', name: 'products',
    bannerTitle: 'Fresh & Quality',
    bannerSubtitle: 'Daily Fresh from Local Farms',
    promoText: 'Premium quality groceries with competitive wholesale rates'
  },
  {
    id: 3, path: '/direct-order', name: 'direct-order',
    bannerTitle: 'Voice Order',
    bannerSubtitle: 'Just Say What You Need!',
    promoText: 'Quick ordering without browsing — send a voice note or describe your needs'
  },
  {
    id: 4, path: '/cart', name: 'cart',
    bannerTitle: 'Smart Cart',
    bannerSubtitle: 'Review & Checkout in Seconds',
    promoText: 'Free delivery on orders above Rs. 500 — track your savings'
  },
  {
    id: 5, path: '/checkout', name: 'checkout',
    bannerTitle: 'Secure Checkout',
    bannerSubtitle: 'Multiple Payment Options',
    promoText: 'Cash on Delivery or JazzCash — choose what works for you'
  },
  {
    id: 6, path: '/my-orders', name: 'orders',
    bannerTitle: 'Track Your Order',
    bannerSubtitle: 'Real-time Status Updates',
    promoText: 'Know exactly when your groceries will arrive'
  }
];

function fileToBase64(filePath) {
  return `data:image/png;base64,${readFileSync(filePath).toString('base64')}`;
}

/**
 * Scroll the page in steps and take screenshots at each position,
 * then stitch them together into one tall image.
 */
async function captureFullPage(page) {
  // Get total scroll height
  const totalHeight = await page.evaluate(() => document.body.scrollHeight);
  const viewportHeight = PHONE_H;
  
  // If page fits in viewport, just take one screenshot
  if (totalHeight <= viewportHeight + 20) {
    return [await page.screenshot({ type: 'png' })];
  }
  
  // Otherwise scroll and capture in chunks
  const screenshots = [];
  let currentScroll = 0;
  
  while (currentScroll < totalHeight) {
    await page.evaluate((y) => window.scrollTo(0, y), currentScroll);
    await page.waitForTimeout(400); // wait for render
    
    const buf = await page.screenshot({ type: 'png' });
    screenshots.push(buf);
    
    currentScroll += viewportHeight - 50; // overlap 50px to avoid gaps
  }
  
  return screenshots;
}

async function run() {
  console.log('🏪 Hashmi Mart — Full-Page Screenshot Generator\n');
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  // ─── STEP 1: Take full-page screenshots ────────────────────────────
  console.log('📸 Step 1: Taking full-page mobile screenshots...\n');

  const mobileCtx = await browser.newContext({
    viewport: { width: PHONE_W, height: PHONE_H },
    deviceScaleFactor: SCALE,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  const mobilePage = await mobileCtx.newPage();

  const rawScreenshots = [];

  for (const screen of SCREENS) {
    const url = `${BASE_URL}${screen.path}`;
    console.log(`  📱 [${screen.id}/6] ${screen.bannerTitle}`);

    try {
      await mobilePage.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      await mobilePage.waitForTimeout(2500);

      // Dismiss overlays
      try { await mobilePage.click('button:has-text("Got it")', { timeout: 800 }); } catch {}
      try { await mobilePage.click('[aria-label="Close"]', { timeout: 500 }); } catch {}
      await mobilePage.waitForTimeout(500);

      // Get full page height
      const fullHeight = await mobilePage.evaluate(() => document.body.scrollHeight);
      console.log(`     Page height: ${fullHeight}px`);

      // Take full-page screenshot
      const rawPath = join(OUTPUT_DIR, `raw-${screen.id}.png`);
      await mobilePage.screenshot({ 
        path: rawPath, 
        fullPage: true  // This captures the ENTIRE scrollable page
      });

      const base64 = fileToBase64(rawPath);
      rawScreenshots.push({ ...screen, base64, fullHeight });
      console.log(`     ✅ Captured (full page)`);

      unlinkSync(rawPath);
    } catch (err) {
      console.log(`     ⚠️  Skipped: ${err.message}`);
    }
  }
  await mobileCtx.close();

  // ─── STEP 2: Create final screenshots with banner + promo ──────────
  console.log('\n🎨 Step 2: Creating screenshots with banners...\n');

  const FINAL_W = 1080;

  for (const screen of rawScreenshots) {
    const finalPath = join(OUTPUT_DIR, `${String(screen.id).padStart(2, '0')}-${screen.name}.png`);

    // Calculate heights
    const bannerH = 200;
    const promoH = 160;
    // The raw screenshot was taken at PHONE_W x fullHeight with SCALE
    // So the raw image dimensions are PHONE_W*SCALE x fullHeight*SCALE
    // We want to display it at FINAL_W width, maintaining aspect ratio
    const rawImgW = PHONE_W * SCALE;
    const rawImgH = screen.fullHeight * SCALE;
    const displayH = Math.round((FINAL_W / rawImgW) * rawImgH);
    const totalH = bannerH + displayH + promoH;

    const ctx = await browser.newContext({ viewport: { width: FINAL_W, height: totalH } });
    const page = await ctx.newPage();

    const html = `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${FINAL_W}px;
    height: ${totalH}px;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', 'Segoe UI', Roboto, sans-serif;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: #fff;
  }
  .banner {
    flex-shrink: 0;
    height: ${bannerH}px;
    background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
    color: white;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 0 40px;
  }
  .banner h1 {
    font-size: 56px;
    font-weight: 800;
    letter-spacing: -1px;
    margin-bottom: 8px;
    text-shadow: 0 2px 8px rgba(0,0,0,0.12);
  }
  .banner p {
    font-size: 30px;
    font-weight: 500;
    opacity: 0.92;
  }
  .screenshot-area {
    flex: 1;
    overflow: hidden;
    background: #fff;
  }
  .screenshot-area img {
    width: 100%;
    height: auto;
    display: block;
  }
  .promo {
    flex-shrink: 0;
    height: ${promoH}px;
    background: rgba(15, 23, 42, 0.93);
    backdrop-filter: blur(8px);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 0 40px;
  }
  .promo p {
    font-size: 28px;
    font-weight: 500;
    line-height: 1.45;
    opacity: 0.92;
  }
</style>
</head>
<body>
  <div class="banner">
    <h1>${screen.bannerTitle}</h1>
    <p>${screen.bannerSubtitle}</p>
  </div>
  <div class="screenshot-area">
    <img src="${screen.base64}" alt="${screen.bannerTitle}">
  </div>
  <div class="promo">
    <p>${screen.promoText}</p>
  </div>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: finalPath, fullPage: false, clip: { x: 0, y: 0, width: FINAL_W, height: totalH } });
    await ctx.close();
    console.log(`  ✅ [${screen.id}/6] ${finalPath} (${FINAL_W}×${totalH})`);
  }

  // ─── STEP 3: App Logo 1024×1024 ───────────────────────────────────
  console.log('\n📱 Step 3: Creating App Logo (1024×1024)...');

  const logoBase64 = fileToBase64(LOGO_PATH);
  const logoCtx = await browser.newContext({ viewport: { width: 1024, height: 1024 } });
  const logoPage = await logoCtx.newPage();

  await logoPage.setContent(`<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1024px; height: 1024px;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #f0fdfa 0%, #ffffff 100%);
  }
  img { width: 600px; height: 600px; object-fit: contain; }
</style></head>
<body>
  <img src="${logoBase64}" alt="Hashmi Mart">
</body></html>`, { waitUntil: 'load' });
  await logoPage.waitForTimeout(300);
  await logoPage.screenshot({ path: join(OUTPUT_DIR, 'app-logo-1024x1024.png'), fullPage: false });
  await logoCtx.close();
  console.log(`  ✅ app-logo-1024x1024.png`);

  // ─── STEP 4: Splash Screen 1000×1500 ──────────────────────────────
  console.log('\n🚀 Step 4: Creating Splash Screen (1000×1500)...');

  const splashCtx = await browser.newContext({ viewport: { width: 1000, height: 1500 } });
  const splashPage = await splashCtx.newPage();

  await splashPage.setContent(`<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1000px; height: 1500px;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(180deg, #06b6d4 0%, #0891b2 50%, #0e7490 100%);
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif;
    overflow: hidden; position: relative;
  }
  .circle { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.08); }
  .c1 { width: 500px; height: 500px; top: -150px; right: -150px; }
  .c2 { width: 350px; height: 350px; bottom: -100px; left: -100px; }
  .c3 { width: 200px; height: 200px; bottom: 300px; right: 80px; }
  .content {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; padding: 100px; position: relative; z-index: 1;
  }
  .logo { width: 380px; height: 380px; object-fit: contain; filter: brightness(0) invert(1); margin-bottom: 60px; }
  .name { font-size: 110px; font-weight: 800; color: #fff; letter-spacing: -2px; margin-bottom: 24px; text-shadow: 0 4px 20px rgba(0,0,0,0.2); }
  .tagline { font-size: 44px; color: rgba(255,255,255,0.92); font-weight: 500; max-width: 700px; line-height: 1.4; }
</style></head>
<body>
  <div class="circle c1"></div>
  <div class="circle c2"></div>
  <div class="circle c3"></div>
  <div class="content">
    <img src="${logoBase64}" class="logo" alt="Logo">
    <div class="name">Hashmi Mart</div>
    <div class="tagline">Premium Fresh Groceries<br>Delivered Fast in Lahore</div>
  </div>
</body></html>`, { waitUntil: 'load' });
  await splashPage.waitForTimeout(300);
  await splashPage.screenshot({ path: join(OUTPUT_DIR, 'splash-screen-1000x1500.png'), fullPage: false });
  await splashCtx.close();
  console.log(`  ✅ splash-screen-1000x1500.png`);

  // ─── STEP 5: Push Notification Icon SVG ────────────────────────────
  console.log('\n🔔 Step 5: Creating Push Notification Icon (SVG)...');

  writeFileSync(join(OUTPUT_DIR, 'push-notification-icon.svg'), `<?xml version="1.0" encoding="UTF-8"?>
<svg width="192" height="192" viewBox="0 0 192 192" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="192" y2="192" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#06b6d4"/>
      <stop offset="100%" stop-color="#0891b2"/>
    </linearGradient>
  </defs>
  <rect width="192" height="192" rx="42" fill="url(#g)"/>
  <text x="96" y="128" font-family="Arial,Helvetica,sans-serif" font-size="96" font-weight="bold" fill="white" text-anchor="middle">H</text>
</svg>`);
  console.log(`  ✅ push-notification-icon.svg`);

  await browser.close();

  console.log('\n' + '═'.repeat(55));
  console.log('✨  ALL PLAY STORE ASSETS READY!');
  console.log('═'.repeat(55));
  console.log(`\n📁  ${OUTPUT_DIR}\n`);
  console.log('  📱  app-logo-1024x1024.png        (App Icon)');
  console.log('  🚀  splash-screen-1000x1500.png   (Feature Graphic)');
  console.log('  🔔  push-notification-icon.svg     (Notification Icon)');
  console.log('  📸  01-home.png                    (Full-page screenshot)');
  console.log('  📸  02-products.png                (Full-page screenshot)');
  console.log('  📸  03-direct-order.png            (Full-page screenshot)');
  console.log('  📸  04-cart.png                    (Full-page screenshot)');
  console.log('  📸  05-checkout.png                (Full-page screenshot)');
  console.log('  📸  06-orders.png                  (Full-page screenshot)');
  console.log('\n' + '═'.repeat(55));
}

run().catch(console.error);
