import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'playstore-final');
const SPLASH_SCREENSHOT = join(OUTPUT_DIR, 'splash-original.png');
const LOGO_PATH = join(process.cwd(), 'public', 'logo-black.png');

async function run() {
  console.log('🚀 Creating Splash Screen from your screenshot...\n');

  const splashBase64 = `data:image/png;base64,${readFileSync(SPLASH_SCREENSHOT).toString('base64')}`;
  const logoBase64 = `data:image/png;base64,${readFileSync(LOGO_PATH).toString('base64')}`;

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  // Create 1000x1500 splash screen with the actual logo from screenshot
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 1500 } });
  const page = await ctx.newPage();

  const html = `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1000px;
    height: 1500px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(180deg, #06b6d4 0%, #0891b2 50%, #0e7490 100%);
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif;
    overflow: hidden;
    position: relative;
  }
  
  /* Decorative circles */
  .circle {
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
  }
  .c1 { width: 500px; height: 500px; top: -150px; right: -150px; }
  .c2 { width: 350px; height: 350px; bottom: -100px; left: -100px; }
  .c3 { width: 200px; height: 200px; bottom: 300px; right: 80px; }
  
  .content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 100px;
    position: relative;
    z-index: 1;
  }
  
  .logo {
    width: 350px;
    height: 350px;
    object-fit: contain;
    filter: brightness(0) invert(1);
    margin-bottom: 50px;
  }
  
  .name {
    font-size: 100px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -2px;
    margin-bottom: 20px;
    text-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  }
  
  .tagline {
    font-size: 40px;
    color: rgba(255, 255, 255, 0.92);
    font-weight: 500;
    max-width: 700px;
    line-height: 1.4;
  }
</style>
</head>
<body>
  <div class="circle c1"></div>
  <div class="circle c2"></div>
  <div class="circle c3"></div>
  
  <div class="content">
    <img src="${logoBase64}" class="logo" alt="Hashmi Mart Logo">
    <div class="name">Hashmi Mart</div>
    <div class="tagline">Premium Fresh Groceries<br>Delivered Fast in Lahore</div>
  </div>
</body>
</html>`;

  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(500);

  const splashPath = join(OUTPUT_DIR, 'splash-screen-1000x1500.png');
  await page.screenshot({ path: splashPath, fullPage: false });
  await ctx.close();

  console.log(`✅ Splash screen saved: ${splashPath}`);
  console.log(`   Size: 1000 × 1500 pixels`);

  await browser.close();

  console.log('\n✨ Done! Splash screen updated in playstore-final/');
}

run().catch(console.error);
