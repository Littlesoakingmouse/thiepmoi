const http = require("http");
const path = require("path");
const { readFile, writeFile, mkdir, stat } = require("fs/promises");

const rootDir = __dirname;
const workspaceDir = path.resolve(rootDir, "..");
const dataDir = path.join(rootDir, "data");
const port = Number(process.env.PORT || 5173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function readJsonList(filename) {
  await mkdir(dataDir, { recursive: true });
  const filePath = path.join(dataDir, filename);

  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    await writeFile(filePath, "[]\n", "utf8");
    return [];
  }
}

async function writeJsonList(filename, items) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, filename), `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Body is too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function handleApi(req, res, pathname) {
  if (pathname === "/api/invites") {
    if (req.method === "GET") {
      sendJson(res, 200, await readJsonList("invites.json"));
      return;
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      const name = String(body.name || "").trim();
      const url = String(body.url || "").trim();
      if (!name || !url) {
        sendJson(res, 400, { error: "Missing invite name or URL" });
        return;
      }

      const invites = await readJsonList("invites.json");
      const invite = { id: newId(), name, url, createdAt: new Date().toISOString() };
      invites.unshift(invite);
      await writeJsonList("invites.json", invites);
      sendJson(res, 201, invite);
      return;
    }

    if (req.method === "DELETE") {
      await writeJsonList("invites.json", []);
      sendJson(res, 200, []);
      return;
    }
  }

  if (pathname === "/api/rsvps") {
    if (req.method === "GET") {
      sendJson(res, 200, await readJsonList("rsvps.json"));
      return;
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      const name = String(body.name || body.invitedName || "").trim();
      const attendance = String(body.attendance || "").trim();
      if (!name || !attendance) {
        sendJson(res, 400, { error: "Missing guest name or attendance status" });
        return;
      }

      const rsvps = await readJsonList("rsvps.json");
      const rsvp = {
        id: newId(),
        invitedName: String(body.invitedName || name).trim(),
        name,
        attendance,
        message: String(body.message || "").trim(),
        pageUrl: String(body.pageUrl || "").trim(),
        savedAt: new Date().toISOString(),
      };
      rsvps.unshift(rsvp);
      await writeJsonList("rsvps.json", rsvps);
      sendJson(res, 201, rsvp);
      return;
    }

    if (req.method === "DELETE") {
      await writeJsonList("rsvps.json", []);
      sendJson(res, 200, []);
      return;
    }
  }

  sendJson(res, 404, { error: "Not found" });
}

async function serveStatic(res, pathname, baseDir = rootDir) {
  const normalizedPath = pathname === "/" ? "/tao-thu-moi.html" : pathname;
  const relativePath = decodeURIComponent(normalizedPath).replace(/^[/\\]+/, "");
  const filePath = path.resolve(baseDir, relativePath);

  if (!filePath.startsWith(baseDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const info = await stat(filePath);
    const targetPath = info.isDirectory() ? path.join(filePath, "index.html") : filePath;
    const ext = path.extname(targetPath).toLowerCase();
    const content = await readFile(targetPath);
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    if (pathname.startsWith("/api/")) {
      await handleApi(req, res, pathname);
      return;
    }

    if (pathname.startsWith("/resource/")) {
      await serveStatic(res, pathname, workspaceDir);
      return;
    }

    await serveStatic(res, pathname);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(port, () => {
  console.log(`Graduation invitation server: http://localhost:${port}`);
});
