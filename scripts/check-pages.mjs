import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'http://localhost:5173';
const OUTPUT_DIR = join(process.cwd(), 'playstore-final');

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const page = await ctx.newPage();

  const pages = ['/', '/products', '/cart', '/checkout', '/direct-order', '/my-orders'];

  for (const path of pages) {
    const url = `${BASE_URL}${path}`;
    console.log(`\n📍 ${path}`);
    
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    
    // Dismiss overlays
    try { await page.click('button:has-text("Got it")', { timeout: 800 }); } catch {}
    try { await page.click('[aria-label="Close"]', { timeout: 500 }); } catch {}
    await page.waitForTimeout(300);
    
    // Get page title and URL (in case of redirect)
    const title = await page.title();
    const currentUrl = page.url();
    console.log(`  Title: ${title}`);
    console.log(`  URL: ${currentUrl}`);
    
    // Check what's visible
    const bodyText = await page.evaluate(() => {
      const el = document.querySelector('.main-content') || document.querySelector('.app-shell') || document.body;
      return el.innerText.substring(0, 500);
    });
    console.log(`  Content preview: ${bodyText.substring(0, 200).replace(/\n/g, ' | ')}`);
  }

  await browser.close();
}

run().catch(console.error);
