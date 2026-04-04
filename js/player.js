const ISSUE = window.ISSUE_PATH || "2026/issue1"
const BASE = "issues/" + ISSUE


// ✅ ADD THIS HERE (exact position)
function deepClean(data){
    return data
}

console.log("Flipbook engine loaded:",ISSUE)

const style = document.createElement("style")

style.innerHTML = `


.galleryViewer{
position:fixed;
top:0;
left:0;
width:100vw;
height:100vh;
background:black;
display:flex;
align-items:center;
justify-content:center;
z-index:9999;
}

.galleryViewer img{
max-width:100%;
max-height:100%;
object-fit:contain;
}

.galleryPopup{
position:fixed;
top:0;
left:0;
width:100vw;
height:100vh;
display:flex;
align-items:center;
justify-content:center;
background:rgba(0,0,0,0.85);
z-index:9000;
}

.galleryGrid{
display:grid;
grid-template-columns:repeat(3,1fr);
gap:8px;
max-width:520px;
}

.galleryGrid img{
width:100%;
border-radius:6px;
cursor:pointer;
}`

document.head.appendChild(style)


window.FLIPBOOK_CONFIG = window.FLIPBOOK_CONFIG || {
totalSlides: 1
}

let slideImage
let hotspotLayer
let slideBuffer
let videoPopup
let videoContainer
let viewer
let lastRenderedPage = null

let galleryImages=[]
let zoomViewerOpen=false
let galleryIndex=0
let galleryOverlay=null
let gridStartIndex = 0
let gridActive = false
let leftArrow
let rightArrow

window.currentSlide=1

window.currentSlide = 1

// 🔥 ADD THIS EXACT BLOCK HERE
Object.defineProperty(window, "currentpage", {
  get() {
    return window.currentPage;
  }
});

let currentAudio=null
let audioUnlocked=false

document.addEventListener("click",()=>{
if(audioUnlocked) return
audioUnlocked=true
new Audio().play().catch(()=>{})
})

const pageCache={}
let slideLoadToken=0

let hotspots={}
let hotspotsLoaded=false

let startX=0
let endX=0
let swipeThreshold=180

let zoomScale=1
let pinchStartDist=0
let pinchActive=false

let panX=0
let panY=0
let lastTouchX=0
let lastTouchY=0

async function detectSlides(){

let count=1

while(true){

try{

let res=await fetch(`${BASE}/pages/${count}.jpg`,{method:"HEAD"})

if(!res.ok) break

count++

}catch(e){
break
}

}

return count-1

}

window.safeInit = function(){

console.log("SAFE INIT RUNNING")

/* wait until config.js has loaded */

if(!window.FLIPBOOK_CONFIG || window.FLIPBOOK_CONFIG.totalSlides === 1){
setTimeout(safeInit,50)
return
}

/* wait until DOM is ready */

if(!document.getElementById("slideImage")){
setTimeout(safeInit,50)
return
}

console.log("CONFIG READY:",window.FLIPBOOK_CONFIG)

startViewer()

}



function startViewer(){

slideImage=document.getElementById("slideImage")
hotspotLayer=document.getElementById("hotspotLayer")
viewer=document.getElementById("viewer")

videoPopup=document.getElementById("videoPopup")
videoContainer=document.getElementById("videoContainer")

slideBuffer=new Image()
slideBuffer.decoding="async"
slideBuffer.loading="eager"

viewer.style.transform="scale(1)"


if(!("ontouchstart" in window)){
viewer.addEventListener("click",function(e){

    // 🚫 VERY IMPORTANT → STOP if hotspot clicked
    if(e.target.closest(".hotspot")) return

    if(zoomViewerOpen) return
    if(gridActive) return

    const margin = window.innerWidth * 0.15  // safe zone

    // 🚫 ignore edge clicks (mobile conflict)
    if(e.clientX < margin || e.clientX > window.innerWidth - margin){
        return
    }

    if(e.clientX > window.innerWidth/2){
        nextSlide()
    }else{
        prevSlide()
    }

})
}


viewer.addEventListener("touchstart",touchStart,{passive:true})
viewer.addEventListener("touchmove",touchMove,{passive:true})
viewer.addEventListener("touchend",touchEnd,{passive:true})

videoPopup.onclick=function(e){
if(e.target===videoPopup){
stopVideo()
}
}

buildFilmstrip()

loadHotspots().then(()=>{

let firstSlides=["Slide1","Slide2","Slide3"]

firstSlides.forEach(s=>{
cacheSlide(s)
})

let first=pageCache["Slide1"]

if(first && first.complete){
let last=localStorage.getItem("lastPage") || "1"
loadSlide("Slide"+last)
}else{
let last=localStorage.getItem("lastPage") || "1"
first.onload=()=>loadSlide("Slide"+last)
}

})

history.pushState({viewer:true},"")

window.addEventListener("popstate",function(){

if(zoomViewerOpen){
document.querySelector(".galleryViewer")?.remove()
zoomViewerOpen=false
history.pushState({viewer:true},"")
return
}

if(galleryOverlay){
galleryOverlay.remove()
galleryOverlay=null
history.pushState({viewer:true},"")
return
}

if(!videoPopup.classList.contains("hidden")){
stopVideo()
history.pushState({viewer:true},"")
return
}

})

}


function touchStart(e){

// 🚫 ADD THIS BLOCK (FIRST LINE INSIDE FUNCTION)
    if(e.target.closest(".hotspot")){
        startX = 0
        endX = 0
        return
    }

if(e.touches.length===1){

startX=e.touches[0].clientX
lastTouchX=e.touches[0].clientX
lastTouchY=e.touches[0].clientY

}

if(e.touches.length===2){

pinchActive=true

const dx=e.touches[0].clientX-e.touches[1].clientX
const dy=e.touches[0].clientY-e.touches[1].clientY

pinchStartDist=Math.hypot(dx,dy)

}

}



function touchMove(e){

if(pinchActive && e.touches.length===2){

const dx=e.touches[0].clientX-e.touches[1].clientX
const dy=e.touches[0].clientY-e.touches[1].clientY

const dist=Math.hypot(dx,dy)

zoomScale=Math.min(3,Math.max(1,dist/pinchStartDist))

viewer.style.transform=`translate(${panX}px,${panY}px) scale(${zoomScale})`

return
}

if(zoomScale>1 && e.touches.length===1){

const x=e.touches[0].clientX
const y=e.touches[0].clientY

panX+=x-lastTouchX
panY+=y-lastTouchY

viewer.style.transform=`translate(${panX}px,${panY}px) scale(${zoomScale})`

lastTouchX=x
lastTouchY=y

return
}

endX=e.touches[0].clientX

}



function touchEnd(){

    // 🚫 ADD THIS LINE
    if(startX === 0 && endX === 0) return

  if(e.target && e.target.closest(".hotspot")) return

if(zoomViewerOpen) return
if(zoomScale<=1.05){

zoomScale=1
panX=0
panY=0

viewer.style.transform="translate(0px,0px) scale(1)"


}

pinchActive=false

let delta=endX-startX


// 🚫 ignore tiny movement (tap noise)
if(Math.abs(delta) < 60) return

if(zoomScale>1 || Math.abs(delta)<swipeThreshold) return

if(delta<0){
slideImage.style.transform="translateX(-100%)"

setTimeout(()=>{
slideImage.style.transform="translateX(0)"
nextSlide()
},150)

}else{
slideImage.style.transform="translateX(100%)"

setTimeout(()=>{
slideImage.style.transform="translateX(0)"
prevSlide()
},150)
}

}



function stopAudio(){

if(currentAudio){
currentAudio.pause()
currentAudio.currentTime=0
currentAudio=null
}

}



function stopVideo(){

videoContainer.innerHTML=""
videoPopup.classList.add("hidden")

}



function stopAll(){

stopAudio()
stopVideo()

}



function getSlideSrc(name){

return `${BASE}/pages/${name.replace("Slide","")}.jpg`

}


const MAX_CACHE = 10

function cacheSlide(name){

if(pageCache[name]) return

const keys = Object.keys(pageCache)

if(keys.length > MAX_CACHE){

delete pageCache[keys[0]]

}

const img=new Image()
img.src=getSlideSrc(name)

img.decoding="async"
img.loading="eager"

pageCache[name]=img
}

function loadSlide(name){

slideLoadToken++
const token=slideLoadToken

stopAll()

window.currentSlide = Math.max(1, parseInt(name.replace("Slide","")))

// 🔥 CORRECT PAGE TRACKING
window.currentPage = "page_" + window.currentSlide

// ✅ alias for safety (case-insensitive support)
window.currentpage = window.currentPage


if (window.send) {
    window.send("page_view");
}

// ✅ FIX: ALWAYS use window.currentSlide
if(window.currentSlide < 1) window.currentSlide = 1

if(window.currentSlide > window.FLIPBOOK_CONFIG.totalSlides){
    window.currentSlide = window.FLIPBOOK_CONFIG.totalSlides
}

/* safety check */

if(currentSlide<1) currentSlide=1

if(currentSlide>window.FLIPBOOK_CONFIG.totalSlides){
currentSlide=window.FLIPBOOK_CONFIG.totalSlides
}

let img=pageCache[name]

if(!img){

img=new Image()
img.src=getSlideSrc(name)

pageCache[name]=img

}

const showSlide=()=>{

if(token!==slideLoadToken) return

slideImage.style.transition="none"

slideBuffer.src=img.src

slideBuffer.decode?.().catch(()=>{})

requestAnimationFrame(()=>{

slideImage.classList.remove("loaded")

slideImage.src = slideBuffer.src

slideImage.onload = function(){

slideImage.onload = null   // ✅ ADD THIS LINE (FIRST LINE)

slideImage.classList.add("loaded")

slideImage.style.willChange="auto"

renderHotspots(window.currentSlide)

}

const thumbs=document.querySelectorAll("#thumbBar img")

thumbs.forEach((t,i)=>{
if(i+1===window.currentSlide){
t.style.border="3px solid #00ffe1"
t.style.transform="scale(1.25)"
}else{
t.style.border="2px solid transparent"
t.style.transform="scale(1)"
}
})

/* auto-scroll filmstrip to active page */

const activeThumb = thumbs[window.currentSlide-1]

if(activeThumb){

activeThumb.scrollIntoView({
behavior:"smooth",
inline:"center",
block:"nearest"
})

}

document.getElementById("pageNumber").textContent =
window.currentSlide + " / " + window.FLIPBOOK_CONFIG.totalSlides

localStorage.setItem("lastPage",window.currentSlide)

slideImage.style.transition="transform .45s cubic-bezier(.22,.61,.36,1)"

})


}

/* predictive preload */

for(let i=1;i<=6;i++){

let next=currentSlide+i
let prev=currentSlide-i

if(next<=window.FLIPBOOK_CONFIG.totalSlides){
cacheSlide("Slide"+next)
}

if(prev>0){
cacheSlide("Slide"+prev)
}

}

/* immediate next-slide preload */

let fastNext = currentSlide + 1

if(fastNext <= window.FLIPBOOK_CONFIG.totalSlides){

let imgFast = new Image()
imgFast.src = getSlideSrc("Slide"+fastNext)

}

/* image ready */

if(img.complete){
showSlide()
}else{
img.onload=showSlide
}

}

function createHotspot(h){

console.log("Render hotspot:",h)

const box=document.createElement("div")

box.className="hotspot"

box.dataset.x = h.x
box.dataset.y = h.y
box.dataset.w = h.w
box.dataset.h = h.h

box.style.left=(h.x*100)+"%"
box.style.top=(h.y*100)+"%"
box.style.width=(h.w*100)+"%"
box.style.height=(h.h*100)+"%"

if(h.type==="audio"){
box.addEventListener("mouseenter",()=>{
playAudio(`${BASE}/audio/${h.file}`)
})
}

box.addEventListener("touchstart",(e)=>{
e.stopPropagation()

   // ✅ ONLY for audio_click
    if(h.type === "audio_click"){
        stopAudio()

        const audio = new Audio(`${BASE}/audio/${h.file}`)
        audio.playsInline = true

        // 🔥 critical: NO async chain, NO reuse
        audio.play()

        currentAudio = audio
        return
    }


if(h.type==="audio"){
playAudio(`${BASE}/audio/${h.file}`)
}
})

if(h.type==="icon"){

const icon=document.createElement("img")

icon.src=`${BASE}/icons/${h.file}`

icon.style.width="min(40px, 6vw)"
icon.style.height="min(40px, 6vw)"

icon.style.position="absolute"
icon.style.left="50%"
icon.style.top="50%"
icon.style.transform="translate(-50%,-50%)"

icon.style.pointerEvents="none"

box.style.opacity = 1   // ✅ ONLY FOR ICON TYPE
box.appendChild(icon)

}

box.addEventListener("click",(e)=>{
e.stopPropagation()

handleAction(h)
})


hotspotLayer.appendChild(box)

}   // CLOSE createHotspot()

function handleAction(h){

const action = h.type || h.action

stopAll()

if(action==="jump"){
loadSlide("Slide"+h.target)
}

if(action==="back"){
loadSlide("Slide"+h.target)
}

if(action==="audio"){
playAudio(`${BASE}/audio/${h.file}`)
}

if(action==="audio_click"){
playAudio(`${BASE}/audio/${h.file}`)
}

if(action==="video"){
openVideo(h.file || h.target)
}

if(action==="zoom"){
openZoomGallery(h.file)
}

if(action==="gallery"){
openGallery(h.file)
}

if(action==="external"){
window.open(h.target,"_blank")
}

}

function openImagePopup(src){

let overlay=document.createElement("div")
overlay.className="imagePopup"

let img=document.createElement("img")
img.loading="lazy"
img.src=src

overlay.appendChild(img)

overlay.onclick=function(){
overlay.remove()
}

document.body.appendChild(overlay)

}

function openZoomGallery(file){

let parts=file.split("/")
let folder=parts[0]
let start=parseInt(parts[1])

let images=[]
let i=1

function loadNext(){

let src=`${BASE}/gallery/${folder}/${i}.jpg`

let img=new Image()

img.onload=function(){

images.push(src)

/* show first images immediately */

if(images.length===3){
galleryImages=images
galleryIndex=start-1
openGalleryViewer()
}

i++
loadNext()

}

img.onerror=function(){

galleryImages=images

if(!zoomViewerOpen){
galleryIndex=start-1
openGalleryViewer()
}

}

img.src=src

}



loadNext()

}

let lastAudio=null

function playAudio(src){

    if(lastAudio===src) return

    lastAudio=src

    stopAudio()

    currentAudio=new Audio(src)

    currentAudio.play().catch(()=>{

        console.log("Audio blocked until user interaction")

        // 🔥 RETRY AFTER USER UNLOCK
      const audioRef = currentAudio

const retry = () => {
    document.removeEventListener("click", retry)

    if(audioRef){
        audioRef.play().catch(()=>{})
    }
}

        document.addEventListener("click", retry)

    })

}


function openVideo(url){

videoPopup.classList.remove("hidden")

let id=url

if(url.includes("youtube")){

let m = url.match(/(?:v=|youtu\.be\/|embed\/)([^&?]+)/)

if(m){
id = m[1]
}

}

videoContainer.innerHTML=
`<div class="videoClose">✕</div>
<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1"
frameborder="0"
allow="autoplay; fullscreen"
allowfullscreen></iframe>`
document.querySelector(".videoClose").onclick=function(){
stopVideo()
}

}

async function openGallery(name){

if(!window.galleryData){

let res = await fetch(`${BASE}/gallery.json`)
window.galleryData = deepClean(await res.json())

}

galleryImages = (window.galleryData[name] || []).map(src => BASE + "/" + src)


galleryIndex = 0

/* pre-cache loads one every 120ms */

function preloadGalleryStream(){

let index=0

function loadNext(){

if(index>=galleryImages.length) return

let img=new Image()

img.onload=function(){
index++
setTimeout(loadNext,120)
}

img.src=galleryImages[index]

}

loadNext()

}

preloadGalleryStream()


showGalleryGrid()

}

function showGalleryGrid(){

gridActive = true
gridStartIndex = 0

if(!galleryImages.length) {

alert("Images not loading. Tap Refresh button.")

return
}

galleryOverlay=document.createElement("div")
galleryOverlay.className="galleryPopup"

let sx=0

galleryOverlay.addEventListener("touchstart",e=>{
sx=e.touches[0].clientX
})

galleryOverlay.addEventListener("touchend",e=>{
let ex=e.changedTouches[0].clientX
if(ex-sx < -40) nextGrid()
if(ex-sx > 40) prevGrid()
})

const grid=document.createElement("div")
grid.className="galleryGrid"

/* show first 9 */

galleryImages.slice(gridStartIndex,gridStartIndex+9).forEach((src,i)=>{


let img=document.createElement("img")
img.loading="lazy"
img.src = src

img.onclick=function(e){
e.stopPropagation()
galleryIndex=i
openGalleryViewer()
}

grid.appendChild(img)

})

galleryOverlay.appendChild(grid)

/* grid arrows */

leftArrow=document.createElement("div")
leftArrow.className="galleryArrow left"
leftArrow.innerHTML="‹"
leftArrow.onclick=(e)=>{
e.stopPropagation()
prevGrid()
}

rightArrow=document.createElement("div")
rightArrow.className="galleryArrow right"
rightArrow.innerHTML="›"
rightArrow.onclick=(e)=>{
e.stopPropagation()
nextGrid()
}

galleryOverlay.appendChild(leftArrow)
galleryOverlay.appendChild(rightArrow)

refreshGrid()

galleryOverlay.onclick=function(){
galleryOverlay.remove()
galleryOverlay=null
gridActive=false
}

document.body.appendChild(galleryOverlay)

}

function refreshGrid(){

if(!galleryOverlay) return

const grid = galleryOverlay.querySelector(".galleryGrid")

grid.style.transition="transform .35s ease"
grid.style.transform="translateX(-40px)"
grid.style.opacity="0"

setTimeout(()=>{
grid.innerHTML=""

/* grid arrow visibility */

if(gridStartIndex===0){
leftArrow.style.opacity="0.25"
}else{
leftArrow.style.opacity="1"
}

if(gridStartIndex+9>=galleryImages.length){
rightArrow.style.opacity="0.25"
}else{
rightArrow.style.opacity="1"
}


galleryImages.slice(gridStartIndex,gridStartIndex+9).forEach((src,i)=>{

let img=document.createElement("img")
img.loading="lazy"
img.src=src

img.onclick=function(e){
e.stopPropagation()
galleryIndex=gridStartIndex+i
openGalleryViewer()
}

grid.appendChild(img)

})

grid.style.transform="translateX(0)"
grid.style.opacity="1"

},120)

}

function nextGrid(){

if(gridStartIndex+9 >= galleryImages.length) return

gridStartIndex += 9
refreshGrid()

}

function prevGrid(){

if(gridStartIndex === 0) return

gridStartIndex -= 9
refreshGrid()

}


function openGalleryViewer(){

if(galleryOverlay) galleryOverlay.remove()

let viewer=document.createElement("div")
zoomViewerOpen=true
viewer.className="galleryViewer"

viewer.addEventListener("touchstart",e=>e.stopPropagation())
viewer.addEventListener("touchmove",e=>e.stopPropagation())
viewer.addEventListener("touchend",e=>e.stopPropagation())
viewer.addEventListener("click",e=>e.stopPropagation())

let img=document.createElement("img")
viewer.appendChild(img)

let close=document.createElement("div")

close.innerHTML="✕"
close.style.position="absolute"
close.style.top="20px"
close.style.right="20px"
close.style.fontSize="30px"
close.style.color="white"
close.style.cursor="pointer"

close.onclick=function(){
zoomViewerOpen=false
viewer.remove()
}

viewer.appendChild(close)

let left=document.createElement("div")
left.className="galleryArrow left"
left.innerHTML="‹"
left.onclick=(e)=>{
e.stopPropagation()
prev()
}

let right=document.createElement("div")
right.className="galleryArrow right"
right.innerHTML="›"
right.onclick=(e)=>{
e.stopPropagation()
next()
}

viewer.appendChild(left)
viewer.appendChild(right)

/* FIGURE THUMBNAIL STRIP */

let strip=document.createElement("div")
strip.style.position="absolute"
strip.style.bottom="10px"
strip.style.left="50%"
strip.style.transform="translateX(-50%)"
strip.style.display="flex"
strip.style.gap="6px"
strip.style.maxWidth="90%"
strip.style.overflowX="auto"

galleryImages.forEach((src,i)=>{
let t=document.createElement("img")
t.src = src.startsWith("issues") ? src : BASE + "/" + src
t.style.height="60px"
t.style.cursor="pointer"
t.onclick=function(){
galleryIndex=i
show()
}
strip.appendChild(t)
})

viewer.appendChild(strip)


/* image counter */

let counter=document.createElement("div")
counter.style.position="absolute"
counter.style.bottom="20px"
counter.style.right="20px"
counter.style.color="white"
counter.style.fontSize="16px"
counter.style.fontFamily="Arial"

viewer.appendChild(counter)

document.body.appendChild(viewer)


function show(){

if(!galleryImages[galleryIndex]) return

img.src = galleryImages[galleryIndex]

counter.textContent =
(galleryIndex+1)+" / "+galleryImages.length

/* hide arrows when limits reached */

if(galleryIndex===0){
left.style.opacity="0.25"
}else{
left.style.opacity="1"
}

if(galleryIndex===galleryImages.length-1){
right.style.opacity="0.25"
}else{
right.style.opacity="1"
}

preload()

}

function next(){

if(galleryIndex < galleryImages.length-1){
galleryIndex++
show()
}

}

function prev(){

if(galleryIndex > 0){
galleryIndex--
show()
}

}

function preload(){

for(let i=1;i<=4;i++){

let p=galleryIndex+i

if(p >= galleryImages.length) break

let im=new Image()
im.src = galleryImages[p].startsWith("issues")
? galleryImages[p]
: BASE + "/" + galleryImages[p]


}

}

/* swipe navigation */

let startX=0

viewer.addEventListener("touchstart",e=>{
startX=e.touches[0].clientX
})

viewer.addEventListener("touchend",e=>{

let endX=e.changedTouches[0].clientX

if(endX-startX < -40) next()
if(endX-startX > 40) prev()

})

/* click navigation */

viewer.addEventListener("click",function(e){

if(e.clientX > window.innerWidth/2){
next()
}else{
prev()
}

})

/* keyboard navigation */

function zoomKeyHandler(e){

if(e.key==="ArrowRight") next()
if(e.key==="ArrowLeft") prev()

if(e.key==="Escape"){
zoomViewerOpen=false
viewer.remove()
document.removeEventListener("keydown",zoomKeyHandler)

if(gridActive) showGalleryGrid()
}


}

document.addEventListener("keydown",zoomKeyHandler)



/* close */
viewer.addEventListener("dblclick",()=>{
zoomViewerOpen=false
viewer.remove()
document.removeEventListener("keydown",zoomKeyHandler)

if(gridActive) showGalleryGrid()
})



show()

}



function nextSlide(){

slideImage.style.willChange="transform"

if(window.currentSlide >= window.FLIPBOOK_CONFIG.totalSlides) return

slideImage.style.transformOrigin="left center"

slideImage.style.transition="transform .55s cubic-bezier(.22,.61,.36,1)"

slideImage.style.transform="perspective(1600px) rotateY(-50deg)"
slideImage.style.boxShadow="0 0 40px rgba(0,0,0,.5)"

setTimeout(()=>{

slideImage.style.transform="perspective(1400px) rotateY(0deg)"
slideImage.style.boxShadow="0 0 20px rgba(0,0,0,.4)"

loadSlide("Slide"+(window.currentSlide+1))

},520)

}

function prevSlide(){

slideImage.style.willChange="transform"

if(window.currentSlide<=1) return

slideImage.style.transformOrigin="right center"

slideImage.style.transition="transform .6s cubic-bezier(.25,.8,.25,1)"

slideImage.style.transform="perspective(1400px) rotateY(50deg)"
slideImage.style.boxShadow="0 0 40px rgba(0,0,0,.5)"

setTimeout(()=>{

slideImage.style.transform="perspective(1400px) rotateY(0deg)"
slideImage.style.boxShadow="0 0 20px rgba(0,0,0,.4)"

loadSlide("Slide"+(window.currentSlide-1))

},520)

}




window.nextSlide=nextSlide
window.prevSlide=prevSlide



function buildFilmstrip(){

const bar=document.getElementById("thumbBar")

for(let i=1;i<=window.FLIPBOOK_CONFIG.totalSlides;i++){

let img=document.createElement("img")

img.loading="lazy"
img.dataset.src=getSlideSrc("Slide"+i)

/* lazy load */

const observer=new IntersectionObserver(entries=>{
entries.forEach(entry=>{
if(entry.isIntersecting){
img.src=img.dataset.src
observer.unobserve(img)
}
})
})

observer.observe(img)

img.onclick=function(){
loadSlide("Slide"+i)
}

bar.appendChild(img)

}

}

async function loadHotspots(){

if(hotspotsLoaded) return

let res=await fetch(`${BASE}/hotspots.json`)

hotspots = deepClean(await res.json())

hotspotsLoaded=true

}



function renderHotspots(page){

if(lastRenderedPage === page){
    return
}

lastRenderedPage = page

hotspotLayer.innerHTML=""

// ✅ SCALE HOTSPOTS TO IMAGE ONLY (CRITICAL FIX)

// ✅ REAL FIX → use natural image ratio (immune to border / CSS)

const viewerRect = viewer.getBoundingClientRect()

const naturalW = slideImage.naturalWidth
const naturalH = slideImage.naturalHeight

// rendered image size inside viewer (object-fit: contain logic)
let renderW = viewerRect.width
let renderH = viewerRect.width * (naturalH / naturalW)

if(renderH > viewerRect.height){
    renderH = viewerRect.height
    renderW = viewerRect.height * (naturalW / naturalH)
}

// center offset
const offsetX = (viewerRect.width - renderW) / 2
const offsetY = (viewerRect.height - renderH) / 2

// scale relative to viewer
const scaleX = renderW / viewerRect.width
const scaleY = renderH / viewerRect.height

hotspotLayer.style.transform = `
translate(${offsetX}px, ${offsetY}px)
scale(${scaleX}, ${scaleY})
`

hotspotLayer.style.transformOrigin = "top left"


const list = hotspots[String(page)] || []

let galleryFolder = null

for(let i=0;i<list.length;i++){

console.log("HOTSPOT:",list[i])
createHotspot(list[i])

/* AUTO AUDIO ON SLIDE LOAD */
if(list[i].type === "audio"){
setTimeout(()=>{
playAudio(`${BASE}/audio/${list[i].file}`)
},400)
}

/* detect gallery hotspot automatically */

if(list[i].type === "gallery" && list[i].file){
galleryFolder = list[i].file
}

}

/* if gallery exists on this page, show grid automatically */

if(galleryFolder){

setTimeout(()=>{
openGallery(galleryFolder)
},120)

}

}


document.addEventListener("keydown",function(e){

if(e.key==="c" || e.key==="C"){
console.log("Cached slides:",Object.keys(pageCache))
}

})

document.addEventListener("keydown",function(e){
if(zoomViewerOpen) return
if(gridActive){
if(e.key==="ArrowRight") nextGrid()
if(e.key==="ArrowLeft") prevGrid()
return
}
if(e.key==="ArrowRight") nextSlide()
if(e.key==="ArrowLeft") prevSlide()
})

document.addEventListener("keydown",function(e){


})

window.addEventListener("resize",function(){

 // do nothing (prevent re-render flicker)

})

window.addEventListener("orientationchange",function(){

 // do nothing

})


console.log("PLAYER JS FULLY LOADED")