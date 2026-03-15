const ISSUE = window.ISSUE_PATH || "2026/issue1"
const BASE = "issues/" + ISSUE
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

let galleryImages=[]
let zoomViewerOpen=false
let galleryIndex=0
let galleryOverlay=null
let gridStartIndex = 0
let gridActive = false


let currentSlide=1
let currentAudio=null

const pageCache={}
let slideLoadToken=0

let hotspots={}
let hotspotsLoaded=false

let startX=0
let endX=0
let swipeThreshold=120

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

viewer.addEventListener("click",function(e){

if(zoomViewerOpen) return
if(gridActive) return

if(e.clientX > window.innerWidth/2){
nextSlide()
}else{
prevSlide()
}

})


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
first.onload=()=>loadSlide("Slide1")
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
if(zoomViewerOpen) return
if(zoomScale<=1.05){

zoomScale=1
panX=0
panY=0

viewer.style.transform="translate(0px,0px) scale(1)"

}

pinchActive=false

let delta=endX-startX

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

currentSlide=Math.max(1,parseInt(name.replace("Slide","")))

if(currentSlide<1) currentSlide=1
if(currentSlide>window.FLIPBOOK_CONFIG.totalSlides)
currentSlide=window.FLIPBOOK_CONFIG.totalSlides


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

slideImage.src = slideBuffer.src

slideImage.onload = function(){
renderHotspots(currentSlide)
}


const thumbs=document.querySelectorAll("#thumbBar img")

thumbs.forEach((t,i)=>{
if(i+1===currentSlide){
t.style.border="3px solid #00ffe1"
t.style.transform="scale(1.25)"
}else{
t.style.border="2px solid transparent"
t.style.transform="scale(1)"
}
})

document.getElementById("pageNumber").textContent =
currentSlide + " / " + window.FLIPBOOK_CONFIG.totalSlides

localStorage.setItem("lastPage",currentSlide)

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

if(h.type==="audio"){
playAudio(`${BASE}/audio/${h.file}`)
}
})

if(h.type==="icon"){

const icon=document.createElement("img")

icon.src=`${BASE}/icons/${h.file}`

icon.style.width="40px"
icon.style.height="40px"

icon.style.position="absolute"
icon.style.left="50%"
icon.style.top="50%"
icon.style.transform="translate(-50%,-50%)"

icon.style.pointerEvents="none"

box.appendChild(icon)

}

box.addEventListener("click",(e)=>{
e.stopPropagation()
handleAction(h)
})

const handle=document.createElement("div")

handle.style.position="absolute"
handle.style.width="12px"
handle.style.height="12px"
handle.style.background="#fff"
handle.style.border="1px solid black"
handle.style.right="-6px"
handle.style.bottom="-6px"
handle.style.cursor="nwse-resize"


box.appendChild(handle)

let dragging=false
let offsetX=0
let offsetY=0

box.addEventListener("mousedown",(e)=>{

if(e.target===handle) return

dragging=true

offsetX=e.offsetX
offsetY=e.offsetY

})

document.addEventListener("mousemove",(e)=>{

if(!dragging) return

const rect=slideImage.getBoundingClientRect()

let x=(e.clientX-rect.left-offsetX)/rect.width
let y=(e.clientY-rect.top-offsetY)/rect.height

box.dataset.x = x
box.dataset.y = y

box.style.left=(x*100)+"%"
box.style.top=(y*100)+"%"

})

document.addEventListener("mouseup",()=>{

dragging=false

})

handle.addEventListener("mousedown",(e)=>{

e.stopPropagation()

let startW=box.offsetWidth
let startH=box.offsetHeight

let startX=e.clientX
let startY=e.clientY

function resize(ev){

let w=startW+(ev.clientX-startX)
let h=startH+(ev.clientY-startY)

box.style.width=w+"px"
box.style.height=h+"px"

}

function stop(){
document.removeEventListener("mousemove",resize)
document.removeEventListener("mouseup",stop)
}

document.addEventListener("mousemove",resize)
document.addEventListener("mouseup",stop)

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
window.galleryData = await res.json()

}

galleryImages = (window.galleryData[name] || []).map(src => BASE + "/" + src)


galleryIndex = 0

/* pre-cache first 18 */

galleryImages.slice(0,18).forEach(src=>{
let img = new Image()
img.src = src.startsWith("issues") ? src : BASE + "/" + src
})

showGalleryGrid()

}

function showGalleryGrid(){

gridActive = true
gridStartIndex = 0

if(!galleryImages.length) return

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

img.src = galleryImages[galleryIndex]

counter.textContent =
(galleryIndex+1)+" / "+galleryImages.length

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

if(currentSlide >= window.FLIPBOOK_CONFIG.totalSlides) return

slideImage.style.transformOrigin="left center"

slideImage.style.transition="transform .55s cubic-bezier(.22,.61,.36,1)"

slideImage.style.transform="perspective(1600px) rotateY(-60deg)"
slideImage.style.boxShadow="0 0 40px rgba(0,0,0,.5)"

setTimeout(()=>{

slideImage.style.transform="perspective(1400px) rotateY(0deg)"
slideImage.style.boxShadow="0 0 20px rgba(0,0,0,.4)"

loadSlide("Slide"+(currentSlide+1))

},520)

}

function prevSlide(){

if(currentSlide<=1) return

slideImage.style.transformOrigin="right center"

slideImage.style.transition="transform .6s cubic-bezier(.25,.8,.25,1)"

slideImage.style.transform="perspective(1400px) rotateY(60deg)"
slideImage.style.boxShadow="0 0 40px rgba(0,0,0,.5)"

setTimeout(()=>{

slideImage.style.transform="perspective(1400px) rotateY(0deg)"
slideImage.style.boxShadow="0 0 20px rgba(0,0,0,.4)"

loadSlide("Slide"+(currentSlide-1))

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
observer.disconnect()
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

hotspots=await res.json()

hotspotsLoaded=true

}



function renderHotspots(page){

hotspotLayer.innerHTML=""

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

if(e.key==="h" || e.key==="H"){

document.querySelectorAll(".hotspot").forEach(h=>{

h.style.border="4px solid red"
h.style.background="rgba(255,0,0,0.25)"

})


console.log("Hotspot debug mode ON")

}

})

window.addEventListener("resize",function(){

setTimeout(()=>{
renderHotspots(currentSlide)
},120)

})

window.addEventListener("orientationchange",function(){

setTimeout(()=>{
renderHotspots(currentSlide)
},200)

})


console.log("PLAYER JS FULLY LOADED")