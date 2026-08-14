import { chromium } from 'playwright';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'playstore-final');

async function createAssets() {
  console.log('🎨 Creating App Logo and Splash Screen...\n');

  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox']
  });

  // ============ APP LOGO (1024x1024) ============
  console.log('📱 Creating App Logo (1024x1024)...');
  
  const logoContext = await browser.newContext({
    viewport: { width: 1024, height: 1024 },
  });
  const logoPage = await logoContext.newPage();
  
  const logoHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: 1024px;
        height: 1024px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #f0fdfa 0%, #ffffff 100%);
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
      }
      .logo-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .logo-image {
        width: 500px;
        height: 500px;
        object-fit: contain;
        margin-bottom: 40px;
      }
      .brand-name {
        font-size: 120px;
        font-weight: 800;
        color: #0f172a;
        letter-spacing: -3px;
        text-align: center;
      }
      .tagline {
        font-size: 48px;
        color: #06b6d4;
        font-weight: 600;
        margin-top: 20px;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="logo-container">
      <img src="file://${join(process.cwd(), 'public', 'logo-black.png')}" class="logo-image" alt="Logo">
      <div class="brand-name">Hashmi Mart</div>
      <div class="tagline">Premium Groceries</div>
    </div>
  </body>
  </html>
  `;
  
  await logoPage.setContent(logoHtml);
  await logoPage.waitForTimeout(500);
  
  const logoPath = join(OUTPUT_DIR, 'app-logo-1024x1024.png');
  await logoPage.screenshot({ path: logoPath, fullPage: false });
  console.log(`   ✅ Logo saved: ${logoPath}`);
  
  await logoContext.close();

  // ============ SPLASH SCREEN (1000x1500) ============
  console.log('\n🚀 Creating Splash Screen (1000x1500)...');
  
  const splashContext = await browser.newContext({
    viewport: { width: 1000, height: 1500 },
  });
  const splashPage = await splashContext.newPage();
  
  const splashHtml = `
  <!DOCTYPE html>
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
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
        overflow: hidden;
      }
      .splash-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 100px;
      }
      .logo-image {
        width: 350px;
        height: 350px;
        object-fit: contain;
        filter: brightness(0) invert(1);
        margin-bottom: 60px;
      }
      .brand-name {
        font-size: 100px;
        font-weight: 800;
        color: #ffffff;
        letter-spacing: -2px;
        margin-bottom: 30px;
        text-shadow: 0 4px 20px rgba(0,0,0,0.2);
      }
      .tagline {
        font-size: 48px;
        color: rgba(255, 255, 255, 0.95);
        font-weight: 500;
        max-width: 700px;
        line-height: 1.4;
      }
      .decorative-circle {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
      }
      .circle-1 {
        width: 400px;
        height: 400px;
        top: -100px;
        right: -100px;
      }
      .circle-2 {
        width: 300px;
        height: 300px;
        bottom: -80px;
        left: -80px;
      }
      .circle-3 {
        width: 200px;
        height: 200px;
        bottom: 200px;
        right: 50px;
      }
    </style>
  </head>
  <body>
    <div class="decorative-circle circle-1"></div>
    <div class="decorative-circle circle-2"></div>
    <div class="decorative-circle circle-3"></div>
    <div class="splash-content">
      <img src="file://${join(process.cwd(), 'public', 'logo-black.png')}" class="logo-image" alt="Logo">
      <div class="brand-name">Hashmi Mart</div>
      <div class="tagline">Premium Fresh Groceries<br>Delivered Fast in Lahore</div>
    </div>
  </body>
  </html>
  `;
  
  await splashPage.setContent(splashHtml);
  await splashPage.waitForTimeout(500);
  
  const splashPath = join(OUTPUT_DIR, 'splash-screen-1000x1500.png');
  await splashPage.screenshot({ path: splashPath, fullPage: false });
  console.log(`   ✅ Splash saved: ${splashPath}`);
  
  await splashContext.close();

  // ============ PUSH NOTIFICATION ICON (SVG) ============
  console.log('\n🔔 Creating Push Notification Icon (SVG)...');
  
  const { writeFileSync } = await import('fs');
  
  const svgIcon = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="192" height="192" viewBox="0 0 192 192" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="192" y2="192" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#06b6d4"/>
      <stop offset="100%" stop-color="#0891b2"/>
    </linearGradient>
  </defs>
  <rect width="192" height="192" rx="42" fill="url(#bg)"/>
  <text x="96" y="128" font-family="Arial, Helvetica, sans-serif" font-size="96" font-weight="bold" fill="white" text-anchor="middle">H</text>
</svg>`;
  
  const svgPath = join(OUTPUT_DIR, 'push-notification-icon.svg');
  writeFileSync(svgPath, svgIcon);
  console.log(`   ✅ SVG saved: ${svgPath}`);

  await browser.close();
  
  console.log('\n✨ All Play Store assets created!');
  console.log('📁 Output directory:', OUTPUT_DIR);
  console.log('\n📋 Files created:');
  console.log('   • app-logo-1024x1024.png');
  console.log('   • splash-screen-1000x1500.png');
  console.log('   • push-notification-icon.svg');
  console.log('   • 6 app screenshots with banners');
}

createAssets().catch(console.error);
