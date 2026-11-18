// Página 2: calculadora-rtc-simples-nacional (IBS e CBS para optantes do Simples Nacional).

import * as api from "../api.js";
import { ItemGrid } from "../grid.js";
import {
  esc, icon, money, pct, parseBR, toNum, toast, modal, busy, download, errorCallout,
  estadoBadge, addHistory, bindErrorChips, html
} from "../ui.js";

const novoItem = () => ({ cAtivSN: "", cClassTrib: "", base: "", is: "", pIBSSN: "", pCBSSN: "" });

// Valores de exemplo publicados no contrato OpenAPI da própria API.
const EXEMPLO = {
  data: "2027-03-15", tpDoc: "55", CRT: "1", tpRegimeIBSCBS: "", tpEnteGov: "",
  itens: [
    { cAtivSN: "01", cClassTrib: "000001", base: "950,00", is: "0,00", pIBSSN: "1,25", pCBSSN: "2,75" },
    { cAtivSN: "01", cClassTrib: "000001", base: "1.500,00", is: "0,00", pIBSSN: "1,25", pCBSSN: "2,75" }
  ]
};

const state = { data: "", tpDoc: "55", CRT: "1", tpRegimeIBSCBS: "", tpEnteGov: "", itens: null, resultado: null, op: null };

const dec2 = (v) => (v === null || v === undefined || Number.isNaN(v) ? undefined : v.toFixed(2));

export async function render(view) {
  view.innerHTML = html`
    <div class="page-head">
      <div>
        <h1>Simples Nacional</h1>
        <p>Cálculo do IBS e da CBS dentro do Simples Nacional, item a item, a partir da atividade e das alíquotas efetivas do contribuinte.</p>
      </div>
      <div class="page-actions"><a class="btn" href="${api.API_INFO.simples.repo}" target="_blank" rel="noopener">Repositório da API</a></div>
    </div>

    <div class="stack">
      <section class="panel" aria-labelledby="sn-op-t">
        <div class="panel-head"><div><h2 id="sn-op-t">Dados da operação</h2><p>Regime do emitente e documento fiscal.</p></div></div>
        <div class="panel-body">
          <div class="form-grid">
            <div class="field"><label for="sn-data">Data do fato gerador</label><input id="sn-data" type="date" value="${esc(state.data)}"></div>
            <div class="field"><label for="sn-doc">Documento</label>
              <select id="sn-doc"><option value="55">NF-e (55)</option><option value="65">NFC-e (65)</option></select></div>
            <div class="field"><label for="sn-crt">Regime do emitente (CRT)</label>
              <select id="sn-crt">
                <option value="1">1, Simples Nacional</option>
                <option value="2">2, excesso de sublimite</option>
                <option value="3">3, regime normal com apuração por fora</option>
              </select></div>
            <div class="field"><label for="sn-reg">Apuração do IBS/CBS</label>
              <select id="sn-reg"><option value="">Dentro do Simples</option><option value="2">2, apuração por fora</option></select>
              <span class="hint">Por fora só é admitida com CRT 3.</span></div>
            <div class="field"><label for="sn-gov">Compra governamental</label>
              <select id="sn-gov"><option value="">Não se aplica</option><option value="1">União</option><option value="2">Estado</option><option value="3">Distrito Federal</option><option value="4">Município</option></select></div>
          </div>
        </div>
      </section>

      <section class="panel" aria-labelledby="sn-it-t">
        <div class="panel-head">
          <div><h2 id="sn-it-t">Itens</h2><p>Alíquotas efetivas do Simples em pontos percentuais, como saem do PGDAS-D.</p></div>
        </div>
        <div class="panel-body">
          <div id="sn-grid"></div>
          <datalist id="sn-ativ-list"></datalist>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;align-items:center">
            <button class="btn btn-primary" id="sn-calc">${icon("play")}Calcular tributos</button>
            <span class="muted" id="sn-ativ-info" style="font-size:13px"></span>
          </div>
          <details class="raw" style="margin-top:14px" id="sn-ativ-det"><summary>Consultar atividades vigentes na data</summary><div id="sn-ativ-table" style="margin-top:10px"></div></details>
        </div>
      </section>

      <section class="panel" id="sn-result" aria-live="polite" hidden></section>
    </div>`;

  const $ = (s) => view.querySelector(s);
  const f = { data: $("#sn-data"), tpDoc: $("#sn-doc"), CRT: $("#sn-crt"), tpRegimeIBSCBS: $("#sn-reg"), tpEnteGov: $("#sn-gov") };
  Object.entries(f).forEach(([k, el]) => {
    if (k !== "data") el.value = state[k];
    el.addEventListener("change", () => {
      state[k] = el.value;
      if (k === "data" || k === "tpDoc") carregarAtividades();
      if (k === "CRT" && el.value !== "3") { f.tpRegimeIBSCBS.value = ""; state.tpRegimeIBSCBS = ""; }
    });
  });

  const grid = new ItemGrid($("#sn-grid"), {
    label: "Itens da operação do Simples Nacional",
    columns: [
      { key: "cAtivSN", label: "Atividade (cAtivSN)", placeholder: "01", width: "150px", list: "sn-ativ-list", maxlength: 2, title: "Código da atividade do Simples Nacional, com 2 dígitos" },
      { key: "cClassTrib", label: "cClassTrib", placeholder: "000001", width: "100px", digits: true, maxlength: 6 },
      { key: "base", label: "Base (R$)", type: "num", placeholder: "0,00", width: "130px", title: "vProd + vFrete + vSeg + vOutro - vDesc, sem o Imposto Seletivo" },
      { key: "is", label: "IS (R$)", type: "num", placeholder: "0,00", width: "110px", title: "Valor do Imposto Seletivo já calculado. Não compõe a receita bruta." },
      { key: "pIBSSN", label: "IBS efetivo %", type: "num", placeholder: "0,00", width: "110px" },
      { key: "pCBSSN", label: "CBS efetiva %", type: "num", placeholder: "0,00", width: "110px" }
    ],
    rows: state.itens || [novoItem()],
    newRow: novoItem,
    footer: (rows) => `Receita informada: <strong>${money(rows.reduce((s, r) => s + (parseBR(r.base) || 0), 0))}</strong>`,
    onExample: () => {
      Object.assign(state, { data: EXEMPLO.data, tpDoc: EXEMPLO.tpDoc, CRT: EXEMPLO.CRT, tpRegimeIBSCBS: "", tpEnteGov: "" });
      Object.entries(f).forEach(([k, el]) => { el.value = state[k]; });
      grid.setRows(EXEMPLO.itens);
      state.itens = grid.rows;
      carregarAtividades();
      toast("Exemplo carregado", "Valores de exemplo do contrato OpenAPI da calculadora do Simples Nacional.");
    },
    onHelp: () => modal("Como preencher os itens", `
      <p><strong>Atividade (cAtivSN)</strong>: código oficial da atividade do Simples, com 2 dígitos. A lista ao digitar vem da própria API, filtrada pela data e pelo documento.</p>
      <p><strong>cClassTrib</strong>: obrigatória. Define o tipo de receita bruta do item.</p>
      <p><strong>Base</strong>: valor do produto mais frete, seguro e outras despesas, menos o desconto, sem o Imposto Seletivo.</p>
      <p><strong>Alíquotas efetivas</strong>: percentuais de IBS e CBS do Simples para a faixa de faturamento do contribuinte.</p>
      <p class="muted">Item sem atividade válida não é calculado e aparece como "Não calculado", sem erro.</p>`)
  });
  state.itens = grid.rows;

  // Atividades vigentes vindas da API.
  async function carregarAtividades() {
    const info = $("#sn-ativ-info"), list = $("#sn-ativ-list"), table = $("#sn-ativ-table");
    if (!f.data.value) { info.textContent = "Informe a data para carregar as atividades vigentes."; table.innerHTML = ""; return; }
    info.textContent = "Carregando atividades vigentes…";
    try {
      const { data } = await api.simples.atividades(f.data.value, f.tpDoc.value);
      const ativ = Array.isArray(data) ? data : [];
      list.innerHTML = ativ.map((a) => `<option value="${esc(a.codigo)}">${esc(a.descricao)}</option>`).join("");
      info.textContent = `${ativ.length} atividades vigentes em ${new Date(`${f.data.value}T12:00`).toLocaleDateString("pt-BR")}.`;
      table.innerHTML = ativ.length ? `<div class="table-scroll" style="max-height:320px"><table class="result-table"><thead><tr><th>Código</th><th>Atividade</th><th>Anexo</th></tr></thead><tbody>
        ${ativ.map((a) => `<tr><td><strong>${esc(a.codigo)}</strong></td><td>${esc(a.descricao)}</td><td>${esc(a.rotuloCurtoAnexo || a.rotuloAnexo || a.anexoSemFatorR || "")}</td></tr>`).join("")}
        </tbody></table></div>` : "<p class='muted'>Nenhuma atividade vigente para esses filtros.</p>";
    } catch (err) {
      info.textContent = "Lista de atividades indisponível. Digite o código manualmente.";
      table.innerHTML = errorCallout(err);
    }
  }
  carregarAtividades();

  function montarOperacao() {
    grid.clearInvalid();
    const erros = [];
    if (!f.data.value) erros.push("Informe a data do fato gerador.");
    if (f.tpRegimeIBSCBS.value === "2" && f.CRT.value !== "3") erros.push("Apuração por fora só é admitida com CRT 3.");
    if (f.CRT.value === "3" && f.tpRegimeIBSCBS.value !== "2") erros.push("Com CRT 3 este cálculo exige apuração por fora.");

    const itens = grid.getRows().map((r, i) => {
      const bad = (k, label) => { grid.markInvalid(i, k); erros.push(`Item ${i + 1}: confira ${label}.`); };
      if (!/^\d{6}$/.test(r.cClassTrib || "")) bad("cClassTrib", "a cClassTrib");
      const ativ = String(r.cAtivSN || "").trim();
      if (ativ && !/^\d{1,2}$/.test(ativ)) bad("cAtivSN", "o código da atividade");
      const base = parseBR(r.base), is = parseBR(r.is), pI = parseBR(r.pIBSSN), pC = parseBR(r.pCBSSN);
      if (base === null || Number.isNaN(base)) bad("base", "a base");
      if (Number.isNaN(is)) bad("is", "o IS");
      if (Number.isNaN(pI)) bad("pIBSSN", "a alíquota de IBS");
      if (Number.isNaN(pC)) bad("pCBSSN", "a alíquota de CBS");
      const item = {
        numero: i + 1,
        cAtivSN: ativ ? ativ.padStart(2, "0") : undefined,
        cClassTrib: r.cClassTrib,
        baseCalculo: dec2(base),
        valorImpostoSeletivo: dec2(is ?? 0),
        pIBSSN: pI === null ? undefined : String(pI),
        pCBSSN: pC === null ? undefined : String(pC)
      };
      Object.keys(item).forEach((k) => item[k] === undefined && delete item[k]);
      return item;
    });

    if (erros.length) {
      toast("Revise os dados da operação", erros.slice(0, 3).join(" ") + (erros.length > 3 ? ` E mais ${erros.length - 3}.` : ""), "error");
      return null;
    }
    const op = {
      id: [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, "0")).join(""),
      versao: "2.0.0", data: f.data.value, tpDoc: f.tpDoc.value, CRT: f.CRT.value, itens
    };
    if (f.tpRegimeIBSCBS.value) op.tpRegimeIBSCBS = f.tpRegimeIBSCBS.value;
    if (f.tpEnteGov.value) op.tpEnteGov = f.tpEnteGov.value;
    return op;
  }

  const box = $("#sn-result");
  bindErrorChips(box, (c) => api.simples.erro(c));

  $("#sn-calc").addEventListener("click", (e) => busy(e.currentTarget, async () => {
    const op = montarOperacao();
    if (!op) return;
    try {
      const res = await api.simples.calcular(op);
      state.resultado = res; state.op = op;
      mostrar(box, res, op);
    } catch (err) {
      box.hidden = false;
      box.innerHTML = `<div class="panel-body">${errorCallout(err)}</div>`;
      toast("Não foi possível calcular", err.message, "error");
    }
  }));

  if (state.resultado) mostrar(box, state.resultado, state.op, false);
}

function mostrar(box, res, op, notificar = true) {
  const d = res.data || {};
  const t = d.total || {};
  const objetos = d.objetos || [];
  const comErro = objetos.filter((o) => o.erros && o.erros.length).length;
  const pend = (toNum(t.vIBSSNtotPendSusp) || 0) + (toNum(t.vCBSSNtotPendSusp) || 0);
  const vIBS = toNum(t.vIBSSNtot) || 0, vCBS = toNum(t.vCBSSNtot) || 0;
  const total = toNum(t.totalTributos) ?? vIBS + vCBS + (toNum(t.totalIs) || 0);

  box.hidden = false;
  box.innerHTML = html`
    <div class="panel-head">
      <div><h2>Resultado</h2><p>${objetos.length} ${objetos.length === 1 ? "item processado" : "itens processados"}${comErro ? `, ${comErro} com inconsistência` : ""}.</p></div>
      <button class="btn btn-sm" id="sn-export">${icon("download")}Exportar JSON</button>
    </div>
    <div class="panel-body stack">
      ${res.demo ? `<div class="callout warn">${icon("info")}<p>Modo demonstração: valores aproximados calculados no navegador. Para o cálculo oficial, rode a API e desative o modo demonstração.</p></div>` : ""}
      <div class="totals">
        <div class="total"><span>Receita bruta</span><strong>${money(t.vRBSNtot)}</strong></div>
        <div class="total"><span>IBS</span><strong>${money(vIBS)}</strong></div>
        <div class="total"><span>CBS</span><strong>${money(vCBS)}</strong></div>
        <div class="total"><span>Imposto Seletivo</span><strong>${money(t.totalIs)}</strong></div>
        <div class="total is-key"><span>Total de tributos</span><strong>${money(total)}</strong></div>
      </div>
      ${pend ? `<div class="callout warn">${icon("info")}<p>Há ${money(pend)} de IBS/CBS com exigibilidade pendente ou suspensa.</p></div>` : ""}
      <div class="table-scroll">
        <table class="result-table">
          <thead><tr><th>Item</th><th>Situação</th><th>Tipo de receita</th><th class="num">Receita</th><th class="num">IBS</th><th class="num">CBS</th><th class="num">IS</th><th class="num">Total do item</th></tr></thead>
          <tbody>${objetos.map((o, i) => {
            const c = o.tribCalc || {};
            const it = (op.itens || [])[i] || {};
            return `<tr>
              <td><strong>${esc(o.nObj)}</strong><small>${it.cAtivSN ? `Atividade ${esc(it.cAtivSN)}` : "Sem atividade"}</small></td>
              <td>${estadoBadge(o.estadoItem)}${(o.erros || []).map((er) => `<p class="err-line"><button class="err-chip" data-erro="${esc(er.code)}" title="Ver a descrição oficial do código">${esc(er.code)}</button>${esc(er.detail || er.title)}</p>`).join("")}</td>
              <td>${esc(c.tpRBSNDescricao || (c.tpRBSN ? `Tipo ${c.tpRBSN}` : "—"))}</td>
              <td class="num">${money(c.vRBSNitem)}</td>
              <td class="num">${c.vIBSSN !== undefined ? `${money(c.vIBSSN)}<small>${pct(c.pIBSSN)}</small>` : "—"}${toNum(c.vIBSPendSusp) ? `<small>pendente ${money(c.vIBSPendSusp)}</small>` : ""}</td>
              <td class="num">${c.vCBSSN !== undefined ? `${money(c.vCBSSN)}<small>${pct(c.pCBSSN)}</small>` : "—"}${toNum(c.vCBSPendSusp) ? `<small>pendente ${money(c.vCBSPendSusp)}</small>` : ""}</td>
              <td class="num">${c.IS ? money(c.IS.valor) : "—"}</td>
              <td class="num"><strong>${money(c.totalItem)}</strong></td>
            </tr>`;
          }).join("")}</tbody>
        </table>
      </div>
      <details class="raw"><summary>Ver resposta completa da API</summary><pre>${esc(JSON.stringify(d, null, 2))}</pre></details>
    </div>`;

  box.querySelector("#sn-export").onclick = () => download(JSON.stringify({ operacao: op, resultado: d }, null, 2), `apuracao-simples-${op.id.slice(0, 8)}.json`);

  if (notificar) {
    toast(comErro ? "Cálculo concluído com inconsistências" : "Cálculo concluído", `IBS ${money(vIBS)}, CBS ${money(vCBS)}`, comErro ? "warn" : "ok");
    addHistory({ tipo: "simples", demo: !!res.demo, titulo: `Simples Nacional, CRT ${op.CRT}, ${op.itens.length} ${op.itens.length === 1 ? "item" : "itens"}`, total, cbs: vCBS, ibs: vIBS, status: comErro ? "erro" : "ok" });
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
