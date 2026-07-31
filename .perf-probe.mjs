import { chromium } from 'playwright';

const URL = process.env.PROBE_URL || 'http://localhost:5173/';
const CPU_THROTTLE = Number(process.env.CPU || 4);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const client = await page.context().newCDPSession(page);

await client.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
await client.send('Performance.enable');

// Collect long tasks + layout shifts from inside the page.
await page.addInitScript(() => {
  window.__longTasks = [];
  window.__shifts = [];
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      window.__longTasks.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) });
    }
  }).observe({ entryTypes: ['longtask'] });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      if (!e.hadRecentInput) window.__shifts.push({ start: Math.round(e.startTime), val: e.value });
    }
  }).observe({ type: 'layout-shift', buffered: true });
});

const requests = [];
page.on('response', async (res) => {
  const url = res.url();
  if (/\.(webp|png|jpe?g|js|css)(\?|$)/.test(url) || url.includes('supabase')) {
    let size = 0;
    try { size = (await res.body()).length; } catch { /* ignore */ }
    requests.push({ url: url.replace(URL, '/'), status: res.status(), size, type: res.request().resourceType() });
  }
});

const t0 = Date.now();
await page.goto(URL, { waitUntil: 'domcontentloaded' });

// Probe responsiveness: measure how long each rAF-to-rAF gap takes early on.
const frames = await page.evaluate(() => new Promise((resolve) => {
  const gaps = [];
  let last = performance.now();
  let n = 0;
  function tick(now) {
    gaps.push(Math.round(now - last));
    last = now;
    if (++n < 240) requestAnimationFrame(tick); else resolve(gaps);
  }
  requestAnimationFrame(tick);
}));

await page.waitForTimeout(5000);

const data = await page.evaluate(() => ({
  longTasks: window.__longTasks,
  shifts: window.__shifts,
  nav: (() => { const n = performance.getEntriesByType('navigation')[0]; return n ? { domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) } : null; })(),
  paints: performance.getEntriesByType('paint').map((p) => ({ name: p.name, t: Math.round(p.startTime) })),
  imgs: [...document.querySelectorAll('.hero-slide-img img')].map((i) => ({ src: i.currentSrc.split('/').pop(), natural: `${i.naturalWidth}x${i.naturalHeight}`, box: `${Math.round(i.clientWidth)}x${Math.round(i.clientHeight)}` })),
}));

console.log('\n=== NAV / PAINT ===');
console.log(data.nav, data.paints);

console.log('\n=== LONG TASKS (>50ms blocking main thread) ===');
const tbt = data.longTasks.reduce((s, t) => s + Math.max(0, t.dur - 50), 0);
data.longTasks.slice(0, 25).forEach((t) => console.log(`  @${t.start}ms  ${t.dur}ms`));
console.log(`  count=${data.longTasks.length}  totalBlocking=${tbt}ms`);

console.log('\n=== WORST FRAME GAPS (jank during first ~4s) ===');
const worst = frames.map((g, i) => ({ i, g })).sort((a, b) => b.g - a.g).slice(0, 10);
console.log('  ' + worst.map((w) => `${w.g}ms`).join(', '));
console.log(`  frames>100ms: ${frames.filter((g) => g > 100).length} / ${frames.length}`);

console.log('\n=== LAYOUT SHIFTS ===');
const cls = data.shifts.reduce((s, x) => s + x.val, 0);
data.shifts.slice(0, 10).forEach((s) => console.log(`  @${s.start}ms  ${s.val.toFixed(4)}`));
console.log(`  CLS=${cls.toFixed(4)}`);

console.log('\n=== HERO IMAGES DECODED ===');
data.imgs.forEach((i) => console.log(`  ${i.src}  natural=${i.natural}  box=${i.box}`));

console.log('\n=== NETWORK (slider + supabase) ===');
const slider = requests.filter((r) => r.url.includes('slider'));
const supa = requests.filter((r) => r.url.includes('supabase'));
slider.forEach((r) => console.log(`  ${r.status} ${(r.size / 1024).toFixed(0)}KB  ${r.url.split('/').pop()}`));
console.log(`  slider bytes: ${(slider.reduce((s, r) => s + r.size, 0) / 1024).toFixed(0)}KB across ${slider.length} req`);
console.log(`  supabase requests: ${supa.length}`);

await browser.close();
