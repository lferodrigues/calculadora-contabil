// Página 1: calculadora-rtc-regime-regular (CBS, IBS e Imposto Seletivo no regime geral).

import * as api from "../api.js";
import * as demo from "../demo.js";
import { ItemGrid } from "../grid.js";
import {
  esc, icon, money, pct, parseBR, toNum, toast, modal, busy, download, errorCallout,
  estadoBadge, addHistory, memorias, bindErrorChips, html
} from "../ui.js";

const EXEMPLO = {
  dh: "2027-03-10T10:00", uf: "RS", municipio: "4314902",
  itens: [
    { ncmNbs: "10063021", cst: "200", cClassTrib: "200003", base: "100,00", qtd: "20", un: "KG", cbs: "8,8", ibsUf: "0,05", ibsMun: "0,05" },
    { ncmNbs: "22030000", cst: "000", cClassTrib: "000001", base: "", qtd: "12", un: "LT", cbs: "8,8", ibsUf: "0,05", ibsMun: "0,05", isCst: "000", isClass: "000001", isBase: "150,00", isAliq: "10" },
    { ncmNbs: "122011200", cst: "200", cClassTrib: "200028", base: "1.200,00", qtd: "", un: "", cbs: "8,8", ibsUf: "0,05", ibsMun: "0,05" },
    { ncmNbs: "02013000", cst: "200", cClassTrib: "200035", base: "80,00", qtd: "", un: "", cbs: "8,8", ibsUf: "0,05", ibsMun: "0,05" }
  ]
};

const COLUNAS = [
  { key: "ncmNbs", label: "NCM ou NBS", placeholder: "8 ou 9 dígitos", width: "118px", digits: true, maxlength: 9, title: "NCM (8 dígitos) para bens ou NBS (9 dígitos) para serviços" },
  { key: "cst", label: "CST", placeholder: "000", width: "64px", digits: true, maxlength: 3 },
  { key: "cClassTrib", label: "cClassTrib", placeholder: "000001", width: "86px", digits: true, maxlength: 6 },
  { key: "base", label: "Base (R$)", type: "num", placeholder: "0,00", width: "110px", title: "Base de cálculo do item. Deixe vazio quando houver Imposto Seletivo: a base é derivada da base do IS + IS." },
  { key: "qtd", label: "Qtd.", type: "num", width: "64px" },
  { key: "un", label: "Un.", width: "56px", maxlength: 6 },
  { key: "cbs", label: "CBS %", type: "num", width: "70px" },
  { key: "ibsUf", label: "IBS UF %", type: "num", width: "76px" },
  { key: "ibsMun", label: "IBS mun. %", type: "num", width: "82px" },
  { key: "isCst", label: "CST IS", width: "64px", digits: true, maxlength: 3, placeholder: "—" },
  { key: "isClass", label: "cClassTrib IS", width: "92px", digits: true, maxlength: 6, placeholder: "—" },
  { key: "isBase", label: "Base IS (R$)", type: "num", width: "100px", placeholder: "—" },
  { key: "isAliq", label: "IS %", type: "num", width: "60px", placeholder: "—" }
];

const novoItem = () => ({ ncmNbs: "", cst: "", cClassTrib: "", base: "", qtd: "", un: "", cbs: "", ibsUf: "", ibsMun: "", isCst: "", isClass: "", isBase: "", isAliq: "" });

// Estado preservado ao trocar de página.
const state = { tab: "calculo", dh: "", uf: "", municipio: "", itens: null, resultado: null, ultimaOperacao: null, base: {} };

const anoDe = (dh) => Number(String(dh || "").slice(0, 4)) || null;

function offsetISO(local) {
  // "2027-03-10T10:00" -> "2027-03-10T10:00:00-03:00", usando o fuso do navegador.
  if (!local) return "";
  const d = new Date(local);
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const hh = String(Math.floor(Math.abs(off) / 60)).padStart(2, "0");
  const mm = String(Math.abs(off) % 60).padStart(2, "0");
  return `${local.length === 16 ? `${local}:00` : local}${sign}${hh}:${mm}`;
}

const randomId = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function render(view) {
  view.innerHTML = html`
    <div class="page-head">
      <div>
        <h1>Regime geral</h1>
        <p>Cálculo de CBS, IBS e Imposto Seletivo por item da nota, com memória de cálculo, usando a calculadora oficial do regime regular.</p>
      </div>
      <div class="page-actions">
        <a class="btn" href="${api.API_INFO.regime.repo}" target="_blank" rel="noopener">Repositório da API</a>
      </div>
    </div>
    <div class="tabs" role="tablist">
      <button role="tab" id="tab-calculo" aria-controls="pane-calculo" aria-selected="${state.tab === "calculo"}">Cálculo de tributos</button>
      <button role="tab" id="tab-base" aria-controls="pane-base" aria-selected="${state.tab === "base"}">Base de cálculo unificada</button>
    </div>
    <div id="pane-calculo" role="tabpanel" aria-labelledby="tab-calculo" ${state.tab === "calculo" ? "" : "hidden"}></div>
    <div id="pane-base" role="tabpanel" aria-labelledby="tab-base" ${state.tab === "base" ? "" : "hidden"}></div>`;

  const tabs = view.querySelectorAll('[role="tab"]');
  tabs.forEach((t) => t.addEventListener("click", () => {
    state.tab = t.id === "tab-base" ? "base" : "calculo";
    tabs.forEach((x) => x.setAttribute("aria-selected", String(x === t)));
    view.querySelector("#pane-calculo").hidden = state.tab !== "calculo";
    view.querySelector("#pane-base").hidden = state.tab !== "base";
  }));

  renderCalculo(view.querySelector("#pane-calculo"));
  renderBase(view.querySelector("#pane-base"));
}

// ===========================================================================
// Cálculo de tributos
// ===========================================================================
function renderCalculo(pane) {
  pane.innerHTML = html`
    <div class="stack">
      <section class="panel" aria-labelledby="op-t">
        <div class="panel-head"><div><h2 id="op-t">Dados da operação</h2><p>Data do fato gerador e local da operação.</p></div></div>
        <div class="panel-body">
          <div class="form-grid">
            <div class="field"><label for="rg-dh">Data e hora do fato gerador</label><input id="rg-dh" type="datetime-local" required value="${esc(state.dh)}"></div>
            <div class="field"><label for="rg-uf">UF</label><select id="rg-uf"><option value="">Selecione</option></select></div>
            <div class="field span-2"><label for="rg-mun">Município (código IBGE)</label><input id="rg-mun" inputmode="numeric" list="rg-mun-list" placeholder="Digite o nome ou o código" value="${esc(state.municipio)}" autocomplete="off"><datalist id="rg-mun-list"></datalist></div>
          </div>
          <div id="rg-aliq-note" style="margin-top:16px"></div>
        </div>
      </section>

      <section class="panel" aria-labelledby="itens-t">
        <div class="panel-head"><div><h2 id="itens-t">Itens da nota</h2><p>Um item por linha. Use NCM para bens e NBS para serviços.</p></div></div>
        <div class="panel-body">
          <div id="rg-grid"></div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;align-items:center">
            <button class="btn btn-primary" id="rg-calc">${icon("play")}Calcular tributos</button>
            <label class="field" style="flex-direction:row;align-items:center;gap:8px;margin-left:auto">
              <span>Documento</span>
              <select id="rg-xml-tipo" class="input" style="width:auto">
                ${["nfe", "nfce", "nfse", "cte", "cte-simplificado", "bpe", "bpe-tm", "nf3e"].map((t) => `<option value="${t}">${t.toUpperCase()}</option>`).join("")}
              </select>
            </label>
            <button class="btn" id="rg-xml">${icon("doc")}Gerar XML do grupo de tributação</button>
          </div>
        </div>
      </section>

      <section class="panel" id="rg-result" aria-live="polite" hidden></section>
    </div>`;

  const dh = pane.querySelector("#rg-dh");
  const ufSel = pane.querySelector("#rg-uf");
  const mun = pane.querySelector("#rg-mun");

  const grid = new ItemGrid(pane.querySelector("#rg-grid"), {
    label: "Itens da operação do regime geral",
    columns: COLUNAS,
    rows: state.itens || [novoItem()],
    newRow: novoItem,
    isDisabled: (k, row) => {
      const ano = anoDe(dh.value);
      if (["cbs", "ibsUf", "ibsMun"].includes(k)) return !!ano && ano < 2027;
      if (k === "base") return !!String(row.isBase || "").trim();
      return false;
    },
    footer: (rows) => {
      const soma = rows.reduce((s, r) => s + (parseBR(r.isBase) || parseBR(r.base) || 0), 0);
      return `Soma das bases informadas: <strong>${money(soma)}</strong>`;
    },
    onExample: () => {
      dh.value = EXEMPLO.dh; state.dh = EXEMPLO.dh;
      ufSel.value = EXEMPLO.uf; state.uf = EXEMPLO.uf;
      mun.value = EXEMPLO.municipio; state.municipio = EXEMPLO.municipio;
      loadMunicipios(EXEMPLO.uf);
      grid.setRows(EXEMPLO.itens.map((x) => ({ ...novoItem(), ...x })));
      state.itens = grid.rows;
      aliqNote();
      toast("Exemplo carregado", "Operação oficial de exemplo da Receita: arroz, cerveja com IS, serviço de educação e um item com erro proposital.");
    },
    onHelp: () => modal("Como preencher os itens", `
      <p><strong>NCM ou NBS</strong>: 8 dígitos para bens (NCM) ou 9 para serviços (NBS).</p>
      <p><strong>CST e cClassTrib</strong>: situação e classificação tributária do IBS/CBS. Elas definem reduções, isenções e regimes específicos.</p>
      <p><strong>Alíquotas</strong>: a partir de 2027 a API exige as alíquotas nominais de CBS, IBS estadual e IBS municipal; antes disso elas são proibidas e a API usa as de referência.</p>
      <p><strong>Imposto Seletivo</strong>: preencha CST IS, cClassTrib IS, base e alíquota do IS. Nesse caso deixe a base do item vazia; a base do IBS/CBS passa a ser a base do IS mais o IS.</p>
      <p class="muted">Selecione uma linha pelo número para duplicá-la, excluí-la ou mudar a ordem.</p>`)
  });
  state.itens = grid.rows;

  function aliqNote() {
    const ano = anoDe(dh.value);
    const box = pane.querySelector("#rg-aliq-note");
    if (!ano) { box.innerHTML = ""; return; }
    box.innerHTML = ano < 2027
      ? `<div class="callout">${icon("info")}<p>Em ${ano} a API usa as alíquotas de referência cadastradas, por isso as colunas de alíquota ficam bloqueadas.</p></div>`
      : `<div class="callout warn">${icon("info")}<p>A partir de 2027 as alíquotas nominais são obrigatórias em cada item. O resultado sai como cálculo simulado.</p></div>`;
    grid.refreshDisabled();
  }
  dh.addEventListener("change", () => { state.dh = dh.value; aliqNote(); });
  aliqNote();

  // UFs e municípios vindos dos dados abertos da API (com lista local de reserva).
  (async () => {
    let ufs;
    try { ({ data: ufs } = await api.regime.ufs()); } catch { ufs = demo.UFS; }
    ufSel.innerHTML = `<option value="">Selecione</option>${(ufs || []).sort((a, b) => a.sigla.localeCompare(b.sigla)).map((u) => `<option value="${esc(u.sigla)}">${esc(u.sigla)}, ${esc(u.nome)}</option>`).join("")}`;
    ufSel.value = state.uf || "";
    if (state.uf) loadMunicipios(state.uf);
  })();

  async function loadMunicipios(uf) {
    const list = pane.querySelector("#rg-mun-list");
    list.innerHTML = "";
    if (!uf) return;
    try {
      const { data } = await api.regime.municipios(uf);
      list.innerHTML = (data || []).map((m) => `<option value="${esc(m.codigo)}">${esc(m.nome)}</option>`).join("");
    } catch { /* sem lista: o código IBGE pode ser digitado */ }
  }
  ufSel.addEventListener("change", () => { state.uf = ufSel.value; mun.value = ""; state.municipio = ""; loadMunicipios(ufSel.value); });
  mun.addEventListener("input", () => { state.municipio = mun.value; });

  // ---------------------------------------------------------------------
  function montarOperacao() {
    grid.clearInvalid();
    const erros = [];
    const ano = anoDe(dh.value);
    if (!dh.value) erros.push("Informe a data e hora do fato gerador.");
    if (!ufSel.value) erros.push("Selecione a UF.");
    if (!/^\d{7}$/.test(mun.value.trim())) erros.push("Informe o código IBGE do município (7 dígitos).");

    const itens = grid.getRows().map((r, i) => {
      const bad = (k) => { grid.markInvalid(i, k); erros.push(`Item ${i + 1}: confira o campo ${COLUNAS.find((c) => c.key === k).label}.`); };
      const code = String(r.ncmNbs || "").replace(/\D/g, "");
      if (!/^\d{8,9}$/.test(code)) bad("ncmNbs");
      if (!/^\d{3}$/.test(r.cst || "")) bad("cst");
      if (!/^\d{6}$/.test(r.cClassTrib || "")) bad("cClassTrib");

      const temIS = String(r.isBase || "").trim() !== "";
      const item = { numero: i + 1, cst: r.cst, cClassTrib: r.cClassTrib };
      if (code.length === 9) item.nbs = code; else item.ncm = code;

      const qtd = parseBR(r.qtd);
      if (qtd) item.quantidade = qtd;
      if (r.un) item.unidade = r.un.toUpperCase();

      if (!temIS) {
        const base = parseBR(r.base);
        if (base === null || Number.isNaN(base) || base < 0) bad("base"); else item.baseCalculo = base;
      }

      if (ano && ano >= 2027) {
        const al = {};
        [["cbs", "cbs"], ["ibsUf", "ibsEstadual"], ["ibsMun", "ibsMunicipal"]].forEach(([k, campo]) => {
          const v = parseBR(r[k]);
          if (v === null || Number.isNaN(v)) bad(k); else al[campo] = v;
        });
        item.aliquotasNominais = al;
      }

      if (temIS) {
        const baseIS = parseBR(r.isBase);
        const aliqIS = parseBR(r.isAliq);
        if (Number.isNaN(baseIS)) bad("isBase");
        if (!/^\d{3}$/.test(r.isCst || "")) bad("isCst");
        if (!/^\d{6}$/.test(r.isClass || "")) bad("isClass");
        if (aliqIS === null || Number.isNaN(aliqIS)) bad("isAliq");
        item.impostoSeletivo = { cst: r.isCst, cClassTrib: r.isClass, baseCalculo: baseIS };
        if (qtd) item.impostoSeletivo.quantidade = qtd;
        if (r.un) item.impostoSeletivo.unidade = r.un.toUpperCase();
        if (!Number.isNaN(aliqIS) && aliqIS !== null) {
          item.impostoSeletivo.impostoInformado = Math.round(baseIS * aliqIS) / 100;
          if (item.aliquotasNominais) item.aliquotasNominais.impostoSeletivo = { adValorem: aliqIS };
        }
      }
      return item;
    });

    if (erros.length) {
      toast("Revise os dados da operação", erros.slice(0, 3).join(" ") + (erros.length > 3 ? ` E mais ${erros.length - 3}.` : ""), "error");
      return null;
    }
    return { id: randomId(), versao: "1.0.0", dhFatoGerador: offsetISO(dh.value), municipio: Number(mun.value.trim()), uf: ufSel.value, itens };
  }

  const resultBox = pane.querySelector("#rg-result");
  bindErrorChips(resultBox, (c) => api.regime.erro(c));

  pane.querySelector("#rg-calc").addEventListener("click", (e) => busy(e.currentTarget, async () => {
    const op = montarOperacao();
    if (!op) return;
    try {
      const res = await api.regime.calcularObservabilidade(op);
      state.resultado = res; state.ultimaOperacao = op;
      mostrarResultado(resultBox, res, op);
    } catch (err) {
      resultBox.hidden = false;
      resultBox.innerHTML = `<div class="panel-body">${errorCallout(err)}</div>`;
      toast("Não foi possível calcular", err.message, "error");
    }
  }));

  pane.querySelector("#rg-xml").addEventListener("click", (e) => busy(e.currentTarget, async () => {
    const op = montarOperacao();
    if (!op) return;
    const tipo = pane.querySelector("#rg-xml-tipo").value;
    try {
      const { data: resultado } = await api.regime.calcular(op);
      const { data: xml } = await api.regime.gerarXml(resultado, tipo);
      let valido = null, motivo = "";
      try { await api.regime.validarXml(xml, tipo, "grupo"); valido = true; }
      catch (err) { valido = false; motivo = err.message; }
      modal(`XML do grupo de tributação (${tipo.toUpperCase()})`, `
        ${valido ? `<div class="callout">${icon("check")}<p>XML válido contra o XSD oficial.</p></div>` : `<div class="callout err">${icon("alert")}<p>Validação contra o XSD: ${esc(motivo)}</p></div>`}
        <pre class="memo" style="max-height:320px">${esc(xml)}</pre>
        <div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-primary" id="dl-xml">${icon("download")}Baixar XML</button></div>`);
      document.getElementById("dl-xml").onclick = () => download(xml, `grupo-tributacao-${tipo}.xml`, "application/xml");
    } catch (err) {
      toast("Não foi possível gerar o XML", err.message, "error");
    }
  }));

  if (state.resultado && state.ultimaOperacao) mostrarResultado(resultBox, state.resultado, state.ultimaOperacao, false);
}

function mostrarResultado(box, res, op, notificar = true) {
  const data = res.data || {};
  const tot = (data.total && data.total.tribCalc) || {};
  const ibscbs = tot.IBSCBSTot || {};
  const vBC = toNum(ibscbs.vBCIBSCBS) || 0;
  const vCBS = toNum(ibscbs.gCBS && ibscbs.gCBS.vCBS) || 0;
  const vIBS = toNum(ibscbs.gIBS && ibscbs.gIBS.vIBS) || 0;
  const vIS = toNum(tot.ISTot && tot.ISTot.vIS) || 0;
  const total = vCBS + vIBS + vIS;
  const objetos = data.objetos || [];
  const comErro = objetos.filter((o) => o.erros && o.erros.length).length;
  const simulado = objetos.some((o) => o.estadoItem === "CALCULO_SIMULADO");

  box.hidden = false;
  box.innerHTML = html`
    <div class="panel-head">
      <div><h2>Resultado</h2><p>${objetos.length} ${objetos.length === 1 ? "item processado" : "itens processados"}${comErro ? `, ${comErro} com inconsistência` : ""}. Os totais somam só os itens calculados.</p></div>
      <div class="page-actions">
        <button class="btn btn-sm" id="rg-export">${icon("download")}Exportar JSON</button>
      </div>
    </div>
    <div class="panel-body stack">
      ${res.demo ? `<div class="callout warn">${icon("info")}<p>Modo demonstração: valores aproximados calculados no navegador. Para o cálculo oficial, rode a API e desative o modo demonstração.</p></div>` : ""}
      ${res.warning && !res.demo ? `<div class="callout">${icon("info")}<p>${esc(res.warning)}</p></div>` : ""}
      <div class="totals">
        <div class="total"><span>Base IBS/CBS</span><strong>${money(vBC)}</strong></div>
        <div class="total"><span>CBS</span><strong>${money(vCBS)}</strong></div>
        <div class="total"><span>IBS (UF + município)</span><strong>${money(vIBS)}</strong></div>
        <div class="total"><span>Imposto Seletivo</span><strong>${money(vIS)}</strong></div>
        <div class="total is-key"><span>Total de tributos</span><strong>${money(total)}</strong></div>
      </div>
      <div class="table-scroll">
        <table class="result-table">
          <thead><tr><th>Item</th><th>Situação</th><th class="num">Base</th><th class="num">CBS</th><th class="num">IBS UF</th><th class="num">IBS mun.</th><th class="num">IS</th><th></th></tr></thead>
          <tbody>
            ${objetos.map((o, i) => {
              const g = (o.tribCalc && o.tribCalc.IBSCBS && o.tribCalc.IBSCBS.gIBSCBS) || {};
              const is = (o.tribCalc && o.tribCalc.IS) || null;
              const cbs = g.gCBS || {}, uf = g.gIBSUF || {}, mun = g.gIBSMun || {};
              const ef = (grp, k) => (grp.gRed && grp.gRed.pAliqEfet !== undefined ? grp.gRed.pAliqEfet : grp[k]);
              const opItem = (op.itens || [])[i] || {};
              const memo = memorias(o.tribCalc);
              const erros = o.erros || [];
              return `<tr>
                <td><strong>${esc(o.nObj)}</strong><small>${esc(opItem.ncm ? `NCM ${opItem.ncm}` : opItem.nbs ? `NBS ${opItem.nbs}` : "")}</small></td>
                <td>${estadoBadge(o.estadoItem)}${erros.map((er) => `<p class="err-line"><button class="err-chip" data-erro="${esc(er.code)}" title="Ver a descrição oficial do código">${esc(er.code)}</button>${esc(er.detail || er.title)}</p>`).join("")}</td>
                <td class="num">${g.vBC !== undefined ? money(g.vBC) : "—"}</td>
                <td class="num">${cbs.vCBS !== undefined ? `${money(cbs.vCBS)}<small>${pct(ef(cbs, "pCBS"))}</small>` : "—"}</td>
                <td class="num">${uf.vIBSUF !== undefined ? `${money(uf.vIBSUF)}<small>${pct(ef(uf, "pIBSUF"))}</small>` : "—"}</td>
                <td class="num">${mun.vIBSMun !== undefined ? `${money(mun.vIBSMun)}<small>${pct(ef(mun, "pIBSMun"))}</small>` : "—"}</td>
                <td class="num">${is ? `${money(is.vIS)}<small>${pct(is.pIS)}</small>` : "—"}</td>
                <td>${memo.length ? `<button class="btn btn-sm btn-ghost" data-memo="${i}" aria-expanded="false">Memória</button>` : ""}</td>
              </tr>
              ${memo.length ? `<tr class="detail" data-memo-row="${i}" hidden><td colspan="8">${memo.map((m) => `<div class="memo"><strong>${esc(m.grupo)}</strong>\n${esc(m.texto)}</div>`).join("")}</td></tr>` : ""}`;
            }).join("")}
          </tbody>
        </table>
      </div>
      <details class="raw"><summary>Ver resposta completa da API</summary><pre>${esc(JSON.stringify(data, null, 2))}</pre></details>
    </div>`;

  box.querySelectorAll("[data-memo]").forEach((b) => b.addEventListener("click", () => {
    const row = box.querySelector(`[data-memo-row="${b.dataset.memo}"]`);
    row.hidden = !row.hidden;
    b.setAttribute("aria-expanded", String(!row.hidden));
  }));
  box.querySelector("#rg-export").onclick = () => download(JSON.stringify({ operacao: op, resultado: data }, null, 2), `apuracao-regime-geral-${op.id.slice(0, 8)}.json`);

  if (notificar) {
    toast(comErro ? "Cálculo concluído com inconsistências" : "Cálculo concluído",
      `CBS ${money(vCBS)}, IBS ${money(vIBS)}${vIS ? `, IS ${money(vIS)}` : ""}`, comErro ? "warn" : "ok");
    addHistory({
      tipo: "regime", demo: !!res.demo, titulo: `Operação ${op.uf} com ${op.itens.length} ${op.itens.length === 1 ? "item" : "itens"}`,
      total, cbs: vCBS, ibs: vIBS, status: comErro ? "erro" : simulado ? "simulado" : "ok"
    });
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// ===========================================================================
// Base de cálculo unificada
// ===========================================================================
const CAMPOS_BASE = [
  ["vProd", "Valor dos produtos"], ["vFrete", "Frete"], ["vSeg", "Seguro"], ["vOutro", "Outras despesas"],
  ["vDesc", "Desconto"], ["vII", "Imposto de Importação"], ["vIS", "Imposto Seletivo"], ["vPIS", "PIS"], ["vCOFINS", "Cofins"],
  ["vICMS", "ICMS"], ["vICMSUFDest", "ICMS UF destino"], ["vFCP", "FCP"], ["vFCPUFDest", "FCP UF destino"],
  ["vICMSMono", "ICMS monofásico"], ["vISSQN", "ISSQN"]
];
const EXEMPLO_BASE = { anoFatoGerador: 2027, tipoDocumento: 55, natureza: "bem", vProd: "1.000,00", vFrete: "50,00", vSeg: "20,00", vOutro: "10,00", vDesc: "50,00", vIS: "30,00", vPIS: "9,25", vCOFINS: "46,25", vICMS: "180,00", vFCP: "10,00" };

function renderBase(pane) {
  const b = state.base;
  pane.innerHTML = html`
    <div class="two-col">
      <section class="panel" aria-labelledby="base-t">
        <div class="panel-head">
          <div><h2 id="base-t">Componentes da NF-e ou NFC-e</h2><p>A API aplica a vigência de cada componente ao ano informado.</p></div>
          <button class="btn btn-sm" id="bu-ex">${icon("sample")}Carregar exemplo</button>
        </div>
        <form class="panel-body" id="bu-form" novalidate>
          <div class="form-grid">
            <div class="field"><label for="bu-ano">Ano do fato gerador</label><input id="bu-ano" name="anoFatoGerador" type="number" min="2026" max="2033" value="${esc(b.anoFatoGerador || new Date().getFullYear())}"></div>
            <div class="field"><label for="bu-doc">Documento</label><select id="bu-doc" name="tipoDocumento"><option value="55">NF-e (55)</option><option value="65">NFC-e (65)</option></select></div>
            <div class="field"><label for="bu-nat">Natureza</label><select id="bu-nat" name="natureza"><option value="bem">Bem</option><option value="servico">Serviço</option></select></div>
          </div>
          <div class="form-grid" style="margin-top:14px">
            ${CAMPOS_BASE.map(([k, l]) => `<div class="field"><label for="bu-${k}">${l}</label><input id="bu-${k}" name="${k}" inputmode="decimal" placeholder="0,00" value="${esc(b[k] || "")}" style="text-align:right"></div>`).join("")}
          </div>
          <div style="margin-top:18px"><button class="btn btn-primary" type="submit">${icon("play")}Calcular bases</button></div>
        </form>
      </section>
      <section class="panel" aria-labelledby="bu-res-t">
        <div class="panel-head"><div><h2 id="bu-res-t">Bases calculadas</h2><p>Regime geral, Imposto Seletivo e Simples Nacional.</p></div></div>
        <div class="panel-body" id="bu-res" aria-live="polite"><div class="empty"><p>Preencha os componentes e calcule para ver as três bases.</p></div></div>
      </section>
    </div>`;

  const form = pane.querySelector("#bu-form");
  form.tipoDocumento.value = String(b.tipoDocumento || 55);
  form.natureza.value = b.natureza || "bem";
  form.addEventListener("input", () => { Object.assign(state.base, Object.fromEntries(new FormData(form))); });

  pane.querySelector("#bu-ex").onclick = () => {
    state.base = { ...EXEMPLO_BASE };
    renderBase(pane);
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    busy(btn, async () => {
      const fd = Object.fromEntries(new FormData(form));
      const entrada = { anoFatoGerador: Number(fd.anoFatoGerador), tipoDocumento: Number(fd.tipoDocumento), natureza: fd.natureza };
      const invalidos = [];
      CAMPOS_BASE.forEach(([k, l]) => {
        const v = parseBR(fd[k]);
        if (Number.isNaN(v)) invalidos.push(l); else if (v !== null) entrada[k] = v;
      });
      if (invalidos.length) { toast("Revise os valores", `Valor inválido em: ${invalidos.join(", ")}.`, "error"); return; }
      const out = pane.querySelector("#bu-res");
      try {
        const res = await api.regime.baseUnificada(entrada);
        const d = res.data || {};
        out.innerHTML = `
          ${res.demo ? `<div class="callout warn" style="margin-bottom:14px">${icon("info")}<p>Modo demonstração: aproximação local.</p></div>` : ""}
          <div class="totals">
            <div class="total is-key"><span>Base do regime geral (IBS/CBS)</span><strong>${money(d.baseRG)}</strong></div>
            <div class="total"><span>Base do Imposto Seletivo</span><strong>${money(d.baseIS)}</strong></div>
            <div class="total"><span>Base do Simples Nacional</span><strong>${money(d.baseSN)}</strong></div>
          </div>
          ${(d.avisos || []).length ? `<h3 style="margin:18px 0 8px">Avisos da API</h3><ul style="margin:0;padding-left:18px;color:var(--muted);font-size:13.5px">${d.avisos.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : ""}
          <details class="raw" style="margin-top:14px"><summary>Ver resposta completa da API</summary><pre>${esc(JSON.stringify(d, null, 2))}</pre></details>`;
        toast("Bases calculadas", `Regime geral: ${money(d.baseRG)}`);
      } catch (err) {
        out.innerHTML = errorCallout(err);
        toast("Não foi possível calcular as bases", err.message, "error");
      }
    });
  });
}
