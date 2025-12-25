const http = require("http");
const fs = require("fs");
const path = require("path");

const publicRoot = path.join(__dirname, "public");
const mapsRoot = path.join(__dirname, "maps");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8"
};

function safePath(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const cleaned = decoded.replace(/^\/+/, "");
  const resolved = path.normalize(path.join(root, cleaned));
  if (!resolved.startsWith(root)) {
    return null;
  }
  return resolved;
}

function serveFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const type = contentTypes[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bad request");
    return;
  }

  if (req.url === "/" || req.url.startsWith("/index.html")) {
    serveFile(path.join(publicRoot, "index.html"), res);
    return;
  }

  if (req.url.startsWith("/maps/")) {
    const filePath = safePath(mapsRoot, req.url);
    if (!filePath) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }
    serveFile(filePath, res);
    return;
  }

  const filePath = safePath(publicRoot, req.url);
  if (!filePath) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }
  serveFile(filePath, res);
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`EFT quest panel running on http://localhost:${port}`);
});
