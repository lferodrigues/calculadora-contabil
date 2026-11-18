// Grade de itens no estilo de formulário de ERP: barra de ferramentas,
// cabeçalho cinza e um campo por coluna.

import { esc, icon } from "./ui.js";

export class ItemGrid {
  /**
   * @param {HTMLElement} el
   * @param {{columns: Array, rows: Array, newRow: Function, onExample?: Function,
   *          onHelp?: Function, isDisabled?: Function, footer?: Function, label: string}} opts
   */
  constructor(el, opts) {
    this.el = el;
    this.o = opts;
    this.rows = (opts.rows || []).map((r) => ({ ...r }));
    if (!this.rows.length) this.rows.push(opts.newRow());
    this.sel = 0;
    this.render();
  }

  getRows() { return this.rows.map((r, i) => ({ ...r, numero: i + 1 })); }
  setRows(rows) { this.rows = rows.map((r) => ({ ...r })); this.sel = 0; this.render(); }

  markInvalid(index, key, invalid = true) {
    const input = this.el.querySelector(`tr[data-i="${index}"] [data-k="${key}"]`);
    if (input) input.setAttribute("aria-invalid", invalid ? "true" : "false");
  }
  clearInvalid() { this.el.querySelectorAll("[aria-invalid]").forEach((x) => x.removeAttribute("aria-invalid")); }

  refreshDisabled() {
    if (!this.o.isDisabled) return;
    this.el.querySelectorAll("tbody tr").forEach((tr) => {
      const row = this.rows[Number(tr.dataset.i)];
      tr.querySelectorAll("[data-k]").forEach((inp) => { inp.disabled = !!this.o.isDisabled(inp.dataset.k, row); });
    });
  }

  render() {
    const { columns, label } = this.o;
    const one = this.rows.length <= 1;
    this.el.innerHTML = `
      <div class="erp">
        <div class="erp-toolbar" role="toolbar" aria-label="Ações da grade de itens">
          <button type="button" data-act="add">${icon("plus")}Novo item</button>
          <button type="button" data-act="dup">${icon("copy")}Duplicar</button>
          <button type="button" data-act="del" ${one ? "disabled" : ""}>${icon("trash")}Excluir</button>
          <span class="sep" aria-hidden="true"></span>
          <button type="button" data-act="up" ${this.sel === 0 ? "disabled" : ""} aria-label="Mover item para cima">${icon("up")}</button>
          <button type="button" data-act="down" ${this.sel >= this.rows.length - 1 ? "disabled" : ""} aria-label="Mover item para baixo">${icon("down")}</button>
          <span class="sep" aria-hidden="true"></span>
          ${this.o.onExample ? `<button type="button" data-act="example">${icon("sample")}Carregar exemplo</button>` : ""}
          <button type="button" data-act="clear">${icon("clear")}Limpar</button>
          ${this.o.onHelp ? `<button type="button" class="push" data-act="help">${icon("help")}Explicações</button>` : ""}
        </div>
        <div class="erp-scroll">
          <table aria-label="${esc(label)}">
            <thead><tr><th scope="col">Nº</th>${columns.map((c) => `<th scope="col" class="${c.type === "num" ? "num" : ""}" style="${c.width ? `width:${c.width}` : ""}" title="${esc(c.title || "")}">${esc(c.label)}</th>`).join("")}</tr></thead>
            <tbody>${this.rows.map((row, i) => this.rowHtml(row, i)).join("")}</tbody>
          </table>
        </div>
        <div class="erp-foot"><span>${this.rows.length} ${this.rows.length === 1 ? "item" : "itens"} na operação</span><span class="foot-extra">${this.o.footer ? this.o.footer(this.rows) : ""}</span></div>
      </div>`;
    this.refreshDisabled();
    this.bind();
  }

  rowHtml(row, i) {
    const cells = this.o.columns.map((c) => {
      const v = row[c.key] ?? "";
      const aria = `aria-label="${esc(c.label)} do item ${i + 1}"`;
      if (c.type === "select") {
        return `<td><select class="grid-input" data-k="${c.key}" ${aria}>${c.options.map(([val, lab]) => `<option value="${esc(val)}" ${String(val) === String(v) ? "selected" : ""}>${esc(lab)}</option>`).join("")}</select></td>`;
      }
      return `<td><input class="grid-input ${c.type === "num" ? "num" : ""}" data-k="${c.key}" value="${esc(v)}" ${aria}
        ${c.placeholder ? `placeholder="${esc(c.placeholder)}"` : ""} ${c.list ? `list="${c.list}"` : ""}
        ${c.type === "num" ? 'inputmode="decimal"' : c.digits ? 'inputmode="numeric"' : ""} ${c.maxlength ? `maxlength="${c.maxlength}"` : ""} autocomplete="off"></td>`;
    }).join("");
    return `<tr data-i="${i}" class="${i === this.sel ? "is-selected" : ""}"><td class="row-n" title="Selecionar item">${i + 1}</td>${cells}</tr>`;
  }

  select(i) {
    this.sel = i;
    this.el.querySelectorAll("tbody tr").forEach((tr) => tr.classList.toggle("is-selected", Number(tr.dataset.i) === i));
    const tb = this.el.querySelector(".erp-toolbar");
    tb.querySelector('[data-act="up"]').disabled = i === 0;
    tb.querySelector('[data-act="down"]').disabled = i >= this.rows.length - 1;
  }

  bind() {
    const tbody = this.el.querySelector("tbody");
    tbody.addEventListener("input", (e) => {
      const k = e.target.dataset.k; if (!k) return;
      const i = Number(e.target.closest("tr").dataset.i);
      this.rows[i][k] = e.target.value;
      e.target.removeAttribute("aria-invalid");
      if (this.o.isDisabled) this.refreshDisabled();
      const foot = this.el.querySelector(".foot-extra");
      if (foot && this.o.footer) foot.innerHTML = this.o.footer(this.rows);
    });
    tbody.addEventListener("focusin", (e) => { const tr = e.target.closest("tr"); if (tr) this.select(Number(tr.dataset.i)); });
    tbody.addEventListener("click", (e) => { const td = e.target.closest(".row-n"); if (td) this.select(Number(td.parentElement.dataset.i)); });

    this.el.querySelector(".erp-toolbar").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-act]"); if (!b || b.disabled) return;
      const s = this.sel;
      switch (b.dataset.act) {
        case "add": this.rows.push(this.o.newRow()); this.sel = this.rows.length - 1; break;
        case "dup": this.rows.splice(s + 1, 0, { ...this.rows[s] }); this.sel = s + 1; break;
        case "del": this.rows.splice(s, 1); this.sel = Math.max(0, s - 1); break;
        case "up": [this.rows[s - 1], this.rows[s]] = [this.rows[s], this.rows[s - 1]]; this.sel = s - 1; break;
        case "down": [this.rows[s + 1], this.rows[s]] = [this.rows[s], this.rows[s + 1]]; this.sel = s + 1; break;
        case "example": this.o.onExample(); return;
        case "clear": this.rows = [this.o.newRow()]; this.sel = 0; break;
        case "help": this.o.onHelp(); return;
        default: return;
      }
      this.render();
      const first = this.el.querySelector(`tr[data-i="${this.sel}"] [data-k]`);
      if (first && b.dataset.act === "add") first.focus();
    });
  }
}
