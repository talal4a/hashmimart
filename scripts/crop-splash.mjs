import { chromium } from 'playwright';
import { readFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'playstore-final');
const SPLASH_RAW = join(OUTPUT_DIR, 'splash-raw.png');
const LOGO_PATH = join(process.cwd(), 'public', 'logo-black.png');

async function run() {
  console.log('🖼️  Cropping splash screen to mobile view...\n');

  const splashBase64 = `data:image/png;base64,${readFileSync(SPLASH_RAW).toString('base64')}`;
  const logoBase64 = `data:image/png;base64,${readFileSync(LOGO_PATH).toString('base64')}`;

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  // Create 1000x1500 splash - just white background with logo centered
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
    background: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif;
  }
  .logo-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .logo {
    width: 200px;
    height: auto;
    object-fit: contain;
  }
</style>
</head>
<body>
  <div class="logo-container">
    <img src="${logoBase64}" class="logo" alt="Hashmi Mart">
  </div>
</body>
</html>`;

  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(500);

  const splashPath = join(OUTPUT_DIR, 'splash-screen-1000x1500.png');
  await page.screenshot({ path: splashPath, fullPage: false });
  await ctx.close();

  // Clean up
  try { unlinkSync(SPLASH_RAW); } catch {}

  console.log(`✅ Splash screen saved: ${splashPath}`);
  console.log(`   Size: 1000 × 1500 pixels`);
  console.log(`   White background with logo centered`);

  await browser.close();
}

run().catch(console.error);
