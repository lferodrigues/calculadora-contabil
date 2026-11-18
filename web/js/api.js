// Cliente das três APIs da Receita Federal usadas pela calculadora.
//   regime  -> calculadora-rtc-regime-regular   (Spring Boot, contexto /api)
//   simples -> calculadora-rtc-simples-nacional (Spring Boot, contexto /api)
//   danfse  -> calculadora-rtc-gerador-danfse   (Go/Echo, rotas /api/danfse e /health/*)

import * as demo from "./demo.js";

const CONFIG_KEY = "rtc.config.v1";
const DEMO_KEY = "rtc.demo.v1";

const env = window.RTC_ENV || { proxy: false, apis: {} };

const PROXY_DEFAULTS = { regime: "/proxy/regime", simples: "/proxy/simples", danfse: "/proxy/danfse" };
const DIRECT_DEFAULTS = {
  regime: "http://localhost:8080/api",
  simples: "http://localhost:8082/api",
  danfse: "http://localhost:8081",
  ...(env.apis || {})
};

export const API_INFO = {
  regime: {
    nome: "Regime geral",
    repo: "https://github.com/ReceitaFederal/calculadora-rtc-regime-regular",
    health: "/calculadora/dados-abertos/versao",
    swagger: "/swagger-ui.html"
  },
  simples: {
    nome: "Simples Nacional",
    repo: "https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional",
    health: "/versao",
    swagger: "/swagger-ui.html"
  },
  danfse: {
    nome: "DANFSe",
    repo: "https://github.com/ReceitaFederal/calculadora-rtc-gerador-danfse",
    health: "/health/live",
    swagger: "/api/swagger-ui/index.html"
  }
};

export function defaults() {
  return env.proxy ? { ...PROXY_DEFAULTS } : { ...DIRECT_DEFAULTS };
}

export function getConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || "null");
    if (saved && saved.__proxy === !!env.proxy) return { ...defaults(), ...saved.apis };
  } catch { /* armazenamento indisponível */ }
  return defaults();
}

export function saveConfig(apis) {
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify({ __proxy: !!env.proxy, apis })); } catch { /* ignora */ }
}

export function resetConfig() {
  try { localStorage.removeItem(CONFIG_KEY); } catch { /* ignora */ }
}

export function isProxy() { return !!env.proxy; }

export function isDemo() {
  try { return localStorage.getItem(DEMO_KEY) === "1"; } catch { return false; }
}
export function setDemo(on) {
  try { localStorage.setItem(DEMO_KEY, on ? "1" : "0"); } catch { /* ignora */ }
  window.dispatchEvent(new CustomEvent("rtc:demo", { detail: on }));
}

const trimSlash = (s) => String(s || "").replace(/\/+$/, "");
export const baseUrl = (api) => trimSlash(getConfig()[api]);

// ---------------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------------
export class ApiError extends Error {
  constructor(message, { status = 0, body = null, api = "", offline = false } = {}) {
    super(message);
    this.status = status;
    this.body = body;
    this.api = api;
    this.offline = offline;
  }
}

function describeProblem(body, status) {
  if (!body) return `A API respondeu com o código HTTP ${status}.`;
  if (typeof body === "string") return body.slice(0, 400) || `A API respondeu com o código HTTP ${status}.`;
  const parts = [];
  if (body.title) parts.push(body.title);
  if (body.detail && body.detail !== body.title) parts.push(body.detail);
  if (body.message && !parts.length) parts.push(body.message);
  if (body.error && !parts.length) parts.push(typeof body.error === "string" ? body.error : JSON.stringify(body.error));
  const list = body.erros || body.errors || body.objects || body.invalidParams;
  if (Array.isArray(list) && list.length) {
    parts.push(list.slice(0, 4).map((e) => [e.code, e.detail || e.title || e.userMessage || e.message].filter(Boolean).join(": ")).join("; "));
  }
  return parts.join(" — ") || `A API respondeu com o código HTTP ${status}.`;
}

async function request(api, path, { method = "GET", body, headers = {}, accept = "json", timeout = 30000 } = {}) {
  const url = baseUrl(api) + path;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(url, { method, body, headers, signal: ctrl.signal });
  } catch (err) {
    clearTimeout(timer);
    const nome = API_INFO[api].nome;
    const motivo = err.name === "AbortError" ? "não respondeu a tempo" : "não está acessível";
    throw new ApiError(
      `A API ${nome} ${motivo} em ${baseUrl(api)}. Confira se ela está rodando e se o endereço em "Conexão com as APIs" está certo, ou ative o modo demonstração.`,
      { api, offline: true }
    );
  }
  clearTimeout(timer);

  const ctype = res.headers.get("content-type") || "";
  if (!res.ok) {
    let errBody = null;
    try { errBody = ctype.includes("json") ? await res.json() : await res.text(); } catch { /* corpo vazio */ }
    throw new ApiError(describeProblem(errBody, res.status), { status: res.status, body: errBody, api });
  }

  const warning = res.headers.get("x-warning-dados-simulados");
  let data;
  if (accept === "blob") data = await res.blob();
  else if (accept === "text") data = await res.text();
  else data = ctype.includes("json") ? await res.json() : await res.text();
  return { data, warning, headers: res.headers };
}

const json = (obj) => ({ body: JSON.stringify(obj), headers: { "Content-Type": "application/json", Accept: "application/json" } });
const qs = (params) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") p.append(k, v); });
  const s = p.toString();
  return s ? `?${s}` : "";
};

// Executa na API real ou, no modo demonstração, na simulação local.
async function run(real, fake) {
  if (isDemo()) {
    await new Promise((r) => setTimeout(r, 350));
    return { ...(await fake()), demo: true };
  }
  return real();
}

// ---------------------------------------------------------------------------
// Saúde das APIs
// ---------------------------------------------------------------------------
export async function health(api) {
  if (isDemo()) return { state: "demo" };
  try {
    const { data } = await request(api, API_INFO[api].health, { timeout: 5000 });
    return { state: "online", data };
  } catch (err) {
    return { state: "offline", error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Regime geral (calculadora-rtc-regime-regular)
// ---------------------------------------------------------------------------
export const regime = {
  calcularObservabilidade: (operacao) => run(
    () => request("regime", "/calculadora/observabilidade/regime-geral", { method: "POST", ...json(operacao) }),
    () => demo.regimeObservabilidade(operacao)
  ),
  calcular: (operacao) => run(
    () => request("regime", "/calculadora/regime-geral", { method: "POST", ...json(operacao) }),
    () => { throw new ApiError("A geração de XML precisa da API do regime geral rodando. Desative o modo demonstração.", { api: "regime" }); }
  ),
  gerarXml: (resultado, tipo = "nfe") => run(
    () => request("regime", `/calculadora/xml/generate${qs({ tipo })}`, { method: "POST", ...json(resultado), accept: "text" }),
    () => { throw new ApiError("A geração de XML precisa da API do regime geral rodando.", { api: "regime" }); }
  ),
  validarXml: (xml, tipo = "nfe", subtipo = "grupo") => run(
    () => request("regime", `/calculadora/xml/validate${qs({ tipo, subtipo })}`, { method: "POST", body: xml, headers: { "Content-Type": "application/xml" } }),
    () => ({ data: true })
  ),
  baseUnificada: (entrada) => run(
    () => request("regime", "/calculadora/base-calculo/base-calculo-unificada", { method: "POST", ...json(entrada) }),
    () => demo.baseUnificada(entrada)
  ),
  erro: (codigo) => run(
    () => request("regime", `/calculadora/observabilidade/erros${qs({ codigo })}`),
    () => demo.erro(codigo)
  ),
  ufs: () => run(
    () => request("regime", "/calculadora/dados-abertos/ufs"),
    () => ({ data: demo.UFS })
  ),
  municipios: (siglaUf) => run(
    () => request("regime", `/calculadora/dados-abertos/ufs/municipios${qs({ siglaUf })}`),
    () => ({ data: demo.municipios(siglaUf) })
  ),
  classTrib: (cClassTrib, data) => run(
    () => request("regime", `/calculadora/dados-abertos/classificacoes-tributarias/cbs-ibs/class-trib/${encodeURIComponent(cClassTrib)}${qs({ data })}`),
    () => ({ data: null })
  )
};

// ---------------------------------------------------------------------------
// Simples Nacional (calculadora-rtc-simples-nacional)
// ---------------------------------------------------------------------------
export const simples = {
  calcular: (operacao) => run(
    () => request("simples", "/calculadora/observabilidade/simples-nacional", { method: "POST", ...json(operacao) }),
    () => demo.simplesObservabilidade(operacao)
  ),
  atividades: (data, tpDoc) => run(
    () => request("simples", `/calculadora/simples-nacional/atividades${qs({ data, tpDoc })}`),
    () => ({ data: demo.ATIVIDADES })
  ),
  erro: (codigo) => run(
    () => request("simples", `/calculadora/observabilidade/simples-nacional/erros${qs({ codigo })}`),
    () => demo.erro(codigo)
  )
};

// ---------------------------------------------------------------------------
// Gerador de DANFSe (calculadora-rtc-gerador-danfse)
// ---------------------------------------------------------------------------
export const danfse = {
  gerarPdf: (xml, { stc = 0, canhoto = true } = {}) => run(
    () => request("danfse", `/api/danfse${qs({ stc, canhoto })}`, {
      method: "POST", body: xml, headers: { "Content-Type": "application/xml", Accept: "application/pdf" }, accept: "blob", timeout: 60000
    }),
    () => ({ data: null })
  )
};
