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
const dashboardStatus = document.querySelector("#dashboardStatus");

const INVITES_KEY = "graduation-invites";
const RSVPS_KEY = "graduation-rsvps";
const ADMIN_TOKEN_KEY = "graduation-admin-token";
let invitesCache = [];
let rsvpsCache = [];
let apiAvailable = window.location.protocol !== "file:";
let adminToken = localStorage.getItem(ADMIN_TOKEN_KEY) || "";

function shouldUseRemoteApi() {
  return window.location.protocol !== "file:";
}

function setDashboardStatus(message, type = "") {
  if (!dashboardStatus) return;
  dashboardStatus.textContent = message;
  dashboardStatus.className = `dashboard-status${type ? ` ${type}` : ""}`;
}

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
  const { admin = false, ...requestOptions } = options;
  const headers = {
    "Content-Type": "application/json",
    ...(requestOptions.headers || {}),
  };

  if (admin && adminToken) headers["x-admin-token"] = adminToken;

  const response = await fetch(path, {
    ...requestOptions,
    headers,
  });

  if (!response.ok) {
    const error = new Error(`API error ${response.status}`);
    error.status = response.status;
    const detailText = await response.text();
    try {
      const detail = JSON.parse(detailText);
      error.detail = detail.error || detailText;
    } catch {
      error.detail = detailText;
    }
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

function requestAdminToken() {
  const token = window.prompt("Nhap ADMIN_TOKEN de quan ly thu moi va RSVP:");
  if (!token || !token.trim()) return false;
  adminToken = token.trim();
  localStorage.setItem(ADMIN_TOKEN_KEY, adminToken);
  return true;
}

async function adminRequest(path, options = {}) {
  const sentToken = adminToken;
  try {
    return await apiRequest(path, { ...options, admin: true });
  } catch (error) {
    if (error.status === 401) {
      if (sentToken !== adminToken) {
        return apiRequest(path, { ...options, admin: true });
      }

      adminToken = "";
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      if (requestAdminToken()) {
        return apiRequest(path, { ...options, admin: true });
      }
    }
    throw error;
  }
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
  if (shouldUseRemoteApi()) {
    setDashboardStatus("Đang đọc danh sách từ Supabase...");
    try {
      const invites = await adminRequest("/api/invites");
      const rsvps = await adminRequest("/api/rsvps");
      invitesCache = invites;
      rsvpsCache = rsvps;
      writeList(INVITES_KEY, invitesCache);
      writeList(RSVPS_KEY, rsvpsCache);
      renderInvites();
      renderRsvps();
      apiAvailable = true;
      setDashboardStatus("Đã đồng bộ danh sách từ Supabase.", "success");
      return;
    } catch (error) {
      apiAvailable = false;
      setDashboardStatus(
        `Không đọc được Supabase: ${error.detail || error.message}. Đang hiển thị dữ liệu tạm trên trình duyệt này.`,
        "error"
      );
    }
  } else {
    setDashboardStatus("Đang chạy offline, dữ liệu được lưu tạm trên trình duyệt này.");
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
    const savedInvite = shouldUseRemoteApi()
      ? await adminRequest("/api/invites", {
          method: "POST",
          body: JSON.stringify({ name, url }),
        })
      : fallbackInvite;
    invitesCache.unshift(savedInvite);
    apiAvailable = shouldUseRemoteApi();
    setDashboardStatus(
      shouldUseRemoteApi() ? "Đã lưu thư mời vào Supabase." : "Đã lưu thư mời tạm trên trình duyệt.",
      "success"
    );
  } catch (error) {
    apiAvailable = false;
    copyStatus.textContent = `Chưa lưu được lên Supabase: ${error.detail || error.message}`;
    setDashboardStatus(
      `Không lưu được thư mời lên Supabase: ${error.detail || error.message}`,
      "error"
    );
    return;
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
    if (shouldUseRemoteApi()) await adminRequest("/api/invites", { method: "DELETE" });
  } catch (error) {
    apiAvailable = false;
    setDashboardStatus(`Không xoá được danh sách trên Supabase: ${error.detail || error.message}`, "error");
    return;
  }
  invitesCache = [];
  writeList(INVITES_KEY, invitesCache);
  renderInvites();
  setDashboardStatus(
    shouldUseRemoteApi() ? "Đã xoá danh sách thư mời trên Supabase." : "Đã xoá danh sách tạm trên trình duyệt.",
    "success"
  );
});

clearRsvps.addEventListener("click", async () => {
  if (!confirm("Xóa toàn bộ xác nhận và lời nhắn đã lưu?")) return;
  try {
    if (shouldUseRemoteApi()) await adminRequest("/api/rsvps", { method: "DELETE" });
  } catch (error) {
    apiAvailable = false;
    setDashboardStatus(`Không xoá được RSVP trên Supabase: ${error.detail || error.message}`, "error");
    return;
  }
  rsvpsCache = [];
  writeList(RSVPS_KEY, rsvpsCache);
  localStorage.removeItem("graduation-rsvp");
  renderRsvps();
  setDashboardStatus(
    shouldUseRemoteApi() ? "Đã xoá RSVP trên Supabase." : "Đã xoá RSVP tạm trên trình duyệt.",
    "success"
  );
});

exportCsv.addEventListener("click", downloadCsv);
window.addEventListener("storage", loadDashboard);
loadDashboard();
