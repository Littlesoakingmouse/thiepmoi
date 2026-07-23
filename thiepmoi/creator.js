const inviteForm = document.querySelector("#inviteForm");
const guestName = document.querySelector("#guestName");
const resultBox = document.querySelector("#resultBox");
const generatedLink = document.querySelector("#generatedLink");
const copyLink = document.querySelector("#copyLink");
const openInvite = document.querySelector("#openInvite");
const copyStatus = document.querySelector("#copyStatus");
const inviteList = document.querySelector("#inviteList");
const rsvpList = document.querySelector("#rsvpList");
const clearInvites = document.querySelector("#clearInvites");
const clearRsvps = document.querySelector("#clearRsvps");
const exportCsv = document.querySelector("#exportCsv");

const INVITES_KEY = "graduation-invites";
const RSVPS_KEY = "graduation-rsvps";
let invitesCache = [];
let rsvpsCache = [];
let apiAvailable = window.location.protocol !== "file:";

function readList(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function writeList(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
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

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function createInviteUrl(name) {
  const url = new URL("./index.html", window.location.href);
  url.searchParams.set("guest", name);
  return url.href;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function attendanceText(value) {
  return {
    yes: "Sẽ tham dự",
    maybe: "Báo lại sau",
    no: "Không tham dự",
  }[value] || value || "";
}

function renderInvites() {
  if (invitesCache.length === 0) {
    inviteList.innerHTML = '<tr><td class="empty-row" colspan="3">Chưa có thư mời nào.</td></tr>';
    return;
  }

  inviteList.innerHTML = invitesCache
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">Mở link</a></td>
          <td>${formatDate(item.createdAt)}</td>
        </tr>
      `
    )
    .join("");
}

function renderRsvps() {
  if (rsvpsCache.length === 0) {
    rsvpList.innerHTML = '<tr><td class="empty-row" colspan="4">Chưa có xác nhận nào.</td></tr>';
    return;
  }

  rsvpList.innerHTML = rsvpsCache
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.name || item.invitedName || "")}</td>
          <td>${escapeHtml(attendanceText(item.attendance))}</td>
          <td>${escapeHtml(item.message || "")}</td>
          <td>${formatDate(item.savedAt)}</td>
        </tr>
      `
    )
    .join("");
}

function downloadCsv() {
  const header = ["Khach moi", "Trang thai", "Loi nhan", "Thoi gian", "Link"];
  const rows = rsvpsCache.map((item) => [
    item.name || item.invitedName || "",
    attendanceText(item.attendance),
    item.message || "",
    item.savedAt || "",
    item.pageUrl || "",
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "xac-nhan-tham-du.csv";
  a.click();
  URL.revokeObjectURL(url);
}

async function loadDashboard() {
  if (apiAvailable) {
    try {
      const [invites, rsvps] = await Promise.all([
        apiRequest("/api/invites"),
        apiRequest("/api/rsvps"),
      ]);
      invitesCache = invites;
      rsvpsCache = rsvps;
      writeList(INVITES_KEY, invitesCache);
      writeList(RSVPS_KEY, rsvpsCache);
      renderInvites();
      renderRsvps();
      return;
    } catch {
      apiAvailable = false;
    }
  }

  invitesCache = readList(INVITES_KEY);
  rsvpsCache = readList(RSVPS_KEY);
  renderInvites();
  renderRsvps();
}

inviteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = guestName.value.trim();
  if (!name) return;

  const url = createInviteUrl(name);
  const fallbackInvite = {
    id: globalThis.crypto?.randomUUID?.() || String(Date.now()),
    name,
    url,
    createdAt: new Date().toISOString(),
  };

  try {
    const savedInvite = apiAvailable
      ? await apiRequest("/api/invites", {
          method: "POST",
          body: JSON.stringify({ name, url }),
        })
      : fallbackInvite;
    invitesCache.unshift(savedInvite);
  } catch {
    apiAvailable = false;
    invitesCache.unshift(fallbackInvite);
  }

  writeList(INVITES_KEY, invitesCache);
  generatedLink.value = url;
  openInvite.href = url;
  resultBox.hidden = false;
  copyStatus.textContent = "Đã tạo link thư mời.";
  renderInvites();
});

copyLink.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(generatedLink.value);
    copyStatus.textContent = "Đã copy link.";
  } catch {
    generatedLink.select();
    document.execCommand("copy");
    copyStatus.textContent = "Đã copy link.";
  }
});

clearInvites.addEventListener("click", async () => {
  if (!confirm("Xóa toàn bộ danh sách thư mời đã tạo?")) return;
  try {
    if (apiAvailable) await apiRequest("/api/invites", { method: "DELETE" });
  } catch {
    apiAvailable = false;
  }
  invitesCache = [];
  writeList(INVITES_KEY, invitesCache);
  renderInvites();
});

clearRsvps.addEventListener("click", async () => {
  if (!confirm("Xóa toàn bộ xác nhận và lời nhắn đã lưu?")) return;
  try {
    if (apiAvailable) await apiRequest("/api/rsvps", { method: "DELETE" });
  } catch {
    apiAvailable = false;
  }
  rsvpsCache = [];
  writeList(RSVPS_KEY, rsvpsCache);
  localStorage.removeItem("graduation-rsvp");
  renderRsvps();
});

exportCsv.addEventListener("click", downloadCsv);
window.addEventListener("storage", loadDashboard);
loadDashboard();
