import { chromium, devices } from 'playwright';

const URL = process.env.PROBE_URL || 'http://localhost:5173/';
const CPU = Number(process.env.CPU || 6);
const NET = process.env.NET || 'fast3g';

const NETS = {
  none:   { offline: false, latency: 0,   downloadThroughput: -1, uploadThroughput: -1 },
  fast4g: { offline: false, latency: 70,  downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (3 * 1024 * 1024) / 8 },
  fast3g: { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
  slow3g: { offline: false, latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 },
};

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['Pixel 7'] });
const page = await context.newPage();
const client = await page.context().newCDPSession(page);

await client.send('Emulation.setCPUThrottlingRate', { rate: CPU });
await client.send('Network.enable');
await client.send('Network.emulateNetworkConditions', NETS[NET]);

await page.addInitScript(() => {
  window.__longTasks = [];
  window.__shifts = [];
  window.__marks = [];
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      const a = e.attribution && e.attribution[0];
      window.__longTasks.push({
        start: Math.round(e.startTime),
        dur: Math.round(e.duration),
        attr: a ? `${a.name}:${a.containerType || ''}${a.containerName || ''}${a.containerSrc || ''}` : '',
      });
    }
  }).observe({ entryTypes: ['longtask'] });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) if (!e.hadRecentInput) window.__shifts.push({ start: Math.round(e.startTime), val: e.value });
  }).observe({ type: 'layout-shift', buffered: true });
});

const requests = [];
page.on('response', async (res) => {
  const url = res.url();
  if (/\.(webp|png|jpe?g|js|css)(\?|$)/.test(url) || url.includes('supabase')) {
    let size = 0;
    try { size = (await res.body()).length; } catch { /* ignore */ }
    const t = res.request().timing();
    requests.push({ url, status: res.status(), size, start: Math.round(t.startTime), dur: Math.round(t.responseEnd - t.requestStart) });
  }
});

// Sampling profiler: gives us NAMED call stacks for whatever burns the main thread.
await client.send('Profiler.enable');
await client.send('Profiler.setSamplingInterval', { interval: 200 });
await client.send('Profiler.start');

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });

// Frame gaps while ALSO scrolling — scrolling is the actual reported symptom.
const scrollTest = await page.evaluate(() => new Promise((resolve) => {
  const gaps = [];
  let last = performance.now();
  let n = 0;
  const t0 = performance.now();
  function tick(now) {
    gaps.push({ t: Math.round(now - t0), g: Math.round(now - last) });
    last = now;
    window.scrollBy(0, 12);
    if (++n < 300) requestAnimationFrame(tick);
    else resolve({ gaps, scrolled: Math.round(window.scrollY) });
  }
  requestAnimationFrame(tick);
}));

const profile = await client.send('Profiler.stop');
await page.waitForTimeout(3000);

const data = await page.evaluate(() => ({
  longTasks: window.__longTasks,
  shifts: window.__shifts,
  nav: (() => { const n = performance.getEntriesByType('navigation')[0]; return n ? { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) } : null; })(),
  paints: performance.getEntriesByType('paint').map((p) => ({ name: p.name, t: Math.round(p.startTime) })),
  lcp: (() => { const e = performance.getEntriesByType('largest-contentful-paint'); return e.length ? Math.round(e[e.length - 1].startTime) : null; })(),
  imgs: [...document.querySelectorAll('.hero-slide-img img')].map((i) => ({ src: i.currentSrc.split('/').pop(), natural: `${i.naturalWidth}x${i.naturalHeight}`, box: `${Math.round(i.clientWidth)}x${Math.round(i.clientHeight)}`, dpr: window.devicePixelRatio })),
  dom: document.querySelectorAll('*').length,
  cards: document.querySelectorAll('.product-card').length,
  h: Math.round(document.body.scrollHeight),
}));

console.log(`\n### MOBILE PROBE — Pixel 7, CPU ${CPU}x, net=${NET} ###`);
console.log('\n=== NAV / PAINT ===');
console.log(data.nav, data.paints, 'LCP:', data.lcp);
console.log(`  DOM nodes: ${data.dom}  product cards: ${data.cards}  page height: ${data.h}px  DPR: ${data.imgs[0]?.dpr}`);

console.log('\n=== LONG TASKS ===');
const tbt = data.longTasks.reduce((s, t) => s + Math.max(0, t.dur - 50), 0);
data.longTasks.slice(0, 25).forEach((t) => console.log(`  @${t.start}ms  ${t.dur}ms  ${t.attr}`));
console.log(`  count=${data.longTasks.length}  totalBlocking=${tbt}ms`);

console.log('\n=== SCROLL JANK (rAF gaps while scrolling) ===');
const g = scrollTest.gaps;
const worst = [...g].sort((a, b) => b.g - a.g).slice(0, 12);
console.log('  worst: ' + worst.map((w) => `${w.g}ms@${w.t}`).join(', '));
console.log(`  >100ms: ${g.filter((x) => x.g > 100).length} / ${g.length}   >32ms: ${g.filter((x) => x.g > 32).length}`);
console.log(`  scrolled to: ${scrollTest.scrolled}px of ${data.h}px`);

console.log('\n=== CLS ===');
console.log(`  CLS=${data.shifts.reduce((s, x) => s + x.val, 0).toFixed(4)}  (${data.shifts.length} shifts)`);

console.log('\n=== HERO IMAGES ===');
data.imgs.forEach((i) => console.log(`  ${i.src}  natural=${i.natural}  box=${i.box}`));

// ---- Attribute CPU time to named functions from the sampling profile ----
const { nodes, samples, timeDeltas } = profile.profile;
const byId = new Map(nodes.map((n) => [n.id, n]));
const self = new Map();
for (let i = 0; i < samples.length; i++) {
  const n = byId.get(samples[i]);
  if (!n) continue;
  const cf = n.callFrame;
  const key = `${cf.functionName || '(anonymous)'}  ${(cf.url || '').split('/').slice(-1)[0]}:${cf.lineNumber + 1}`;
  self.set(key, (self.get(key) || 0) + (timeDeltas[i] || 0) / 1000);
}
console.log('\n=== TOP MAIN-THREAD CONSUMERS (self time, ms) ===');
[...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 22)
  .forEach(([k, ms]) => { if (ms >= 1) console.log(`  ${ms.toFixed(0).padStart(6)}ms  ${k}`); });

console.log('\n=== NETWORK ===');
const slider = requests.filter((r) => r.url.includes('slider'));
const supa = requests.filter((r) => r.url.includes('supabase'));
const js = requests.filter((r) => /\.js(\?|$)/.test(r.url));
slider.forEach((r) => console.log(`  IMG ${(r.size / 1024).toFixed(0)}KB ${r.dur}ms  ${r.url.split('/').pop()}`));
console.log(`  slider: ${(slider.reduce((s, r) => s + r.size, 0) / 1024).toFixed(0)}KB / ${slider.length} req`);
console.log(`  js: ${(js.reduce((s, r) => s + r.size, 0) / 1024).toFixed(0)}KB / ${js.length} req`);
console.log(`  supabase: ${supa.length} req`);
supa.slice(0, 12).forEach((r) => console.log(`    ${r.dur}ms  ${decodeURIComponent(r.url.split('/rest/v1/')[1] || r.url).slice(0, 90)}`));

await browser.close();
