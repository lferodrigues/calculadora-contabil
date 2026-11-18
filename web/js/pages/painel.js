import * as api from "../api.js";
import { esc, icon, money, history, clearHistory, html } from "../ui.js";

const TIPOS = {
  regime: { nome: "Regime geral", rota: "#/regime-geral" },
  simples: { nome: "Simples Nacional", rota: "#/simples-nacional" },
  danfse: { nome: "DANFSe", rota: "#/danfse" }
};

// Etapas da transição definidas pela EC 132/2023 e pela LC 214/2025.
const CRONOGRAMA = [
  [2026, "Ano de teste", "CBS de 0,9% e IBS de 0,1% destacados na nota, compensáveis com PIS/Cofins."],
  [2027, "CBS e Imposto Seletivo", "CBS passa a valer integralmente; PIS e Cofins são extintos e o IS começa a ser cobrado."],
  [2029, "Início da troca do ICMS e ISS", "De 2029 a 2032, ICMS e ISS caem gradualmente enquanto o IBS sobe na mesma proporção."],
  [2033, "Modelo completo", "ICMS e ISS deixam de existir; IBS e CBS passam a valer integralmente."]
];

function quandoLabel(iso) {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(); ontem.setDate(hoje.getDate() - 1);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === hoje.toDateString()) return ["Hoje", hora];
  if (d.toDateString() === ontem.toDateString()) return ["Ontem", hora];
  return [d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", ""), hora];
}

function bars(values) {
  const last = values.slice(0, 7).reverse();
  if (!last.length) return `<div class="bars" aria-hidden="true">${"<i style='height:8%'></i>".repeat(7)}</div>`;
  const max = Math.max(...last, 0.01);
  return `<div class="bars" aria-hidden="true">${last.map((v) => `<i style="height:${Math.max(8, (v / max) * 100)}%"></i>`).join("")}</div>`;
}

export async function render(view) {
  const hist = history();
  const apuracoes = hist.filter((h) => h.tipo !== "danfse");
  const pdfs = hist.filter((h) => h.tipo === "danfse");
  const totalTrib = apuracoes.reduce((s, h) => s + (Number(h.total) || 0), 0);
  const cbs = apuracoes.map((h) => Number(h.cbs) || 0);
  const ibs = apuracoes.map((h) => Number(h.ibs) || 0);
  const ano = new Date().getFullYear();

  view.innerHTML = html`
    <div class="page-head">
      <div>
        <h1>Painel de apuração</h1>
        <p>Calcule CBS, IBS e Imposto Seletivo da Reforma Tributária do Consumo e gere o DANFSe das notas de serviço.</p>
      </div>
    </div>

    <div class="hero-row">
      <a class="action-card is-solid" href="#/regime-geral">
        <span class="action-icon">${icon("calc")}</span>
        <span><span class="action-title">Nova apuração</span><small>Regime geral, CBS, IBS e IS</small></span>
      </a>
      <a class="action-card" href="#/simples-nacional">
        <span class="action-icon">${icon("home")}</span>
        <span><span class="action-title">Simples Nacional</span><small>IBS e CBS por atividade</small></span>
      </a>
      <a class="action-card" href="#/danfse">
        <span class="action-icon">${icon("doc")}</span>
        <span><span class="action-title">Gerar DANFSe</span><small>PDF a partir do XML da NFS-e</small></span>
      </a>
      <div class="stat-tile"><span class="stat-value">${apuracoes.length}</span><span>Apurações feitas</span></div>
      <div class="stat-tile"><span class="stat-value">${pdfs.length}</span><span>DANFSe gerados</span></div>
    </div>

    <div class="dash-grid">
      <section class="panel" aria-labelledby="recentes-t">
        <div class="panel-head">
          <div><h2 id="recentes-t">Atividade recente</h2><p>Últimos cálculos feitos neste navegador.</p></div>
          ${hist.length ? `<button class="btn btn-sm" id="limpar-hist">Limpar histórico</button>` : ""}
        </div>
        <div class="panel-body">
          ${hist.length ? `<ul class="agenda">${hist.slice(0, 6).map((h) => {
            const [dia, hora] = quandoLabel(h.quando);
            const t = TIPOS[h.tipo] || TIPOS.regime;
            const badge = h.status === "erro" ? '<span class="badge badge-err">Com inconsistências</span>'
              : h.demo ? '<span class="badge badge-warn">Demonstração</span>'
              : h.status === "simulado" ? '<span class="badge badge-info">Simulado</span>'
              : '<span class="badge badge-ok">Concluído</span>';
            return `<li>
              <span class="when">${esc(dia)}<small>${esc(hora)}</small></span>
              <a class="what" href="${t.rota}" style="text-decoration:none;color:inherit"><strong>${esc(h.titulo)}</strong><span>${esc(t.nome)}${h.total !== undefined ? `, tributos de ${money(h.total)}` : ""}</span></a>
              ${badge}
            </li>`;
          }).join("")}</ul>`
          : `<div class="empty"><p>Nenhum cálculo ainda. Comece pela calculadora do regime geral; ela tem um exemplo pronto para testar.</p><a class="btn btn-primary" href="#/regime-geral">Abrir calculadora</a></div>`}

          <div class="mini-charts">
            <div class="mini-chart"><h3>CBS apurada</h3><span class="money">${money(cbs.reduce((a, b) => a + b, 0))}</span>${bars(cbs)}</div>
            <div class="mini-chart"><h3>IBS apurado</h3><span class="money">${money(ibs.reduce((a, b) => a + b, 0))}</span>${bars(ibs)}</div>
            <div class="mini-chart"><h3>Total de tributos</h3><span class="money">${money(totalTrib)}</span>${bars(apuracoes.map((h) => Number(h.total) || 0))}</div>
          </div>
        </div>
      </section>

      <div class="stack">
        <section class="panel" aria-labelledby="status-t">
          <div class="panel-head">
            <div><h2 id="status-t">Conexão com as APIs</h2><p>${api.isProxy() ? "Chamadas pelo mesmo endereço da página, em /proxy." : "Chamadas diretas do navegador."}</p></div>
            <button class="btn btn-sm" id="recheck">${icon("refresh")}Verificar</button>
          </div>
          <div class="panel-body"><ul class="status-list" id="status-list"></ul></div>
        </section>

        <section class="panel" aria-labelledby="crono-t">
          <div class="panel-head"><div><h2 id="crono-t">Cronograma da transição</h2><p>Etapas previstas na LC 214/2025.</p></div></div>
          <div class="panel-body">
            <ol class="timeline">
              ${CRONOGRAMA.map(([y, t, d], i) => {
                const next = CRONOGRAMA[i + 1];
                const now = ano >= y && (!next || ano < next[0]);
                return `<li class="${now ? "is-now" : ""}"><span class="year">${y}</span><strong>${esc(t)}</strong><p>${esc(d)}</p></li>`;
              }).join("")}
            </ol>
          </div>
        </section>
      </div>
    </div>`;

  const limpar = view.querySelector("#limpar-hist");
  if (limpar) limpar.onclick = () => { clearHistory(); render(view); };

  const list = view.querySelector("#status-list");
  const check = async () => {
    const keys = ["regime", "simples", "danfse"];
    list.innerHTML = keys.map((k) => `<li><div class="grow"><strong>${api.API_INFO[k].nome}</strong><small>${esc(api.baseUrl(k))}</small></div><span class="badge">Verificando</span></li>`).join("");
    const res = await Promise.all(keys.map((k) => api.health(k)));
    list.innerHTML = keys.map((k, i) => {
      const r = res[i];
      const badge = r.state === "online" ? '<span class="badge badge-ok">Online</span>'
        : r.state === "demo" ? '<span class="badge badge-warn">Demonstração</span>'
        : '<span class="badge badge-err">Offline</span>';
      const versao = r.data && typeof r.data === "object" ? (r.data.versaoApp || r.data.versao || r.data.versaoAplicacao || r.data.status || "") : "";
      return `<li><div class="grow"><strong>${api.API_INFO[k].nome}</strong><small>${esc(api.baseUrl(k))}${versao ? `, ${esc(typeof versao === "object" ? JSON.stringify(versao) : versao)}` : ""}</small></div>${badge}</li>`;
    }).join("");
  };
  view.querySelector("#recheck").onclick = check;
  check();
}
