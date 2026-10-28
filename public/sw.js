/*
 * Keeps the POS available without internet. When installed it downloads the whole app (the list
 * precache.json is written by the build, see scripts/precache.mjs); each build registers it with its own
 * ?v=, so a new version replaces the old one and its files. Pages come from the network when there
 * is one and from the cache otherwise; the app's files, from the cache. Calls to Falco's API are
 * never cached: the app keeps its own data (IndexedDB).
 */
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev'
const CACHE = `falco-pos-${VERSION}`
const SHELL = '/'

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    let files = []
    try {
      const response = await fetch('/precache.json', { cache: 'no-store' })
      files = response.ok ? await response.json() : []
    } catch {
      files = []
    }
    await cache.addAll([SHELL, '/manifest.webmanifest', ...files.map(file => `/${file}`)])
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter(name => name.startsWith('falco-pos-') && name !== CACHE).map(name => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return
  }
  if (request.mode === 'navigate') {
    // Every route is the same single-page app
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        if (response.ok) {
          const cache = await caches.open(CACHE)
          await cache.put(SHELL, response.clone())
        }
        return response
      } catch {
        return (await caches.match(SHELL)) || Response.error()
      }
    })())
    return
  }
  event.respondWith((async () => {
    const cached = await caches.match(request)
    if (cached) {
      return cached
    }
    const response = await fetch(request)
    if (response.ok && (url.pathname.startsWith('/_nuxt/') || url.pathname.startsWith('/_fonts/'))) {
      const cache = await caches.open(CACHE)
      await cache.put(request, response.clone())
    }
    return response
  })())
})
