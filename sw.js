const CACHE="flipbook-v1"

self.addEventListener("install",e=>{
self.skipWaiting()
})

self.addEventListener("activate",e=>{
self.clients.claim()
})

self.addEventListener("fetch", event => {

event.respondWith(

fetch(event.request, { cache: "no-store" })
.catch(()=> caches.match(event.request))
)

})