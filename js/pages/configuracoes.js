// Página de conexão: endereços das três APIs e teste de saúde.

import * as api from "../api.js";
import { esc, icon, toast, busy, html } from "../ui.js";

export async function render(view) {
  const cfg = api.getConfig();
  const proxy = api.isProxy();

  view.innerHTML = html`
    <div class="page-head">
      <div>
        <h1>Conexão com as APIs</h1>
        <p>Endereços das três calculadoras da Receita Federal usadas por esta interface.</p>
      </div>
    </div>

    <div class="two-col">
      <section class="panel">
        <div class="panel-head"><div><h2>Endereços</h2><p>${proxy
          ? "A página está sendo servida pelo server.js: as chamadas passam pelo proxy embutido e os endereços reais ficam nas variáveis REGIME_API_URL, SIMPLES_API_URL e DANFSE_API_URL."
          : "A página está sendo servida como arquivo estático: o navegador chama cada API diretamente, então elas precisam liberar CORS para esta origem."}</p></div></div>
        <form class="panel-body" id="cfg-form">
          ${["regime", "simples", "danfse"].map((k) => `
            <div class="field" style="margin-bottom:16px">
              <label for="cfg-${k}">${api.API_INFO[k].nome}</label>
              <div style="display:flex;gap:8px">
                <input id="cfg-${k}" name="${k}" value="${esc(cfg[k])}" spellcheck="false" autocomplete="off">
                <button type="button" class="btn" data-test="${k}">Testar</button>
              </div>
              <span class="hint" id="cfg-${k}-st">Saúde verificada em ${esc(api.API_INFO[k].health)}. <a href="${api.API_INFO[k].repo}" target="_blank" rel="noopener">Repositório</a></span>
            </div>`).join("")}
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-primary" type="submit">Salvar endereços</button>
            <button class="btn btn-ghost" type="button" id="cfg-reset">Restaurar padrão</button>
          </div>
        </form>
      </section>

      <section class="panel">
        <div class="panel-head"><div><h2>Como subir as APIs</h2><p>Portas sugeridas para rodar as três ao mesmo tempo.</p></div></div>
        <div class="panel-body">
          <table class="result-table">
            <thead><tr><th>API</th><th>Tecnologia</th><th>Porta</th></tr></thead>
            <tbody>
              <tr><td>Regime geral</td><td>Java 21, Spring Boot</td><td class="num">8080</td></tr>
              <tr><td>Simples Nacional</td><td>Java 21, Spring Boot</td><td class="num">8082</td></tr>
              <tr><td>DANFSe</td><td>Go 1.27</td><td class="num">8081</td></tr>
              <tr><td>Esta interface (server.js)</td><td>Node.js 18+</td><td class="num">3000</td></tr>
            </tbody>
          </table>
          <p class="muted" style="font-size:13.5px;margin:14px 0 0">O DANFSe usa a porta 8080 por padrão; rode com <code>SERVER_PORT=8081</code> para não conflitar com o regime geral. O passo a passo completo está no <a href="https://github.com/lferodrigues/calculadora-contabil#readme" target="_blank" rel="noopener">README</a>.</p>
          <div class="callout warn" style="margin-top:16px">${icon("info")}<p>Sem as APIs rodando, ative o <strong>Modo demonstração</strong> na barra superior para navegar com cálculos aproximados feitos no navegador.</p></div>
        </div>
      </section>
    </div>`;

  const form = view.querySelector("#cfg-form");

  view.querySelectorAll("[data-test]").forEach((b) => b.addEventListener("click", () => busy(b, async () => {
    const k = b.dataset.test;
    const st = view.querySelector(`#cfg-${k}-st`);
    // Testa com o endereço digitado, mesmo antes de salvar.
    const atual = api.getConfig();
    api.saveConfig({ ...atual, [k]: form[k].value.trim() });
    const r = await api.health(k);
    api.saveConfig(atual);
    st.innerHTML = r.state === "online" ? '<span class="badge badge-ok">Online</span> A API respondeu.'
      : r.state === "demo" ? '<span class="badge badge-warn">Demonstração</span> Desative o modo demonstração para testar a API real.'
      : `<span class="badge badge-err">Offline</span> ${esc(r.error || "")}`;
  })));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const apis = Object.fromEntries(["regime", "simples", "danfse"].map((k) => [k, form[k].value.trim()]));
    api.saveConfig(apis);
    toast("Endereços salvos", "As próximas chamadas usam os novos endereços.");
    window.dispatchEvent(new CustomEvent("rtc:config"));
  });

  view.querySelector("#cfg-reset").addEventListener("click", () => {
    api.resetConfig();
    toast("Endereços restaurados", "Voltamos aos endereços padrão.");
    window.dispatchEvent(new CustomEvent("rtc:config"));
    render(view);
  });
}
