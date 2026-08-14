import { chromium } from 'playwright';
import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'http://localhost:5173';
const OUTPUT_DIR = join(process.cwd(), 'playstore-final');
const LOGO_PATH = join(process.cwd(), 'public', 'logo-black.png');

const PHONE_W = 1080;
const PHONE_H = 1920;

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
  const data = readFileSync(filePath);
  return `data:image/png;base64,${data.toString('base64')}`;
}

async function run() {
  console.log('🏪 Hashmi Mart — Play Store Asset Generator v2\n');
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  // ─── STEP 1: Take raw screenshots ──────────────────────────────────
  console.log('📸 Step 1: Taking raw mobile screenshots...\n');

  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
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

      // Try to dismiss overlays/modals
      try { await mobilePage.click('button:has-text("Got it")', { timeout: 800 }); } catch {}
      try { await mobilePage.click('[aria-label="Close"]', { timeout: 500 }); } catch {}
      try { await mobilePage.click('.spotlight-overlay', { timeout: 300 }); } catch {}
      await mobilePage.waitForTimeout(300);

      const rawPath = join(OUTPUT_DIR, `raw-${screen.id}.png`);
      await mobilePage.screenshot({ path: rawPath, fullPage: false });

      // Read as base64 immediately
      const base64 = fileToBase64(rawPath);
      rawScreenshots.push({ ...screen, base64 });
      console.log(`     ✅ Captured`);

      // Delete raw file
      unlinkSync(rawPath);
    } catch (err) {
      console.log(`     ⚠️  Skipped: ${err.message}`);
    }
  }
  await mobileCtx.close();

  // ─── STEP 2: Create final screenshots with banner + promo ──────────
  console.log('\n🎨 Step 2: Creating screenshots with banners...\n');

  for (const screen of rawScreenshots) {
    const finalPath = join(OUTPUT_DIR, `${String(screen.id).padStart(2, '0')}-${screen.name}.png`);

    const ctx = await browser.newContext({ viewport: { width: PHONE_W, height: PHONE_H } });
    const page = await ctx.newPage();

    const html = `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${PHONE_W}px;
    height: ${PHONE_H}px;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', 'Segoe UI', Roboto, sans-serif;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .banner {
    flex-shrink: 0;
    background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
    color: white;
    padding: 55px 50px 45px;
    text-align: center;
  }
  .banner h1 {
    font-size: 62px;
    font-weight: 800;
    letter-spacing: -1px;
    margin-bottom: 10px;
    text-shadow: 0 2px 8px rgba(0,0,0,0.12);
  }
  .banner p {
    font-size: 34px;
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
    height: 100%;
    object-fit: cover;
    object-position: top;
    display: block;
  }
  .promo {
    flex-shrink: 0;
    background: rgba(15, 23, 42, 0.93);
    backdrop-filter: blur(8px);
    color: white;
    padding: 40px 50px;
    text-align: center;
  }
  .promo p {
    font-size: 30px;
    font-weight: 500;
    line-height: 1.5;
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
    await page.screenshot({ path: finalPath, fullPage: false });
    await ctx.close();
    console.log(`  ✅ [${screen.id}/6] ${finalPath}`);
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
  const logoOut = join(OUTPUT_DIR, 'app-logo-1024x1024.png');
  await logoPage.screenshot({ path: logoOut, fullPage: false });
  await logoCtx.close();
  console.log(`  ✅ ${logoOut}`);

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
  const splashOut = join(OUTPUT_DIR, 'splash-screen-1000x1500.png');
  await splashPage.screenshot({ path: splashOut, fullPage: false });
  await splashCtx.close();
  console.log(`  ✅ ${splashOut}`);

  // ─── STEP 5: Push Notification Icon SVG ────────────────────────────
  console.log('\n🔔 Step 5: Creating Push Notification Icon (SVG)...');

  const svgIcon = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="192" height="192" viewBox="0 0 192 192" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="192" y2="192" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#06b6d4"/>
      <stop offset="100%" stop-color="#0891b2"/>
    </linearGradient>
  </defs>
  <rect width="192" height="192" rx="42" fill="url(#g)"/>
  <text x="96" y="128" font-family="Arial,Helvetica,sans-serif" font-size="96" font-weight="bold" fill="white" text-anchor="middle">H</text>
</svg>`;

  const svgOut = join(OUTPUT_DIR, 'push-notification-icon.svg');
  writeFileSync(svgOut, svgIcon);
  console.log(`  ✅ ${svgOut}`);

  await browser.close();

  // ─── SUMMARY ───────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(55));
  console.log('✨  ALL PLAY STORE ASSETS READY!');
  console.log('═'.repeat(55));
  console.log(`\n📁  ${OUTPUT_DIR}\n`);
  console.log('  📱  app-logo-1024x1024.png        (App Icon)');
  console.log('  🚀  splash-screen-1000x1500.png   (Feature Graphic)');
  console.log('  🔔  push-notification-icon.svg     (Notification Icon)');
  console.log('  📸  01-home.png                    (Screenshot)');
  console.log('  📸  02-products.png                (Screenshot)');
  console.log('  📸  03-direct-order.png            (Screenshot)');
  console.log('  📸  04-cart.png                    (Screenshot)');
  console.log('  📸  05-checkout.png                (Screenshot)');
  console.log('  📸  06-orders.png                  (Screenshot)');
  console.log('\n  Each screenshot has:');
  console.log('    • Top banner (cyan gradient + title)');
  console.log('    • Actual app screenshot (embedded)');
  console.log('    • Bottom promo bar (dark + description)');
  console.log('\n' + '═'.repeat(55));
}

run().catch(console.error);
