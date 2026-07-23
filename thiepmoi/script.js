const music = document.querySelector("#bgMusic");
const musicToggle = document.querySelector("#musicToggle");
const albumMain = document.querySelector("#albumMain");
const thumbButtons = Array.from(document.querySelectorAll(".thumbs button"));
const prevButton = document.querySelector(".album-nav.prev");
const nextButton = document.querySelector(".album-nav.next");
const rsvpForm = document.querySelector("#rsvpForm");
const formStatus = document.querySelector(".form-status");
let albumIndex = 0;

function setAlbum(index) {
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

prevButton.addEventListener("click", () => setAlbum(albumIndex - 1));
nextButton.addEventListener("click", () => setAlbum(albumIndex + 1));

musicToggle.addEventListener("click", async () => {
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
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
      }
    });
  },
  { threshold: 0.16 }
);

document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));

rsvpForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(rsvpForm).entries());
  localStorage.setItem("graduation-rsvp", JSON.stringify({ ...data, savedAt: new Date().toISOString() }));
  formStatus.textContent = "Đã ghi nhận xác nhận của bạn. Hẹn gặp bạn trong ngày vui!";
  rsvpForm.reset();
});
