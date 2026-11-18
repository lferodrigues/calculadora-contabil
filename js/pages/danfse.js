// Página 3: calculadora-rtc-gerador-danfse (PDF do DANFSe a partir do XML da NFS-e).

import * as api from "../api.js";
import { esc, icon, money, toast, modal, busy, download, errorCallout, addHistory, html, parseBR, today } from "../ui.js";

const state = { tab: "arquivo", xml: "", nome: "", form: null, pdfUrl: null };

const FORM_PADRAO = {
  nNFSe: "1", serie: "1", nDPS: "1", dhEmi: `${today()}T10:00`, dCompet: today(),
  prestDoc: "12345678000195", prestNome: "Prestadora de Serviços Exemplo Ltda", prestIM: "", prestEmail: "", prestMun: "3550308", prestUF: "SP", prestCEP: "01001000", prestLgr: "Praça da Sé", prestNro: "100", prestBairro: "Sé",
  opSimpNac: "3",
  tomaDoc: "", tomaNome: "", tomaEmail: "", tomaMun: "", tomaCEP: "",
  cTribNac: "010101", xDescServ: "Análise e desenvolvimento de sistemas", xInfComp: "",
  vServ: "1.000,00", tribISSQN: "1", tpRetISSQN: "1", pAliq: "2,00"
};

const ONLY_DIGITS = (s) => String(s || "").replace(/\D/g, "");
const xmlEsc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
const tag = (name, value) => (value === undefined || value === null || value === "" ? "" : `<${name}>${xmlEsc(value)}</${name}>`);
const fix2 = (n) => (Math.round(n * 100) / 100).toFixed(2);

function offset(local) {
  const d = new Date(local);
  const off = -d.getTimezoneOffset();
  const s = off >= 0 ? "+" : "-";
  return `${local}:00${s}${String(Math.floor(Math.abs(off) / 60)).padStart(2, "0")}:${String(Math.abs(off) % 60).padStart(2, "0")}`;
}

// Monta um XML de NFS-e de HOMOLOGAÇÃO (tpAmb = 2). O DANFSe sai marcado
// como "NFS-e SEM VALIDADE JURÍDICA": serve para conferir o layout.
function montarXml(f) {
  const vServ = parseBR(f.vServ) || 0;
  const aliq = parseBR(f.pAliq) || 0;
  const tributavel = f.tribISSQN === "1";
  const vISS = tributavel ? Math.round(vServ * aliq) / 100 : 0;
  const retido = f.tpRetISSQN !== "1";
  const vLiq = vServ - (retido ? vISS : 0);
  const prestDoc = ONLY_DIGITS(f.prestDoc);
  const tomaDoc = ONLY_DIGITS(f.tomaDoc);
  const docTag = (d) => (d.length === 11 ? tag("CPF", d) : tag("CNPJ", d));
  const dh = offset(f.dhEmi);
  const nNFSe = ONLY_DIGITS(f.nNFSe) || "1";
  const id = `NFS${ONLY_DIGITS(f.prestMun).padStart(7, "0")}2${prestDoc.length === 11 ? "1" : "2"}${prestDoc.padStart(14, "0")}${nNFSe.padStart(13, "0")}${dh.slice(2, 4)}${dh.slice(5, 7)}${"0".repeat(9)}0`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<NFSe versao="1.00" xmlns="http://www.sped.fazenda.gov.br/nfse">
  <infNFSe Id="${id}">
    ${tag("xLocEmi", "")}
    ${tag("nNFSe", nNFSe)}
    <cLocIncid>${xmlEsc(ONLY_DIGITS(f.prestMun))}</cLocIncid>
    ${tag("xTribNac", f.xDescServ)}
    <ambGer>2</ambGer>
    <cStat>100</cStat>
    <dhProc>${dh}</dhProc>
    <emit>
      ${docTag(prestDoc)}
      ${tag("IM", f.prestIM)}
      ${tag("xNome", f.prestNome)}
      <enderNac>
        ${tag("xLgr", f.prestLgr)}${tag("nro", f.prestNro)}${tag("xBairro", f.prestBairro)}
        ${tag("cMun", ONLY_DIGITS(f.prestMun))}${tag("UF", (f.prestUF || "").toUpperCase())}${tag("CEP", ONLY_DIGITS(f.prestCEP))}
      </enderNac>
      ${tag("email", f.prestEmail)}
    </emit>
    <valores>
      <vBC>${fix2(vServ)}</vBC>
      ${tributavel ? `<pAliqAplic>${fix2(aliq)}</pAliqAplic><vISSQN>${fix2(vISS)}</vISSQN>` : ""}
      ${retido ? `<vTotalRet>${fix2(vISS)}</vTotalRet>` : ""}
      <vLiq>${fix2(vLiq)}</vLiq>
    </valores>
    <DPS versao="1.00">
      <infDPS>
        <tpAmb>2</tpAmb>
        <dhEmi>${dh}</dhEmi>
        ${tag("serie", f.serie)}
        ${tag("nDPS", f.nDPS)}
        <dCompet>${xmlEsc(f.dCompet)}</dCompet>
        <tpEmit>1</tpEmit>
        <cLocEmi>${xmlEsc(ONLY_DIGITS(f.prestMun))}</cLocEmi>
        <prest>
          ${docTag(prestDoc)}
          <regTrib><opSimpNac>${xmlEsc(f.opSimpNac)}</opSimpNac><regEspTrib>0</regEspTrib></regTrib>
        </prest>
        ${tomaDoc || f.tomaNome ? `<toma>
          ${docTag(tomaDoc)}
          ${tag("xNome", f.tomaNome)}
          ${ONLY_DIGITS(f.tomaMun) ? `<end><endNac>${tag("cMun", ONLY_DIGITS(f.tomaMun))}${tag("CEP", ONLY_DIGITS(f.tomaCEP))}</endNac></end>` : ""}
          ${tag("email", f.tomaEmail)}
        </toma>` : ""}
        <serv>
          <locPrest><cLocPrestacao>${xmlEsc(ONLY_DIGITS(f.prestMun))}</cLocPrestacao></locPrest>
          <cServ>${tag("cTribNac", ONLY_DIGITS(f.cTribNac))}${tag("xDescServ", f.xDescServ)}</cServ>
          ${f.xInfComp ? `<infoCompl>${tag("xInfComp", f.xInfComp)}</infoCompl>` : ""}
        </serv>
        <valores>
          <vServPrest><vServ>${fix2(vServ)}</vServ></vServPrest>
          <trib>
            <tribMun><tribISSQN>${xmlEsc(f.tribISSQN)}</tribISSQN><tpRetISSQN>${xmlEsc(f.tpRetISSQN)}</tpRetISSQN>${tributavel ? `<pAliq>${fix2(aliq)}</pAliq>` : ""}</tribMun>
            <totTrib><indTotTrib>0</indTotTrib></totTrib>
          </trib>
        </valores>
      </infDPS>
    </DPS>
  </infNFSe>
</NFSe>`.replace(/^\s*\n/gm, "");
}

// Lê os principais campos de um XML de NFS-e para a pré-visualização.
function lerXml(xml) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) return { erro: "O conteúdo não é um XML válido. Confira se o arquivo está completo." };
  const root = doc.documentElement;
  if (!root || root.localName !== "NFSe") return { erro: `O XML precisa ter <NFSe> como elemento raiz (encontrado <${root ? root.localName : "?"}>).` };
  const pick = (path) => {
    let node = root;
    for (const name of path.split("/")) {
      node = node && [...node.children].find((c) => c.localName === name);
    }
    return node ? node.textContent.trim() : "";
  };
  return {
    numero: pick("infNFSe/nNFSe"),
    dhProc: pick("infNFSe/dhProc"),
    cStat: pick("infNFSe/cStat"),
    tpAmb: pick("infNFSe/DPS/infDPS/tpAmb"),
    competencia: pick("infNFSe/DPS/infDPS/dCompet"),
    prestador: pick("infNFSe/emit/xNome"),
    prestDoc: pick("infNFSe/emit/CNPJ") || pick("infNFSe/emit/CPF"),
    tomador: pick("infNFSe/DPS/infDPS/toma/xNome"),
    tomaDoc: pick("infNFSe/DPS/infDPS/toma/CNPJ") || pick("infNFSe/DPS/infDPS/toma/CPF"),
    servico: pick("infNFSe/DPS/infDPS/serv/cServ/xDescServ"),
    cTribNac: pick("infNFSe/DPS/infDPS/serv/cServ/cTribNac"),
    vServ: pick("infNFSe/DPS/infDPS/valores/vServPrest/vServ"),
    vISSQN: pick("infNFSe/valores/vISSQN"),
    vLiq: pick("infNFSe/valores/vLiq"),
    temIBSCBS: !!root.querySelector("IBSCBS, *|IBSCBS") || /<\s*(\w+:)?IBSCBS[\s>]/.test(xml)
  };
}

const fmtDoc = (d) => (d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : d.length === 11 ? d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : d);

function previewHtml(xml) {
  if (!xml.trim()) return `<div class="empty"><p>Envie um arquivo, cole o XML ou monte a nota no formulário para ver os dados aqui.</p></div>`;
  const d = lerXml(xml);
  if (d.erro) return `<div class="callout err">${icon("alert")}<p>${esc(d.erro)}</p></div>`;
  const dt = (v) => (v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
  return `<div class="nota">
    <div class="nota-head"><div><strong>NFS-e nº ${esc(d.numero || "—")}</strong><small>Processada em ${esc(dt(d.dhProc))}</small></div>
      ${d.tpAmb === "2" ? '<span class="badge badge-warn">Homologação</span>' : d.tpAmb === "1" ? '<span class="badge badge-ok">Produção</span>' : ""}</div>
    <section><h4>Prestador</h4><dl><dt>Nome</dt><dd>${esc(d.prestador || "—")}</dd><dt>CPF/CNPJ</dt><dd>${esc(fmtDoc(d.prestDoc) || "—")}</dd></dl></section>
    <section><h4>Tomador</h4><dl><dt>Nome</dt><dd>${esc(d.tomador || "Não identificado")}</dd><dt>CPF/CNPJ</dt><dd>${esc(fmtDoc(d.tomaDoc) || "—")}</dd></dl></section>
    <section><h4>Serviço</h4><dl><dt>Código nacional</dt><dd>${esc(d.cTribNac || "—")}</dd><dt>Descrição</dt><dd>${esc(d.servico || "—")}</dd><dt>Competência</dt><dd>${esc(d.competencia || "—")}</dd></dl></section>
    <section><h4>Valores</h4><dl><dt>Serviço</dt><dd>${money(d.vServ)}</dd><dt>ISSQN</dt><dd>${d.vISSQN ? money(d.vISSQN) : "—"}</dd><dt>Valor líquido</dt><dd><strong>${money(d.vLiq)}</strong></dd><dt>Grupo IBS/CBS</dt><dd>${d.temIBSCBS ? "Presente" : "Ausente"}</dd></dl></section>
  </div>`;
}

export async function render(view) {
  if (!state.form) state.form = { ...FORM_PADRAO };
  const F = state.form;
  const inp = (k, label, extra = "") => `<div class="field"><label for="df-${k}">${label}</label><input id="df-${k}" name="${k}" value="${esc(F[k])}" ${extra}></div>`;

  view.innerHTML = html`
    <div class="page-head">
      <div>
        <h1>Gerador de DANFSe</h1>
        <p>Gera o PDF do Documento Auxiliar da NFS-e a partir do XML da nota, pelo serviço oficial da Receita Federal.</p>
      </div>
      <div class="page-actions"><a class="btn" href="${api.API_INFO.danfse.repo}" target="_blank" rel="noopener">Repositório da API</a></div>
    </div>

    <div class="two-col">
      <div class="stack">
        <section class="panel">
          <div class="panel-body" style="padding-bottom:6px">
            <div class="tabs" role="tablist" style="margin-bottom:18px">
              <button role="tab" id="df-tab-arquivo" aria-selected="${state.tab === "arquivo"}">Enviar XML</button>
              <button role="tab" id="df-tab-form" aria-selected="${state.tab === "form"}">Montar nota de teste</button>
            </div>

            <div id="df-pane-arquivo" ${state.tab === "arquivo" ? "" : "hidden"}>
              <label class="empty" id="df-drop" style="display:block;cursor:pointer">
                <input type="file" id="df-file" accept=".xml,application/xml,text/xml" class="sr-only">
                <p style="margin:0 0 4px">${icon("upload").replace("<svg", '<svg style="width:22px;height:22px;color:var(--pine)"')}</p>
                <p style="margin:0"><strong>Escolha o XML da NFS-e</strong> ou arraste o arquivo para cá.</p>
                <p style="margin:4px 0 0;font-size:13px" id="df-file-name">${state.nome ? `Arquivo: ${esc(state.nome)}` : "Até 5 MB."}</p>
              </label>
              <div class="field" style="margin-top:14px">
                <label for="df-xml">Ou cole o XML</label>
                <textarea id="df-xml" rows="9" spellcheck="false" placeholder="<NFSe versao=&quot;1.00&quot;>…</NFSe>">${esc(state.xml)}</textarea>
              </div>
            </div>

            <form id="df-pane-form" ${state.tab === "form" ? "" : "hidden"} novalidate>
              <div class="callout warn" style="margin-bottom:16px">${icon("info")}<p>A nota montada aqui sai em ambiente de homologação, e o DANFSe é marcado como "NFS-e sem validade jurídica". Use para conferir o layout; para notas reais, envie o XML autorizado.</p></div>
              <h3 style="margin-bottom:10px">Nota</h3>
              <div class="form-grid">
                ${inp("nNFSe", "Número da NFS-e", 'inputmode="numeric"')}
                ${inp("serie", "Série da DPS")}
                ${inp("nDPS", "Número da DPS", 'inputmode="numeric"')}
                ${inp("dhEmi", "Emissão", 'type="datetime-local"')}
                ${inp("dCompet", "Competência", 'type="date"')}
              </div>
              <h3 style="margin:20px 0 10px">Prestador</h3>
              <div class="form-grid">
                ${inp("prestDoc", "CNPJ ou CPF", 'inputmode="numeric"')}
                <div class="field span-2"><label for="df-prestNome">Razão social</label><input id="df-prestNome" name="prestNome" value="${esc(F.prestNome)}"></div>
                ${inp("prestIM", "Inscrição municipal")}
                ${inp("prestMun", "Município (IBGE)", 'inputmode="numeric" maxlength="7"')}
                ${inp("prestUF", "UF", 'maxlength="2"')}
                ${inp("prestCEP", "CEP", 'inputmode="numeric"')}
                ${inp("prestLgr", "Logradouro")}
                ${inp("prestNro", "Número")}
                ${inp("prestBairro", "Bairro")}
                ${inp("prestEmail", "E-mail", 'type="email"')}
                <div class="field"><label for="df-opSimpNac">Simples Nacional</label><select id="df-opSimpNac" name="opSimpNac">
                  <option value="1">Não optante</option><option value="2">Optante MEI</option><option value="3">Optante ME/EPP</option></select></div>
              </div>
              <h3 style="margin:20px 0 10px">Tomador</h3>
              <div class="form-grid">
                ${inp("tomaDoc", "CNPJ ou CPF", 'inputmode="numeric"')}
                <div class="field span-2"><label for="df-tomaNome">Nome ou razão social</label><input id="df-tomaNome" name="tomaNome" value="${esc(F.tomaNome)}"></div>
                ${inp("tomaMun", "Município (IBGE)", 'inputmode="numeric" maxlength="7"')}
                ${inp("tomaCEP", "CEP", 'inputmode="numeric"')}
                ${inp("tomaEmail", "E-mail", 'type="email"')}
              </div>
              <h3 style="margin:20px 0 10px">Serviço e valores</h3>
              <div class="form-grid">
                ${inp("cTribNac", "Código de tributação nacional", 'inputmode="numeric" maxlength="6"')}
                <div class="field span-2"><label for="df-xDescServ">Descrição do serviço</label><input id="df-xDescServ" name="xDescServ" value="${esc(F.xDescServ)}"></div>
                ${inp("vServ", "Valor do serviço (R$)", 'inputmode="decimal" style="text-align:right"')}
                <div class="field"><label for="df-tribISSQN">Tributação do ISSQN</label><select id="df-tribISSQN" name="tribISSQN">
                  <option value="1">Operação tributável</option><option value="2">Imunidade</option><option value="3">Exportação de serviço</option><option value="4">Não incidência</option></select></div>
                ${inp("pAliq", "Alíquota do ISS (%)", 'inputmode="decimal" style="text-align:right"')}
                <div class="field"><label for="df-tpRetISSQN">Retenção do ISSQN</label><select id="df-tpRetISSQN" name="tpRetISSQN">
                  <option value="1">Não retido</option><option value="2">Retido pelo tomador</option><option value="3">Retido pelo intermediário</option></select></div>
                <div class="field span-all"><label for="df-xInfComp">Informações complementares</label><input id="df-xInfComp" name="xInfComp" value="${esc(F.xInfComp)}"></div>
              </div>
              <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
                <button type="button" class="btn" id="df-ver-xml">${icon("doc")}Ver XML montado</button>
              </div>
            </form>
          </div>

          <div class="panel-body" style="border-top:1px solid var(--line)">
            <div class="form-grid" style="align-items:end">
              <div class="field"><label for="df-stc">Situação da nota</label><select id="df-stc"><option value="0">Válida</option><option value="1">Substituída</option><option value="2">Cancelada</option></select></div>
              <label class="check" style="height:38px"><input type="checkbox" id="df-canhoto" checked> Incluir canhoto</label>
            </div>
            <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
              <button class="btn btn-primary" id="df-gerar">${icon("doc")}Gerar DANFSe</button>
              <button class="btn btn-ghost" id="df-limpar">Limpar</button>
            </div>
          </div>
        </section>
      </div>

      <div class="stack">
        <section class="panel" aria-labelledby="df-prev-t">
          <div class="panel-head"><div><h2 id="df-prev-t">Conferência dos dados</h2><p>Lido do XML antes do envio.</p></div></div>
          <div class="panel-body" id="df-preview" aria-live="polite"></div>
        </section>
        <section class="panel" id="df-result" hidden aria-live="polite"></section>
      </div>
    </div>`;

  const $ = (s) => view.querySelector(s);
  const form = $("#df-pane-form");
  form.opSimpNac.value = F.opSimpNac; form.tribISSQN.value = F.tribISSQN; form.tpRetISSQN.value = F.tpRetISSQN;

  const xmlAtual = () => (state.tab === "form" ? montarXml(state.form) : state.xml);
  const atualizarPreview = () => { $("#df-preview").innerHTML = previewHtml(xmlAtual()); };
  atualizarPreview();

  // Abas
  view.querySelectorAll('[role="tab"]').forEach((t) => t.addEventListener("click", () => {
    state.tab = t.id === "df-tab-form" ? "form" : "arquivo";
    view.querySelectorAll('[role="tab"]').forEach((x) => x.setAttribute("aria-selected", String(x === t)));
    $("#df-pane-arquivo").hidden = state.tab !== "arquivo";
    form.hidden = state.tab !== "form";
    atualizarPreview();
  }));

  // Arquivo e colagem
  const lerArquivo = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast("Arquivo grande demais", "O limite padrão do serviço é 5 MB.", "error"); return; }
    state.xml = await file.text();
    state.nome = file.name;
    $("#df-xml").value = state.xml;
    $("#df-file-name").textContent = `Arquivo: ${file.name}`;
    atualizarPreview();
  };
  $("#df-file").addEventListener("change", (e) => lerArquivo(e.target.files[0]));
  const drop = $("#df-drop");
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.style.borderColor = "var(--pine)"; }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.style.borderColor = ""; }));
  drop.addEventListener("drop", (e) => lerArquivo(e.dataTransfer.files[0]));
  $("#df-xml").addEventListener("input", (e) => { state.xml = e.target.value; state.nome = ""; atualizarPreview(); });

  // Formulário
  form.addEventListener("input", () => { Object.assign(state.form, Object.fromEntries(new FormData(form))); atualizarPreview(); });
  $("#df-ver-xml").addEventListener("click", () => {
    const xml = montarXml(state.form);
    modal("XML montado", `<pre class="memo" style="max-height:420px">${esc(xml)}</pre><div style="margin-top:12px"><button class="btn btn-primary" id="dl-nfse-xml">${icon("download")}Baixar XML</button></div>`);
    document.getElementById("dl-nfse-xml").onclick = () => download(xml, `nfse-homologacao-${state.form.nNFSe || 1}.xml`, "application/xml");
  });

  $("#df-limpar").addEventListener("click", () => {
    if (state.tab === "form") state.form = { ...FORM_PADRAO };
    else { state.xml = ""; state.nome = ""; }
    render(view);
  });

  // Geração do PDF
  const result = $("#df-result");
  const mostrarPdf = (blob, nome) => {
    if (state.pdfUrl) URL.revokeObjectURL(state.pdfUrl);
    state.pdfUrl = URL.createObjectURL(blob);
    result.hidden = false;
    result.innerHTML = `
      <div class="panel-head"><div><h2>DANFSe gerado</h2><p>${esc(nome)}, ${(blob.size / 1024).toFixed(0)} KB.</p></div>
        <div class="page-actions"><a class="btn btn-sm" href="${state.pdfUrl}" target="_blank" rel="noopener">Abrir em nova aba</a><button class="btn btn-sm btn-primary" id="df-dl">${icon("download")}Baixar PDF</button></div></div>
      <div class="panel-body"><iframe class="pdf-frame" src="${state.pdfUrl}" title="Pré-visualização do DANFSe"></iframe></div>`;
    result.querySelector("#df-dl").onclick = () => download(blob, nome);
  };

  $("#df-gerar").addEventListener("click", (e) => busy(e.currentTarget, async () => {
    const xml = xmlAtual();
    if (!xml.trim()) { toast("Falta o XML", "Envie um arquivo, cole o XML ou monte a nota no formulário.", "error"); return; }
    const lido = lerXml(xml);
    if (lido.erro) { toast("XML inválido", lido.erro, "error"); return; }
    const stc = Number($("#df-stc").value);
    const canhoto = $("#df-canhoto").checked;
    try {
      const res = await api.danfse.gerarPdf(xml, { stc, canhoto });
      if (res.demo) {
        result.hidden = false;
        result.innerHTML = `<div class="panel-body"><div class="callout warn">${icon("info")}<p>No modo demonstração o PDF não é gerado: ele depende do serviço DANFSe rodando. Os dados ao lado mostram o que iria para o documento.</p></div></div>`;
        return;
      }
      const nome = `danfse-${lido.numero || "nfse"}.pdf`;
      mostrarPdf(res.data, nome);
      toast("DANFSe gerado", `NFS-e nº ${lido.numero || "—"}, ${money(lido.vLiq)} líquido.`);
      addHistory({ tipo: "danfse", titulo: `DANFSe da NFS-e nº ${lido.numero || "—"}${lido.prestador ? `, ${lido.prestador}` : ""}`, status: "ok" });
    } catch (err) {
      result.hidden = false;
      result.innerHTML = `<div class="panel-body">${errorCallout(err)}</div>`;
      toast("Não foi possível gerar o DANFSe", err.message, "error");
    }
  }));

  return () => { /* mantém o PDF em memória para quando o usuário voltar */ };
}
