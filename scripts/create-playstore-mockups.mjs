import { chromium } from 'playwright';
import { mkdir, readFile } from 'fs/promises';
import { join } from 'path';

const SCREENSHOTS_DIR = join(process.cwd(), 'playstore-screenshots');
const OUTPUT_DIR = join(process.cwd(), 'playstore-final');

// Play Store screenshot dimensions (iPhone 14 Pro size)
const WIDTH = 1179;  // 393 * 3 (deviceScaleFactor)
const HEIGHT = 2556; // 852 * 3 (deviceScaleFactor)

// 6 screens with promotional text for Play Store
const MOCKUPS = [
  {
    source: '01-home-categories.png',
    output: '01-home-categories.png',
    bannerTitle: 'Shop by Category',
    bannerSubtitle: 'Retail & Wholesale Groceries',
    promoText: 'Browse fresh produce, dairy, and daily essentials at the best prices in Lahore'
  },
  {
    source: '02-products.png',
    output: '02-products.png',
    bannerTitle: 'Fresh & Quality',
    bannerSubtitle: 'Daily Fresh from Local Farms',
    promoText: 'Premium quality groceries with competitive wholesale rates'
  },
  {
    source: '06-direct-order.png',
    output: '03-direct-order.png',
    bannerTitle: 'Voice Order',
    bannerSubtitle: 'Just Say What You Need!',
    promoText: 'Quick ordering without browsing - send a voice note or describe your needs'
  },
  {
    source: '04-cart.png',
    output: '04-cart.png',
    bannerTitle: 'Smart Cart',
    bannerSubtitle: 'Review & Checkout in Seconds',
    promoText: 'Free delivery on orders above Rs. 500 - track your savings'
  },
  {
    source: '05-checkout.png',
    output: '05-checkout.png',
    bannerTitle: 'Secure Checkout',
    bannerSubtitle: 'Multiple Payment Options',
    promoText: 'Cash on Delivery or JazzCash - choose what works for you'
  },
  {
    source: '07-my-orders.png',
    output: '06-order-tracking.png',
    bannerTitle: 'Track Your Order',
    bannerSubtitle: 'Real-time Status Updates',
    promoText: 'Know exactly when your groceries will arrive'
  }
];

async function createMockups() {
  console.log('🎨 Creating Play Store mockups...\n');
  
  await mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
  });

  const page = await context.newPage();

  for (const mockup of MOCKUPS) {
    console.log(`📸 Creating: ${mockup.output}`);
    
    const sourcePath = join(SCREENSHOTS_DIR, mockup.source);
    
    // Create HTML with banner + screenshot
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          width: ${WIDTH}px;
          height: ${HEIGHT}px;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
          overflow: hidden;
          background: #ffffff;
        }
        .banner {
          background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
          color: white;
          padding: 60px 60px 50px;
          text-align: center;
        }
        .banner-title {
          font-size: 72px;
          font-weight: 800;
          letter-spacing: -1px;
          margin-bottom: 16px;
          text-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .banner-subtitle {
          font-size: 42px;
          font-weight: 500;
          opacity: 0.95;
          margin-bottom: 0;
        }
        .screenshot-container {
          width: 100%;
          height: calc(100% - 280px);
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f8fafc;
          padding: 20px;
        }
        .screenshot-container img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        }
        .promo-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(15, 23, 42, 0.95);
          color: white;
          padding: 40px 60px;
          text-align: center;
        }
        .promo-text {
          font-size: 32px;
          font-weight: 500;
          line-height: 1.4;
          opacity: 0.9;
        }
      </style>
    </head>
    <body>
      <div class="banner">
        <div class="banner-title">${mockup.bannerTitle}</div>
        <div class="banner-subtitle">${mockup.bannerSubtitle}</div>
      </div>
      <div class="screenshot-container">
        <img src="file://${sourcePath}" alt="App Screenshot">
      </div>
      <div class="promo-bar">
        <div class="promo-text">${mockup.promoText}</div>
      </div>
    </body>
    </html>
    `;
    
    await page.setContent(html);
    await page.waitForTimeout(500);
    
    const outputPath = join(OUTPUT_DIR, mockup.output);
    await page.screenshot({ 
      path: outputPath,
      fullPage: false 
    });
    
    console.log(`   ✅ Saved: ${outputPath}`);
  }

  await browser.close();
  
  console.log('\n✨ All mockups created in:', OUTPUT_DIR);
}

createMockups().catch(console.error);
