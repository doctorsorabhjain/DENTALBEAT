self.addEventListener("fetch", event => {

  const url = new URL(event.request.url)

  // ❌ NEVER cache index.html or query-based requests
  if (url.pathname === "/" || url.search.includes("issue=")) {
    event.respondWith(fetch(event.request))
    return
  }

  // ✅ cache only static assets
  event.respondWith(
    caches.match(event.request).then(res => {
      return res || fetch(event.request)
    })
  )

})