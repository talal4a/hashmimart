import { chromium, devices } from 'playwright';
import { readFileSync } from 'fs';
import { SourceMapConsumer } from 'source-map';

const URL = 'http://localhost:4173/';
const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['Pixel 7'] });
const page = await context.newPage();
const client = await page.context().newCDPSession(page);
await client.send('Emulation.setCPUThrottlingRate', { rate: 6 });
await client.send('Network.enable');
await client.send('Network.emulateNetworkConditions', {
  offline: false, latency: 70,
  downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (3 * 1024 * 1024) / 8,
});

await client.send('Profiler.enable');
await client.send('Profiler.setSamplingInterval', { interval: 100 });
await client.send('Profiler.start');
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(6000);
const profile = await client.send('Profiler.stop');
await browser.close();

const { nodes, samples, timeDeltas } = profile.profile;
const byId = new Map(nodes.map((n) => [n.id, n]));

// self time keyed by url+line+col so we can map precisely
const self = new Map();
for (let i = 0; i < samples.length; i++) {
  const n = byId.get(samples[i]);
  if (!n) continue;
  const cf = n.callFrame;
  const key = JSON.stringify({ f: cf.functionName, u: cf.url, l: cf.lineNumber, c: cf.columnNumber });
  self.set(key, (self.get(key) || 0) + (timeDeltas[i] || 0) / 1000);
}

const maps = new Map();
function getMap(url) {
  const file = url.split('/').pop();
  if (!file || !file.endsWith('.js')) return null;
  if (maps.has(file)) return maps.get(file);
  let mc = null;
  try { mc = JSON.parse(readFileSync(`dist/assets/${file}.map`, 'utf8')); } catch { /* none */ }
  maps.set(file, mc);
  return mc;
}

const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
console.log('\n=== RESOLVED TOP CONSUMERS (self ms) ===');
for (const [k, ms] of top) {
  if (ms < 2) continue;
  const { f, u, l, c } = JSON.parse(k);
  const raw = JSON.parse(k);
  let where = `${(u || '').split('/').pop()}:${l + 1}:${c}`;
  const mc = getMap(u || '');
  if (mc) {
    const consumer = await new SourceMapConsumer(mc);
    const pos = consumer.originalPositionFor({ line: l + 1, column: c });
    if (pos && pos.source) where = `${pos.source.replace(/^.*\/src\//, 'src/')}:${pos.line} (${pos.name || f})`;
    consumer.destroy();
  }
  console.log(`  ${ms.toFixed(0).padStart(6)}ms  ${String(f || '(anon)').padEnd(14)} ${where}`);
}
