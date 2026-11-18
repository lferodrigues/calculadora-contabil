// Utilitários de interface compartilhados pelas páginas.

export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dec = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

export const toNum = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};
export const money = (v) => (toNum(v) === null ? "—" : brl.format(toNum(v)));
export const pct = (v) => (toNum(v) === null ? "—" : `${dec.format(toNum(v))}%`);

// Converte "1.234,56" ou "1234.56" em número.
export function parseBR(value) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const normal = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const x = Number(normal);
  return Number.isFinite(x) ? x : NaN;
}

export const today = () => new Date().toISOString().slice(0, 10);

export function html(strings, ...values) {
  return strings.reduce((out, s, i) => out + s + (i < values.length ? values[i] : ""), "");
}

export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

// ---------------------------------------------------------------------------
// Ícones (traço, 24px)
// ---------------------------------------------------------------------------
const P = {
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 8v5M12 16.5h.01"/><circle cx="12" cy="12" r="9"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
  sample: '<path d="M4 6h16M4 12h10M4 18h7"/><path d="M17 15l3 3-3 3"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .8c0 1.8-2.5 2.2-2.5 3.8M12 17h.01"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  clear: '<path d="M6 6l12 12M18 6L6 18"/>',
  doc: '<path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z"/><path d="M14 2.5V8h5.5"/>',
  upload: '<path d="M12 20V9M7 13.5l5-5 5 5M5 4h14"/>',
  calc: '<rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',
  home: '<path d="M4 20V10l8-6 8 6v10z"/><path d="M9 20v-6h6v6"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>'
};
export const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;

// ---------------------------------------------------------------------------
// Notificações
// ---------------------------------------------------------------------------
export function toast(title, text = "", kind = "ok", ms = 6000) {
  const box = document.getElementById("toasts");
  const el = document.createElement("div");
  el.className = `toast${kind === "error" ? " is-error" : kind === "warn" ? " is-warn" : ""}`;
  el.setAttribute("role", kind === "error" ? "alert" : "status");
  el.innerHTML = `<span class="toast-icon">${icon(kind === "ok" ? "check" : kind === "warn" ? "info" : "alert")}</span>
    <div><strong>${esc(title)}</strong>${text ? `<p>${esc(text)}</p>` : ""}</div>
    <button aria-label="Fechar aviso">×</button>`;
  el.querySelector("button").onclick = () => el.remove();
  box.prepend(el);
  [...box.children].slice(3).forEach((old) => old.remove());
  if (ms) setTimeout(() => el.remove(), kind === "error" ? ms * 2 : ms);
}

// ---------------------------------------------------------------------------
// Diálogo
// ---------------------------------------------------------------------------
export function modal(title, bodyHtml) {
  const dlg = document.getElementById("modal");
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-body").innerHTML = bodyHtml;
  dlg.querySelector("[data-close]").onclick = () => dlg.close();
  dlg.onclick = (e) => { if (e.target === dlg) dlg.close(); };
  if (!dlg.open) dlg.showModal();
}

export function kvList(obj) {
  if (!obj || typeof obj !== "object") return `<p>${esc(obj)}</p>`;
  return `<dl>${Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(typeof v === "object" ? JSON.stringify(v) : v)}</dd>`).join("")}</dl>`;
}

// ---------------------------------------------------------------------------
// Botão com estado de carregamento
// ---------------------------------------------------------------------------
export async function busy(btn, fn) {
  btn.classList.add("is-loading");
  btn.setAttribute("aria-busy", "true");
  try { return await fn(); }
  finally { btn.classList.remove("is-loading"); btn.removeAttribute("aria-busy"); }
}

export function download(content, filename, type = "application/json") {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function errorCallout(err) {
  return `<div class="callout err" role="alert">${icon("alert")}<p>${esc(err.message || err)}</p></div>`;
}

// ---------------------------------------------------------------------------
// Estado dos itens (estadoItem) → selo
// ---------------------------------------------------------------------------
const ESTADOS = {
  CALCULADO: ["Calculado", "badge-ok"],
  CALCULO_SIMULADO: ["Simulado", "badge-info"],
  NAO_CALCULADO: ["Não calculado", ""],
  INCONSISTENCIA_ENTRADA: ["Inconsistência", "badge-err"],
  NAO_IMPLEMENTADO: ["Não implementado", "badge-warn"],
  FALHA_TECNICA: ["Falha técnica", "badge-err"]
};
export function estadoBadge(estado) {
  const [label, cls] = ESTADOS[estado] || [estado || "—", ""];
  return `<span class="badge ${cls}">${esc(label)}</span>`;
}

// ---------------------------------------------------------------------------
// Histórico da sessão (localStorage)
// ---------------------------------------------------------------------------
const HIST_KEY = "rtc.historico.v1";
export function history() {
  try { return JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); } catch { return []; }
}
export function addHistory(entry) {
  const list = [{ id: Date.now(), quando: new Date().toISOString(), ...entry }, ...history()].slice(0, 40);
  try { localStorage.setItem(HIST_KEY, JSON.stringify(list)); } catch { /* ignora */ }
}
export function clearHistory() {
  try { localStorage.removeItem(HIST_KEY); } catch { /* ignora */ }
}

// Procura todas as memórias de cálculo dentro de um objeto de resposta.
export function memorias(obj, path = []) {
  const out = [];
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    if (k === "memoriaCalculo" && v) out.push({ grupo: path.join(" › ") || "Item", texto: v });
    else if (v && typeof v === "object") out.push(...memorias(v, [...path, k]));
  }
  return out;
}

// Mostra a descrição oficial de um código de erro da observabilidade.
export function bindErrorChips(root, fetcher) {
  root.addEventListener("click", async (e) => {
    const chip = e.target.closest("[data-erro]");
    if (!chip) return;
    const codigo = chip.dataset.erro;
    modal(`Código ${codigo}`, "<p class='muted'>Consultando a descrição na API…</p>");
    try {
      const { data } = await fetcher(codigo);
      modal(`Código ${codigo}`, kvList(data));
    } catch (err) {
      modal(`Código ${codigo}`, errorCallout(err));
    }
  });
}
