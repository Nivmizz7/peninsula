const http = require("http");
const fs = require("fs");
const path = require("path");

const port = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const questsDir = path.join(dataDir, "quests");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function safeJoin(base, target) {
  const targetPath = path.normalize(path.join(base, target));
  if (!targetPath.startsWith(base)) {
    return null;
  }
  return targetPath;
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const urlPath = decodeURIComponent(url.pathname);

  if (urlPath === "/api/maps" && req.method === "GET") {
    const maps = readJson(path.join(dataDir, "maps.json"), []);
    sendJson(res, 200, { maps });
    return;
  }

  if (urlPath === "/api/quests" && req.method === "GET") {
    const map = url.searchParams.get("map");
    if (!map) {
      sendJson(res, 400, { error: "Missing map" });
      return;
    }
    const quests = readJson(path.join(questsDir, `${map}.json`), []);
    sendJson(res, 200, { quests });
    return;
  }

  if (urlPath === "/api/quests" && req.method === "POST") {
    try {
      const payload = await parseBody(req);
      const { name, map, points, hoverText, description } = payload;

      if (!name || !map || !Array.isArray(points) || points.length === 0) {
        sendJson(res, 400, { error: "Invalid payload" });
        return;
      }

      const sanitizedPoints = points
        .filter((pt) => pt && Number.isFinite(pt.x) && Number.isFinite(pt.y))
        .map((pt) => ({
          x: pt.x,
          y: pt.y,
          floorId: typeof pt.floorId === "string" ? pt.floorId : null,
        }));

      if (!sanitizedPoints.length) {
        sendJson(res, 400, { error: "Invalid payload" });
        return;
      }

      const filePath = path.join(questsDir, `${map}.json`);
      const quests = readJson(filePath, []);
      const newQuest = {
        id: `${map}-${Date.now()}`,
        name,
        map,
        points: sanitizedPoints,
        hoverText: hoverText || "",
        description: description || "",
      };
      quests.push(newQuest);
      writeJson(filePath, quests);
      sendJson(res, 201, { quest: newQuest });
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON" });
    }
    return;
  }

  const requested = urlPath === "/" ? "/index.html" : urlPath === "/admin" ? "/admin.html" : urlPath;
  const filePath = safeJoin(publicDir, requested);

  if (!filePath) {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(500);
      res.end("Server error");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(port, () => {
  console.log(`Peninsula running on http://localhost:${port}`);
});
