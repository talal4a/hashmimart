import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const SCREENSHOTS_DIR = join(process.cwd(), 'playstore-screenshots');
const BASE_URL = 'http://localhost:5173';

// iPhone 14 Pro dimensions (popular Play Store size)
const VIEWPORT = {
  width: 393,
  height: 852,
  deviceScaleFactor: 3, // High DPI for crisp screenshots
};

// Screens to capture with their paths and names
const SCREENS = [
  { 
    name: '01-home-categories', 
    path: '/',
    title: 'Home & Categories',
    description: 'Browse retail & wholesale groceries'
  },
  { 
    name: '02-products', 
    path: '/products',
    title: 'Fresh Products',
    description: 'Quality groceries at best prices'
  },
  { 
    name: '03-product-detail', 
    path: '/product/1', // Will redirect if product doesn't exist
    title: 'Product Details',
    description: 'View product info & add to cart'
  },
  { 
    name: '04-cart', 
    path: '/cart',
    title: 'Shopping Cart',
    description: 'Review your items'
  },
  { 
    name: '05-checkout', 
    path: '/checkout',
    title: 'Secure Checkout',
    description: 'Multiple payment options'
  },
  { 
    name: '06-direct-order', 
    path: '/direct-order',
    title: 'Direct Order',
    description: 'Quick order without browsing'
  },
  { 
    name: '07-my-orders', 
    path: '/my-orders',
    title: 'My Orders',
    description: 'Track all your orders'
  },
  { 
    name: '08-login', 
    path: '/login',
    title: 'Login',
    description: 'Sign in to your account'
  },
];

async function captureScreenshots() {
  console.log('🚀 Starting Play Store screenshot capture...\n');
  
  // Create output directory
  await mkdir(SCREENSHOTS_DIR, { recursive: true });
  console.log(`📁 Output directory: ${SCREENSHOTS_DIR}\n`);

  // Launch browser
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: VIEWPORT.deviceScaleFactor,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true,
  });

  const page = await context.newPage();
  
  // Collect metadata for each screenshot
  const metadata = [];

  for (const screen of SCREENS) {
    const url = `${BASE_URL}${screen.path}`;
    console.log(`📸 Capturing: ${screen.name}`);
    console.log(`   URL: ${url}`);
    
    try {
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: 15000 
      });
      
      // Wait for content to load
      await page.waitForTimeout(2000);
      
      // Take screenshot
      const filepath = join(SCREENSHOTS_DIR, `${screen.name}.png`);
      await page.screenshot({ 
        path: filepath,
        fullPage: false // Viewport only for Play Store
      });
      
      console.log(`   ✅ Saved: ${filepath}`);
      
      metadata.push({
        filename: `${screen.name}.png`,
        title: screen.title,
        description: screen.description,
        path: screen.path,
      });
      
    } catch (error) {
      console.log(`   ⚠️  Skipped (page may not exist): ${error.message}`);
    }
  }

  await browser.close();
  
  // Save metadata
  const metadataPath = join(SCREENSHOTS_DIR, 'metadata.json');
  const { writeFileSync } = await import('fs');
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  
  console.log('\n✨ Done! Screenshots saved to:', SCREENSHOTS_DIR);
  console.log('📄 Metadata saved to:', metadataPath);
  
  return metadata;
}

captureScreenshots().catch(console.error);
