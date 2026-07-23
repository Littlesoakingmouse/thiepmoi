const params = new URLSearchParams(window.location.search);
const invitedName = (params.get("guest") || params.get("name") || "").trim();
const inviteeName = document.querySelector("#inviteeName");
const guestNameInput = document.querySelector("#guestNameInput");
const music = document.querySelector("#bgMusic");
const musicToggle = document.querySelector("#musicToggle");
const albumTrack = document.querySelector("#albumTrack");
const albumView = document.querySelector(".album-view");
const thumbButtons = Array.from(document.querySelectorAll(".thumbs button"));
const prevButton = document.querySelector(".album-nav.prev");
const nextButton = document.querySelector(".album-nav.next");
const rsvpForm = document.querySelector("#rsvpForm");
const formStatus = document.querySelector(".form-status");
const RSVPS_KEY = "graduation-rsvps";
const ALBUM_AUTO_DELAY = 3600;
const ALBUM_SLIDE_GAP = 14;
const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false;
let albumIndex = 0;
let albumAutoTimer;
let isAlbumVisible = !albumView;
let apiAvailable = window.location.protocol !== "file:";

if (invitedName) {
  if (inviteeName) inviteeName.textContent = invitedName;
  if (guestNameInput) guestNameInput.value = invitedName;
}

function newId() {
  return globalThis.crypto?.randomUUID?.() || String(Date.now());
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) throw new Error(`API error ${response.status}`);
  if (response.status === 204) return null;
  return response.json();
}

function getSavedRsvps() {
  try {
    return JSON.parse(localStorage.getItem(RSVPS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRsvpLocal(entry) {
  const rsvps = getSavedRsvps();
  rsvps.unshift(entry);
  localStorage.setItem(RSVPS_KEY, JSON.stringify(rsvps));
  localStorage.setItem("graduation-rsvp", JSON.stringify(entry));
}

async function saveRsvp(entry) {
  try {
    if (apiAvailable) {
      const savedEntry = await apiRequest("/api/rsvps", {
        method: "POST",
        body: JSON.stringify(entry),
      });
      saveRsvpLocal(savedEntry);
      return;
    }
  } catch {
    apiAvailable = false;
  }

  saveRsvpLocal(entry);
}

function setAlbum(index, options = {}) {
  if (!albumTrack || thumbButtons.length === 0) return;
  albumIndex = (index + thumbButtons.length) % thumbButtons.length;
  const active = thumbButtons[albumIndex];
  albumTrack.style.transform = `translate3d(calc(${-albumIndex * 100}% - ${albumIndex * ALBUM_SLIDE_GAP}px), 0, 0)`;
  thumbButtons.forEach((button) => button.classList.toggle("active", button === active));
  active.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  if (options.userAction) restartAlbumAutoScroll();
}

function stopAlbumAutoScroll() {
  window.clearInterval(albumAutoTimer);
}

function startAlbumAutoScroll() {
  if (!isAlbumVisible) return;
  if (!albumTrack || thumbButtons.length < 2 || prefersReducedMotion) return;
  stopAlbumAutoScroll();
  albumAutoTimer = window.setInterval(() => setAlbum(albumIndex + 1), ALBUM_AUTO_DELAY);
}

function restartAlbumAutoScroll() {
  stopAlbumAutoScroll();
  startAlbumAutoScroll();
}

thumbButtons.forEach((button, index) => {
  button.addEventListener("click", () => setAlbum(index, { userAction: true }));
});

prevButton?.addEventListener("click", () => setAlbum(albumIndex - 1, { userAction: true }));
nextButton?.addEventListener("click", () => setAlbum(albumIndex + 1, { userAction: true }));
albumTrack?.addEventListener("pointerenter", stopAlbumAutoScroll);
albumTrack?.addEventListener("pointerleave", startAlbumAutoScroll);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopAlbumAutoScroll();
    return;
  }
  startAlbumAutoScroll();
});

if (albumView && albumTrack && !prefersReducedMotion) {
  const albumObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      isAlbumVisible = entry.isIntersecting;
      if (isAlbumVisible) {
        startAlbumAutoScroll();
        return;
      }
      stopAlbumAutoScroll();
    },
    { threshold: 0.45 }
  );
  albumObserver.observe(albumView);
} else {
  startAlbumAutoScroll();
}

let shouldAutoPlayMusic = true;

function syncMusicButton(isPlaying) {
  if (!musicToggle) return;
  musicToggle.classList.toggle("playing", isPlaying);
  musicToggle.textContent = isPlaying ? "♫" : "♪";
}

async function playMusic() {
  if (!music) return false;
  try {
    music.muted = false;
    music.volume = 0.72;
    await music.play();
    syncMusicButton(true);
    return true;
  } catch {
    syncMusicButton(false);
    return false;
  }
}

function pauseMusic() {
  if (!music) return;
  music.pause();
  syncMusicButton(false);
}

function removeAutoPlayFallback() {
  ["pointerdown", "touchstart", "keydown", "scroll"].forEach((eventName) => {
    window.removeEventListener(eventName, startMusicWithFallback);
  });
}

async function startMusicWithFallback() {
  if (!shouldAutoPlayMusic) return;
  const didPlay = await playMusic();
  if (didPlay) removeAutoPlayFallback();
}

function enableAutoPlayFallback() {
  ["pointerdown", "touchstart", "keydown", "scroll"].forEach((eventName) => {
    window.addEventListener(eventName, startMusicWithFallback, { passive: true });
  });
}

if (music) {
  syncMusicButton(false);
  startMusicWithFallback();
  enableAutoPlayFallback();
  window.addEventListener("pageshow", startMusicWithFallback);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) startMusicWithFallback();
  });
}

musicToggle?.addEventListener("click", async () => {
  if (!music) return;
  if (music.paused) {
    shouldAutoPlayMusic = true;
    await playMusic();
    return;
  }

  shouldAutoPlayMusic = false;
  removeAutoPlayFallback();
  pauseMusic();
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("in-view");
    });
  },
  { threshold: 0.16 }
);

document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));

rsvpForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(rsvpForm).entries());
  const entry = {
    id: newId(),
    invitedName: invitedName || data.name || "",
    name: data.name || invitedName || "",
    message: data.message || "",
    attendance: data.attendance || "",
    pageUrl: window.location.href,
    savedAt: new Date().toISOString(),
  };

  formStatus.textContent = "Đang ghi nhận...";
  await saveRsvp(entry);
  formStatus.textContent = "Đã ghi nhận xác nhận của bạn. Hẹn gặp bạn trong ngày vui!";
  rsvpForm.reset();
  if (invitedName && guestNameInput) guestNameInput.value = invitedName;
});
