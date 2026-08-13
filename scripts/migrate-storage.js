#!/usr/bin/env node
/**
 * migrate-storage.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Copy every file from one Supabase project's Storage buckets into another
 * Supabase project — i.e. "migrate / duplicate my storage to a new project".
 *
 * REQUIREMENTS
 *   - Node.js 18+ (uses the built-in global fetch, FormData and Blob — no
 *     external dependencies, nothing to `npm install`)
 *   - A SERVICE-ROLE key for BOTH projects
 *     (Supabase Dashboard → Settings → API → service_role).
 *     The anon key cannot read private buckets or list all objects, so it
 *     will NOT work here. Treat these keys as secrets.
 *
 * CONFIG  (CLI flags win over .env / environment variables)
 *   Source project (the one you're migrating FROM):
 *     --source-url https://old-project.supabase.co   (or SOURCE_SUPABASE_URL)
 *     --source-key <service_role_key>                (or SOURCE_SERVICE_ROLE_KEY)
 *   Destination project (the new one you're migrating TO):
 *     --dest-url    https://new-project.supabase.co  (or DEST_SUPABASE_URL)
 *     --dest-key    <service_role_key>               (or DEST_SERVICE_ROLE_KEY)
 *
 *   Options:
 *     --bucket name    Only migrate this bucket (repeatable or comma-separated)
 *     --concurrency N  Parallel uploads (default: 5)
 *     --dry-run        Print exactly what would be copied, copy nothing
 *     --force          Re-upload files that already exist on the destination
 *     --help           Show usage
 *
 * EXAMPLE
 *   node scripts/migrate-storage.js \
 *     --source-url https://abc.supabase.co --source-key s_OLD \
 *     --dest-url    https://xyz.supabase.co --dest-key    s_NEW \
 *     --bucket product-images
 *
 * WHAT IT DOES
 *   1. Lists every bucket on the source project.
 *   2. Auto-creates missing buckets on the destination (public flag, file size
 *      limit and allowed MIME types are copied over).
 *   3. Recursively lists ALL objects in each bucket (folder-by-folder walk,
 *      because the Storage list API caps a single call at 1000 objects).
 *   4. Downloads each file from the source and uploads it to the destination
 *      with `x-upsert`, preserving folder structure and MIME types.
 *   5. Skips files that already exist on the destination, so it is safe to
 *      re-run after an interruption — only the missing files get copied.
 *
 * NOT COPIED
 *   - Storage RLS policies are part of the database, not the files. Re-run the
 *     SQL from supabase/*.sql (e.g. supabase/create-product-images-bucket.sql)
 *     on the new project so the buckets keep working with the same access rules.
 *   - Bucket-level CORS / custom domain / image transformation settings.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/* ── tiny .env loader (no dotenv dependency) ─────────────────────────────── */

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  const raw = readFileSync(file, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('[')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

// Source creds also fall back to the existing SUPABASE_* vars used by this repo.
// .env.local overrides .env (conventional precedence: first set wins below).
loadEnvFile(path.join(process.cwd(), '.env.local'));
loadEnvFile(path.join(process.cwd(), '.env'));

/* ── CLI parsing ─────────────────────────────────────────────────────────── */

function printUsage() {
  console.log(`Usage: node scripts/migrate-storage.js [options]

  --source-url <url>    Source Supabase project URL
  --source-key <key>    Source project SERVICE-ROLE key
  --dest-url <url>      Destination Supabase project URL
  --dest-key <key>      Destination project SERVICE-ROLE key
  --bucket <name>       Migrate only this bucket (repeatable / comma-separated)
  --concurrency <n>     Parallel uploads (default 5)
  --dry-run             Print what would be copied, copy nothing
  --force               Re-upload files already present on the destination
  --help                Show this help

You can put the keys in .env instead:
  SOURCE_SUPABASE_URL, SOURCE_SERVICE_ROLE_KEY,
  DEST_SUPABASE_URL, DEST_SERVICE_ROLE_KEY`);
}

const args = process.argv.slice(2);
const flags = { buckets: [] };

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  const eq = arg.indexOf('=');
  const name = eq === -1 ? arg : arg.slice(0, eq);
  const inline = eq === -1 ? undefined : arg.slice(eq + 1);
  const next = () => (i + 1 < args.length ? args[++i] : undefined);
  switch (name) {
    case '--source-url': flags.sourceUrl = inline ?? next(); break;
    case '--source-key': flags.sourceKey = inline ?? next(); break;
    case '--dest-url': flags.destUrl = inline ?? next(); break;
    case '--dest-key': flags.destKey = inline ?? next(); break;
    case '--concurrency': flags.concurrency = Number.parseInt(inline ?? next(), 10); break;
    case '--bucket': {
      for (const b of (inline ?? next() ?? '').split(',')) if (b.trim()) flags.buckets.push(b.trim());
      break;
    }
    case '--dry-run': flags.dryRun = true; break;
    case '--force': flags.force = true; break;
    case '-h': case '--help': printUsage(); process.exit(0);
    default:
      if (arg.startsWith('-')) { console.error(`Unknown flag: ${arg}`); printUsage(); process.exit(1); }
      console.warn(`Ignoring unexpected argument: ${arg}`);
  }
}

const config = {
  sourceUrl: flags.sourceUrl ?? process.env.SOURCE_SUPABASE_URL ?? process.env.SUPABASE_URL,
  sourceKey: flags.sourceKey ?? process.env.SOURCE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
  destUrl: flags.destUrl ?? process.env.DEST_SUPABASE_URL,
  destKey: flags.destKey ?? process.env.DEST_SERVICE_ROLE_KEY,
  concurrency: Math.max(1, Number(flags.concurrency) || 5),
  buckets: flags.buckets,
  dryRun: !!flags.dryRun,
  force: !!flags.force,
};

const missing = [];
if (!config.sourceUrl) missing.push('--source-url / SOURCE_SUPABASE_URL');
if (!config.sourceKey) missing.push('--source-key / SOURCE_SERVICE_ROLE_KEY');
if (!config.destUrl) missing.push('--dest-url / DEST_SUPABASE_URL');
if (!config.destKey) missing.push('--dest-key / DEST_SERVICE_ROLE_KEY');
if (missing.length) {
  console.error('Missing required config:\n  ' + missing.join('\n  '));
  console.error('\nRun with --help for usage.');
  process.exit(1);
}

/* ── small HTTP / storage helpers ────────────────────────────────────────── */

async function apiJson(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`HTTP ${res.status} ${res.statusText}\n  ${url}\n  ${body.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('json') ? res.json() : res.text();
}

const bearer = (key) => ({ Authorization: `Bearer ${key}` });

/** Recursively list every object in a bucket (folder-walk pagination). */
async function listAllObjects(url, key, bucket) {
  const out = [];
  const seen = new Set();

  async function walk(prefix) {
    let offset = 0;
    for (;;) {
      const items = await apiJson(
        `${url}/storage/v1/object/list/${encodeURIComponent(bucket)}`,
        {
          method: 'POST',
          headers: { ...bearer(key), 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
        },
      );
      for (const item of items || []) {
        const name = item?.name;
        if (!name) continue;
        // Folders come back with id === null (older API versions: trailing "/").
        // The real API reports folders WITHOUT a trailing slash, so normalize the
        // sub-prefix to always end with "/" before recursing.
        if (item.id === null || name.endsWith('/')) {
          await walk(prefix + name.replace(/\/+$/, '') + '/');
        } else {
          const full = prefix + name;
          if (!seen.has(full)) {
            seen.add(full);
            out.push({ name: full, metadata: item.metadata || {} });
          }
        }
      }
      if (!items || items.length < 1000) break; // fewer than limit → last page
      offset += items.length;
    }
  }

  await walk('');
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

async function listBuckets(url, key) {
  return (await apiJson(`${url}/storage/v1/bucket`, { headers: bearer(key) })) || [];
}

async function createBucket(url, key, bucket) {
  const body = { id: bucket.name, name: bucket.name, public: !!bucket.public };
  if (bucket.file_size_limit != null) body.file_size_limit = bucket.file_size_limit;
  if (Array.isArray(bucket.allowed_mime_types) && bucket.allowed_mime_types.length) {
    body.allowed_mime_types = bucket.allowed_mime_types;
  }
  await apiJson(`${url}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...bearer(key), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const MIME_BY_EXT = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', avif: 'image/avif', svg: 'image/svg+xml', ico: 'image/x-icon',
  mp3: 'audio/mpeg', wav: 'audio/wav', webm: 'audio/webm', ogg: 'audio/ogg',
  mp4: 'video/mp4', mov: 'video/quicktime', pdf: 'application/pdf',
  json: 'application/json', txt: 'text/plain', zip: 'application/zip',
};

function mimeFor(name, metaMime) {
  if (metaMime && metaMime !== 'application/octet-stream') return metaMime;
  const ext = (name.split('.').pop() || '').toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

function encodeObjectPath(bucket, name) {
  return `${encodeURIComponent(bucket)}/${name.split('/').map(encodeURIComponent).join('/')}`;
}

async function downloadObject(url, key, bucket, name) {
  const res = await fetch(`${url}/storage/v1/object/${encodeObjectPath(bucket, name)}`, {
    headers: bearer(key),
  });
  if (!res.ok) {
    const err = new Error(`download HTTP ${res.status} ${res.statusText}`);
    err.status = res.status;
    throw err;
  }
  return res.arrayBuffer();
}

async function uploadObject(url, key, bucket, name, buf, mime) {
  const form = new FormData();
  form.append('file', new Blob([buf], { type: mime }), name.split('/').pop() || 'file');
  const res = await fetch(`${url}/storage/v1/object/${encodeObjectPath(bucket, name)}`, {
    method: 'POST',
    headers: { ...bearer(key), 'x-upsert': 'true' },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`upload HTTP ${res.status} ${res.statusText} — ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
}

async function withRetry(fn, attempts = 3) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // Don't retry non-transient client errors (wrong key, bad bucket name,
      // file rejected by size/MIME limits…). Retrying them just wastes time.
      if (err && Number.isInteger(err.status) && err.status < 500) break;
      if (i < attempts) await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw lastErr;
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function formatBytes(n) {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/* ── main ────────────────────────────────────────────────────────────────── */

async function main() {
  console.log(`Source      : ${config.sourceUrl}`);
  console.log(`Destination : ${config.destUrl}`);
  console.log(`Mode        : ${config.dryRun ? 'dry-run (no changes)' : config.force ? 'force (overwrite existing)' : 'incremental (skip existing)'}`);
  console.log(`Concurrency : ${config.concurrency}`);
  console.log(`Buckets     : ${config.buckets.length ? config.buckets.join(', ') : 'all'}\n`);

  const srcBuckets = await listBuckets(config.sourceUrl, config.sourceKey);
  if (!srcBuckets.length) {
    console.log('No storage buckets found on the source project. Nothing to do.');
    process.exit(0);
  }

  const selected = config.buckets.length
    ? srcBuckets.filter((b) => config.buckets.includes(b.name))
    : srcBuckets;

  const missingBuckets = config.buckets.filter((n) => !selected.some((b) => b.name === n));
  if (missingBuckets.length) {
    console.warn(`⚠ Bucket(s) not found on source: ${missingBuckets.join(', ')}\n`);
  }
  if (!selected.length) {
    console.log('No buckets to migrate. Check the --bucket names.');
    process.exit(1);
  }

  const destBuckets = await listBuckets(config.destUrl, config.destKey);
  const destByName = new Map(destBuckets.map((b) => [b.name, b]));

  // Ensure every bucket exists on the destination before copying files.
  for (const b of selected) {
    if (destByName.has(b.name)) continue;
    if (config.dryRun) {
      console.log(`[dry-run] would create bucket "${b.name}" (public: ${!!b.public})`);
      continue;
    }
    await createBucket(config.destUrl, config.destKey, b);
    destByName.set(b.name, b);
    console.log(`✓ Created bucket "${b.name}" on destination`);
  }

  let grandTotal = { copied: 0, skipped: 0, failed: 0, bytes: 0 };

  for (const b of selected) {
    const srcFiles = await listAllObjects(config.sourceUrl, config.sourceKey, b.name);
    const destFiles = destByName.has(b.name) && !config.force
      ? await listAllObjects(config.destUrl, config.destKey, b.name)
      : [];
    const destSet = new Set(destFiles.map((f) => f.name));
    const toCopy = srcFiles.filter((f) => !destSet.has(f.name));
    const already = srcFiles.length - toCopy.length;
    const bytes = toCopy.reduce((s, f) => s + (Number(f.metadata?.size) || 0), 0);

    console.log(`\nBucket "${b.name}" — ${srcFiles.length} file(s) on source, ${already} already on destination, ${toCopy.length} to copy (${formatBytes(bytes)})`);

    if (config.dryRun) {
      for (const f of toCopy.slice(0, 50)) console.log(`   ${f.name} (${formatBytes(Number(f.metadata?.size) || 0)})`);
      if (toCopy.length > 50) console.log(`   … and ${toCopy.length - 50} more`);
      continue;
    }

    if (!toCopy.length) {
      grandTotal.skipped += already;
      continue;
    }

    let copied = 0;
    let failed = 0;
    let copiedBytes = 0;
    const failedPaths = [];
    const startedAt = Date.now();

    await mapLimit(toCopy, config.concurrency, async (file) => {
      const mime = mimeFor(file.name, file.metadata?.mimetype);
      try {
        await withRetry(async () => {
          const buf = await downloadObject(config.sourceUrl, config.sourceKey, b.name, file.name);
          await uploadObject(config.destUrl, config.destKey, b.name, file.name, buf, mime);
        });
        copied += 1;
        copiedBytes += Number(file.metadata?.size) || 0;
        console.log(`   ✓ ${file.name} (${formatBytes(Number(file.metadata?.size) || 0)})`);
      } catch (err) {
        failed += 1;
        failedPaths.push(file.name);
        console.error(`   ✗ ${file.name} — ${err.message}`);
      }
    });

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`\n   Done: ${copied} copied (${formatBytes(copiedBytes)}), ${already} skipped, ${failed} failed in ${elapsed}s`);
    if (failedPaths.length) {
      console.error('   Failed files (re-run the script to retry only these):');
      for (const p of failedPaths) console.error(`     - ${p}`);
    }

    grandTotal.copied += copied;
    grandTotal.skipped += already;
    grandTotal.failed += failed;
    grandTotal.bytes += copiedBytes;
  }

  console.log('\n──────────────────────────────────────────────');
  console.log(`Migration finished. Copied: ${grandTotal.copied} (${formatBytes(grandTotal.bytes)}), skipped: ${grandTotal.skipped}, failed: ${grandTotal.failed}.`);
  if (grandTotal.failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('\nMigration aborted:', err.message);
  process.exit(1);
});
