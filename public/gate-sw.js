// Gate service worker (ADR-0004): lets a Gate phone reopen the gate scanner with
// no connection, after the page has been loaded once online.
//
// Registered by the scanner with scope /gate/, so it only controls gate pages.
//  - Gate pages: network first (short timeout), cached copy if the network fails.
//  - Built JS/CSS (/_next/static) and the QR decoder (/zxing): cache first —
//    their URLs change on every deploy, so a cached copy is never stale.
//  - Everything else (the gate API) goes straight to the network: scans and
//    uploads must never be answered from a cache.

const PAGES = 'gate-pages-v1'
const ASSETS = 'gate-assets-v1'
const PAGE_TIMEOUT_MS = 4000
const MAX_ASSETS = 300

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = [PAGES, ASSETS]
    for (const key of await caches.keys()) {
      if (key.startsWith('gate-') && !keep.includes(key)) await caches.delete(key)
    }
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate' && url.pathname.startsWith('/gate/')) {
    event.respondWith(gatePage(req))
  } else if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/zxing/')) {
    event.respondWith(asset(req))
  }
})

async function gatePage(req) {
  const cache = await caches.open(PAGES)
  try {
    const res = await withTimeout(fetch(req), PAGE_TIMEOUT_MS)
    // Only keep a real gate page — not a redirect to the login page.
    if (res.ok && !res.redirected) await cache.put(req, res.clone())
    return res
  } catch {
    const cached = await cache.match(req)
    if (cached) return cached
    return new Response(
      '<!doctype html><meta name="viewport" content="width=device-width"><body style="background:#000;color:#fff;font-family:sans-serif;padding:24px">' +
      '<h1>No connection</h1><p>This gate page has not been opened on this phone while online, so it can\'t open offline. Connect and open the gate link once.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }
}

async function asset(req) {
  const cache = await caches.open(ASSETS)
  const cached = await cache.match(req)
  if (cached) return cached
  const res = await fetch(req)
  if (res.ok) {
    await cache.put(req, res.clone())
    void trim(cache)
  }
  return res
}

// Old deploys' files pile up; drop the oldest once there are too many.
async function trim(cache) {
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - MAX_ASSETS; i++) await cache.delete(keys[i])
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(v => { clearTimeout(t); resolve(v) }, e => { clearTimeout(t); reject(e) })
  })
}

// Sign-out: forget cached gate pages.
self.addEventListener('message', event => {
  if (event.data === 'clear-gate-pages') event.waitUntil(caches.delete(PAGES))
})
