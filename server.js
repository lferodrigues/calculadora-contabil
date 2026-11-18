#!/usr/bin/env node
// Servidor da Calculadora RTC: entrega a SPA e faz proxy para as três APIs
// da Receita Federal, evitando bloqueios de CORS no navegador.
// Sem dependências: só Node.js 18+.
//
//   PORT=3000
//   REGIME_API_URL=http://localhost:8080/api
//   SIMPLES_API_URL=http://localhost:8082/api
//   DANFSE_API_URL=http://localhost:8081

"use strict";

const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const TARGETS = {
  regime: process.env.REGIME_API_URL || "http://localhost:8080/api",
  simples: process.env.SIMPLES_API_URL || "http://localhost:8082/api",
  danfse: process.env.DANFSE_API_URL || "http://localhost:8081"
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8"
};

const ENV_JS = `window.RTC_ENV = ${JSON.stringify({ proxy: true, apis: {} })};\n`;

function proxy(req, res, api, rest) {
  const base = new URL(TARGETS[api]);
  const basePath = base.pathname.replace(/\/+$/, "");
  const target = new URL(basePath + rest, base);
  const client = target.protocol === "https:" ? https : http;

  const headers = { ...req.headers, host: target.host };
  delete headers.origin;
  delete headers.referer;
  delete headers.cookie;

  const upstream = client.request(target, { method: req.method, headers, timeout: 60000 }, (up) => {
    const h = { ...up.headers };
    delete h["access-control-allow-origin"];
    res.writeHead(up.statusCode || 502, h);
    up.pipe(res);
  });
  upstream.on("timeout", () => upstream.destroy(new Error("timeout")));
  upstream.on("error", (err) => {
    if (res.headersSent) { res.end(); return; }
    res.writeHead(502, { "Content-Type": "application/problem+json; charset=utf-8" });
    res.end(JSON.stringify({
      title: "API indisponível",
      detail: `Não foi possível falar com ${TARGETS[api]} (${err.code || err.message}). Confira se a API está rodando.`
    }));
  });
  req.pipe(upstream);
}

function serveStatic(req, res, pathname) {
  if (pathname === "/env.js") {
    res.writeHead(200, { "Content-Type": MIME[".js"], "Cache-Control": "no-store" });
    res.end(ENV_JS);
    return;
  }
  let file = path.normalize(path.join(ROOT, decodeURIComponent(pathname)));
  if (!(file === ROOT || file.startsWith(ROOT + path.sep)) || /(^|[\\/])\.|node_modules|server\.js$/.test(path.relative(ROOT, file))) {
    res.writeHead(404); res.end("Não encontrado"); return;
  }
  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) file = path.join(file, "index.html");
    else if (err) file = path.join(ROOT, "index.html"); // fallback da SPA
    fs.readFile(file, (err2, data) => {
      if (err2) { res.writeHead(404); res.end("Não encontrado"); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    });
  });
}

const server = http.createServer((req, res) => {
  const { pathname, search } = new URL(req.url, "http://localhost");
  const m = pathname.match(/^\/proxy\/(regime|simples|danfse)(\/.*)?$/);
  if (m) return proxy(req, res, m[1], (m[2] || "/") + (search || ""));
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); res.end(); return; }
  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`Calculadora RTC em http://localhost:${PORT}`);
  Object.entries(TARGETS).forEach(([k, v]) => console.log(`  /proxy/${k.padEnd(7)} -> ${v}`));
});
