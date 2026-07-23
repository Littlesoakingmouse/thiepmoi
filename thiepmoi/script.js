const params = new URLSearchParams(window.location.search);
const invitedName = (params.get("guest") || params.get("name") || "").trim();
const inviteeName = document.querySelector("#inviteeName");
const guestNameInput = document.querySelector("#guestNameInput");
const music = document.querySelector("#bgMusic");
const musicToggle = document.querySelector("#musicToggle");
const albumMain = document.querySelector("#albumMain");
const thumbButtons = Array.from(document.querySelectorAll(".thumbs button"));
const prevButton = document.querySelector(".album-nav.prev");
const nextButton = document.querySelector(".album-nav.next");
const rsvpForm = document.querySelector("#rsvpForm");
const formStatus = document.querySelector(".form-status");
const RSVPS_KEY = "graduation-rsvps";
let albumIndex = 0;
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

function setAlbum(index) {
  if (!albumMain || thumbButtons.length === 0) return;
  albumIndex = (index + thumbButtons.length) % thumbButtons.length;
  const active = thumbButtons[albumIndex];
  albumMain.classList.add("switching");
  window.setTimeout(() => {
    albumMain.src = active.dataset.src;
    albumMain.addEventListener("load", () => albumMain.classList.remove("switching"), { once: true });
    window.setTimeout(() => albumMain.classList.remove("switching"), 420);
  }, 160);
  thumbButtons.forEach((button) => button.classList.toggle("active", button === active));
  active.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
}

thumbButtons.forEach((button, index) => {
  button.addEventListener("click", () => setAlbum(index));
});

prevButton?.addEventListener("click", () => setAlbum(albumIndex - 1));
nextButton?.addEventListener("click", () => setAlbum(albumIndex + 1));

musicToggle?.addEventListener("click", async () => {
  if (!music) return;
  if (music.paused) {
    try {
      await music.play();
      musicToggle.classList.add("playing");
      musicToggle.textContent = "♫";
    } catch {
      musicToggle.textContent = "♪";
    }
    return;
  }

  music.pause();
  musicToggle.classList.remove("playing");
  musicToggle.textContent = "♪";
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
