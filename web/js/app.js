// Ponto de entrada da SPA: rotas por hash, barra superior e status das APIs.

import * as api from "./api.js";
import { esc } from "./ui.js";
import * as painel from "./pages/painel.js";
import * as regimeGeral from "./pages/regime-geral.js";
import * as simplesNacional from "./pages/simples-nacional.js";
import * as danfse from "./pages/danfse.js";
import * as configuracoes from "./pages/configuracoes.js";

const ROUTES = {
  "/": { page: painel, title: "Painel" },
  "/regime-geral": { page: regimeGeral, title: "Regime geral" },
  "/simples-nacional": { page: simplesNacional, title: "Simples Nacional" },
  "/danfse": { page: danfse, title: "Gerador de DANFSe" },
  "/configuracoes": { page: configuracoes, title: "Conexão com as APIs" }
};

const view = document.getElementById("view");
let cleanup = null;

function currentPath() {
  const p = (location.hash || "#/").slice(1).split("?")[0];
  return ROUTES[p] ? p : "/";
}

async function navigate() {
  const path = currentPath();
  const route = ROUTES[path];
  if (typeof cleanup === "function") { try { cleanup(); } catch { /* ignora */ } }
  cleanup = null;

  document.querySelectorAll("#nav a").forEach((a) => {
    if (a.dataset.route === path) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  document.getElementById("topbar-title").innerHTML = `Calculadora RTC / <strong>${esc(route.title)}</strong>`;
  document.title = `${route.title} | Calculadora RTC`;
  document.body.classList.remove("nav-open");
  document.getElementById("menu-btn").setAttribute("aria-expanded", "false");

  view.innerHTML = "";
  cleanup = await route.page.render(view);
  view.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------------------
// Status das APIs na barra superior
// ---------------------------------------------------------------------------
const LABEL = { online: "online", offline: "offline", demo: "demonstração", checking: "verificando" };

export async function refreshStatus() {
  const box = document.getElementById("api-pills");
  const keys = ["regime", "simples", "danfse"];
  box.innerHTML = keys.map((k) => `<a class="api-pill" href="#/configuracoes" data-api="${k}" data-state="checking">${api.API_INFO[k].nome}</a>`).join("");
  const results = await Promise.all(keys.map((k) => api.health(k)));
  results.forEach((r, i) => {
    const pill = box.querySelector(`[data-api="${keys[i]}"]`);
    pill.dataset.state = r.state;
    pill.title = `API ${api.API_INFO[keys[i]].nome}: ${LABEL[r.state]}`;
  });
  window.dispatchEvent(new CustomEvent("rtc:status", { detail: Object.fromEntries(keys.map((k, i) => [k, results[i]])) }));
  return results;
}

// ---------------------------------------------------------------------------
function init() {
  document.getElementById("year").textContent = new Date().getFullYear();

  const toggle = document.getElementById("demo-toggle");
  toggle.checked = api.isDemo();
  toggle.addEventListener("change", () => api.setDemo(toggle.checked));
  window.addEventListener("rtc:demo", (e) => {
    toggle.checked = !!e.detail;
    refreshStatus();
    navigate();
  });

  const menuBtn = document.getElementById("menu-btn");
  menuBtn.addEventListener("click", () => {
    const open = document.body.classList.toggle("nav-open");
    menuBtn.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", (e) => {
    if (document.body.classList.contains("nav-open") && !e.target.closest("#sidebar") && !e.target.closest("#menu-btn")) {
      document.body.classList.remove("nav-open");
    }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.body.classList.remove("nav-open"); });

  window.addEventListener("hashchange", navigate);
  window.addEventListener("rtc:config", refreshStatus);
  navigate();
  refreshStatus();
}

init();
