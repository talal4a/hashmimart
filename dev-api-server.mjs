// Local-only API server for `npm run dev`. Vercel's `vercel dev` needs a valid
// CLI auth token just to boot; this sidesteps that by running the exact same
// `api/*.js` handlers behind Node's built-in http server. Vite proxies /api here.
//
// Not used in production — Vercel serves api/*.js directly there.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.DEV_API_PORT || 3001)

// Load .env.local then .env into process.env (don't overwrite already-set vars).
function loadEnv(file) {
  const full = path.join(__dirname, file)
  if (!fs.existsSync(full)) return
  const text = fs.readFileSync(full, 'utf8')
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '').trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
}
loadEnv('.env.local')
loadEnv('.env')

// Minimal Express-ish res shim so the Vercel handler signature works unchanged.
function makeRes(nodeRes) {
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code
      return this
    },
    json(obj) {
      const body = JSON.stringify(obj)
      nodeRes.writeHead(this.statusCode, { 'Content-Type': 'application/json' })
      nodeRes.end(body)
      return this
    },
    send(data) {
      nodeRes.writeHead(this.statusCode)
      nodeRes.end(data)
      return this
    },
  }
  return res
}

function readBody(nodeReq) {
  return new Promise((resolve) => {
    const chunks = []
    nodeReq.on('data', (c) => chunks.push(c))
    nodeReq.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve(undefined)
      try {
        resolve(JSON.parse(raw))
      } catch {
        resolve(raw)
      }
    })
    nodeReq.on('error', () => resolve(undefined))
  })
}

const handlerCache = new Map()
async function getHandler(route) {
  if (handlerCache.has(route)) return handlerCache.get(route)
  const file = path.join(__dirname, 'api', `${route}.js`)
  if (!fs.existsSync(file)) return null
  const mod = await import(pathToFileURL(file).href)
  const fn = mod.default
  handlerCache.set(route, fn)
  return fn
}

const server = http.createServer(async (nodeReq, nodeRes) => {
  const url = new URL(nodeReq.url, `http://localhost:${PORT}`)
  const match = url.pathname.match(/^\/api\/([\w-]+)$/)
  if (!match) {
    nodeRes.writeHead(404, { 'Content-Type': 'application/json' })
    nodeRes.end(JSON.stringify({ error: 'Not found' }))
    return
  }

  try {
    const handler = await getHandler(match[1])
    if (!handler) {
      nodeRes.writeHead(404, { 'Content-Type': 'application/json' })
      nodeRes.end(JSON.stringify({ error: `No api/${match[1]}.js` }))
      return
    }
    const body = await readBody(nodeReq)
    const req = { method: nodeReq.method, body, query: Object.fromEntries(url.searchParams), headers: nodeReq.headers }
    await handler(req, makeRes(nodeRes))
  } catch (err) {
    console.error('[dev-api] handler error:', err)
    if (!nodeRes.headersSent) {
      nodeRes.writeHead(500, { 'Content-Type': 'application/json' })
      nodeRes.end(JSON.stringify({ error: String(err?.message || err) }))
    }
  }
})

server.listen(PORT, () => {
  console.log(`[dev-api] serving api/*.js on http://localhost:${PORT}`)
})
