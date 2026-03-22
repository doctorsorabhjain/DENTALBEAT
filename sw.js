const CACHE_NAME = "flipbook-v1"

self.addEventListener("install", e => {
  self.skipWaiting()
})

self.addEventListener("activate", e => {
  clients.claim()
})

self.addEventListener("fetch", event => {

  const url = new URL(event.request.url)

  // ❌ Do NOT cache main page or issue-based URLs
  if (url.pathname === "/" || url.search.includes("issue=")) {
    event.respondWith(fetch(event.request))
    return
  }

  // ✅ Cache other files (images, js, css)
  event.respondWith(
    caches.match(event.request).then(res => {
      return res || fetch(event.request)
    })
  )

})