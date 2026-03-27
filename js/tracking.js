const TRACK_URL = "https://tracker-worker.1893jefy.workers.dev";

// persistent user id
let user_id = localStorage.getItem("uid");
if (!user_id) {
  user_id = crypto.randomUUID();
  localStorage.setItem("uid", user_id);
}

// session id
let session_id = sessionStorage.getItem("sid");
if (!session_id) {
  session_id = crypto.randomUUID();
  sessionStorage.setItem("sid", session_id);
}

function getPage() {
  return window.currentPage || "unknown";
}

const ENV = location.hostname.includes("localhost") ? "local" : "live";

function send(type, data = {}) {

  fetch(TRACK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type,
      page: getPage(),
      data: {
        user_id,
        session_id,
        ...data
      }
    })
  }).catch(err => console.log("Tracking failed:", err));
}

window.send = send;

// PAGE VIEW
window.addEventListener("load", () => {

  let tries = 0;

  const wait = setInterval(() => {

    console.log("WAITING FOR PAGE...", window.currentPage);

    if (window.currentPage && window.currentPage !== "unknown") {
      console.log("SENDING PAGE:", window.currentPage);
      send("page_view");
      clearInterval(wait);
    }

    tries++;

    if (tries > 20) {
      console.log("FORCED SEND");
      send("page_view");
      clearInterval(wait);
    }

  }, 100);

});


// TIME SPENT (more reliable)
let start = Date.now();

window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    navigator.sendBeacon(
      TRACK_URL,
      JSON.stringify({
        type: "time_spent",
        page: getPage(),
        data: {
          user_id,
          session_id,
          duration: Date.now() - start
        }
      })
    );
  }
});

// CLICK TRACKING
document.addEventListener("click", (e) => {
  if (e.target && e.target.classList && e.target.classList.contains("hotspot")) {
    send("ad_click", {
      hotspot_id: e.target.id
    });
  }
});

// 🔥 PAGE TIME TRACKING (SAFE ADD-ON)

let pageStartTime = Date.now();
let lastPageTracked = null;

setInterval(() => {

  if (!window.currentPage) return;

  // first time init
  if (!lastPageTracked) {
    lastPageTracked = window.currentPage;
    pageStartTime = Date.now();
    return;
  }

  // page changed
  if (window.currentPage !== lastPageTracked) {

    const duration = Date.now() - pageStartTime;

console.log("SENDING PAGE TIME:", {
  page: lastPageTracked,
  duration: duration
});

fetch(TRACK_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    type: "page_time",
    page: lastPageTracked,
    data: {
      user_id: user_id,
      session_id: session_id,
      duration: Number(duration)

    }
  })
});

    // reset
    pageStartTime = Date.now();
    lastPageTracked = window.currentPage;
  }

}, 1000);