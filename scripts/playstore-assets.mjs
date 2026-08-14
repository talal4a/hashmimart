import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'http://localhost:5173';
const OUTPUT_DIR = join(process.cwd(), 'playstore-final');
const LOGO_PATH = join(process.cwd(), 'public', 'logo-black.png');

// Play Store phone screenshot size (1080x1920 is standard)
const PHONE_W = 1080;
const PHONE_H = 1920;

// 6 key screens for Play Store
const SCREENS = [
  {
    id: 1,
    path: '/',
    name: 'home',
    bannerTitle: 'Shop by Category',
    bannerSubtitle: 'Retail & Wholesale Groceries',
    promoText: 'Browse fresh produce, dairy, and daily essentials at the best prices in Lahore'
  },
  {
    id: 2,
    path: '/products',
    name: 'products',
    bannerTitle: 'Fresh & Quality',
    bannerSubtitle: 'Daily Fresh from Local Farms',
    promoText: 'Premium quality groceries with competitive wholesale rates'
  },
  {
    id: 3,
    path: '/direct-order',
    name: 'direct-order',
    bannerTitle: 'Voice Order',
    bannerSubtitle: 'Just Say What You Need!',
    promoText: 'Quick ordering without browsing — send a voice note or describe your needs'
  },
  {
    id: 4,
    path: '/cart',
    name: 'cart',
    bannerTitle: 'Smart Cart',
    bannerSubtitle: 'Review & Checkout in Seconds',
    promoText: 'Free delivery on orders above Rs. 500 — track your savings'
  },
  {
    id: 5,
    path: '/checkout',
    name: 'checkout',
    bannerTitle: 'Secure Checkout',
    bannerSubtitle: 'Multiple Payment Options',
    promoText: 'Cash on Delivery or JazzCash — choose what works for you'
  },
  {
    id: 6,
    path: '/my-orders',
    name: 'orders',
    bannerTitle: 'Track Your Order',
    bannerSubtitle: 'Real-time Status Updates',
    promoText: 'Know exactly when your groceries will arrive'
  }
];

async function run() {
  console.log('🏪 Hashmi Mart — Play Store Asset Generator\n');
  await mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  // ─── 1. RAW SCREENSHOTS (mobile viewport) ──────────────────────────
  console.log('📸 Step 1: Taking raw mobile screenshots...\n');

  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },  // iPhone 14 size
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const mobilePage = await mobileCtx.newPage();

  const rawPaths = [];

  for (const screen of SCREENS) {
    const url = `${BASE_URL}${screen.path}`;
    console.log(`  📱 [${screen.id}/6] ${screen.bannerTitle} → ${screen.path}`);

    try {
      await mobilePage.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      await mobilePage.waitForTimeout(2500);

      // Dismiss any overlay/modal if present
      try {
        await mobilePage.click('button:has-text("Got it")', { timeout: 1000 });
        await mobilePage.waitForTimeout(300);
      } catch { /* no modal */ }

      // Close any install prompt overlay
      try {
        await mobilePage.click('[aria-label="Close"]', { timeout: 500 });
        await mobilePage.waitForTimeout(200);
      } catch { /* no overlay */ }

      const rawPath = join(OUTPUT_DIR, `raw-${screen.id}-${screen.name}.png`);
      await mobilePage.screenshot({ path: rawPath, fullPage: false });
      rawPaths.push({ ...screen, rawPath });
      console.log(`     ✅ Saved raw screenshot`);
    } catch (err) {
      console.log(`     ⚠️  Skipped: ${err.message}`);
    }
  }
  await mobileCtx.close();

  // ─── 2. SCREENSHOTS WITH BANNER + PROMO TEXT ────────────────────────
  console.log('\n🎨 Step 2: Creating screenshots with banners + promo text...\n');

  for (const screen of rawPaths) {
    const finalPath = join(OUTPUT_DIR, `${String(screen.id).padStart(2, '0')}-${screen.name}.png`);
    const bannerCtx = await browser.newContext({
      viewport: { width: PHONE_W, height: PHONE_H },
    });
    const bannerPage = await bannerCtx.newPage();

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
    background: #f8fafc;
    display: flex;
    flex-direction: column;
  }

  /* ── Top Banner ── */
  .banner {
    flex-shrink: 0;
    background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
    color: white;
    padding: 60px 50px 50px;
    text-align: center;
  }
  .banner-title {
    font-size: 64px;
    font-weight: 800;
    letter-spacing: -1px;
    margin-bottom: 12px;
    text-shadow: 0 2px 8px rgba(0,0,0,0.12);
  }
  .banner-subtitle {
    font-size: 36px;
    font-weight: 500;
    opacity: 0.92;
  }

  /* ── Screenshot area ── */
  .screenshot-wrap {
    flex: 1;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    overflow: hidden;
    background: #ffffff;
  }
  .screenshot-wrap img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top;
  }

  /* ── Bottom Promo Bar ── */
  .promo {
    flex-shrink: 0;
    background: rgba(15, 23, 42, 0.92);
    backdrop-filter: blur(8px);
    color: white;
    padding: 44px 50px;
    text-align: center;
  }
  .promo-text {
    font-size: 30px;
    font-weight: 500;
    line-height: 1.45;
    opacity: 0.92;
  }
</style>
</head>
<body>
  <div class="banner">
    <div class="banner-title">${screen.bannerTitle}</div>
    <div class="banner-subtitle">${screen.bannerSubtitle}</div>
  </div>
  <div class="screenshot-wrap">
    <img src="file://${screen.rawPath}" alt="${screen.bannerTitle}">
  </div>
  <div class="promo">
    <div class="promo-text">${screen.promoText}</div>
  </div>
</body>
</html>`;

    await bannerPage.setContent(html);
    await bannerPage.waitForTimeout(400);
    await bannerPage.screenshot({ path: finalPath, fullPage: false });
    await bannerCtx.close();
    console.log(`  ✅ [${screen.id}/6] ${finalPath}`);
  }

  // ─── 3. APP LOGO 1024×1024 ──────────────────────────────────────────
  console.log('\n📱 Step 3: Creating App Logo (1024×1024)...');

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
  .logo { width: 600px; height: 600px; object-fit: contain; }
</style></head>
<body>
  <img src="file://${LOGO_PATH}" class="logo" alt="Hashmi Mart">
</body></html>`);
  await logoPage.waitForTimeout(400);
  const logoOut = join(OUTPUT_DIR, 'app-logo-1024x1024.png');
  await logoPage.screenshot({ path: logoOut, fullPage: false });
  await logoCtx.close();
  console.log(`  ✅ ${logoOut}`);

  // ─── 4. SPLASH SCREEN 1000×1500 ─────────────────────────────────────
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
    overflow: hidden;
    position: relative;
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
    <img src="file://${LOGO_PATH}" class="logo" alt="Logo">
    <div class="name">Hashmi Mart</div>
    <div class="tagline">Premium Fresh Groceries<br>Delivered Fast in Lahore</div>
  </div>
</body></html>`);
  await splashPage.waitForTimeout(400);
  const splashOut = join(OUTPUT_DIR, 'splash-screen-1000x1500.png');
  await splashPage.screenshot({ path: splashOut, fullPage: false });
  await splashCtx.close();
  console.log(`  ✅ ${splashOut}`);

  // ─── 5. PUSH NOTIFICATION ICON SVG ──────────────────────────────────
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

  // ─── CLEANUP ────────────────────────────────────────────────────────
  console.log('\n🧹 Cleaning up raw screenshots...');

  // cleanup imported at top
  for (const screen of rawPaths) {
    try { unlinkSync(screen.rawPath); } catch { /* ignore */ }
  }
  console.log('  ✅ Raw files removed');

  await browser.close();

  // ─── SUMMARY ────────────────────────────────────────────────────────
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
  console.log('    • Actual app screenshot');
  console.log('    • Bottom promo bar (dark + description)');
  console.log('\n' + '═'.repeat(55));
}

run().catch(console.error);
