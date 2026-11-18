// Modo demonstração: respostas simuladas no próprio navegador para quando as
// APIs da Receita Federal não estão rodando. As fórmulas são simplificadas
// (sem diferimento, crédito presumido, monofasia etc.) e servem só para
// conhecer a interface. Resultados reais vêm sempre das APIs.

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const n = (v) => (v === undefined || v === null || v === "" ? 0 : Number(v));

// Reduções conhecidas, conforme o exemplo oficial do repositório regime-regular.
const REDUCOES = { "200003": 100, "200028": 60 };

export const UFS = [
  ["AC", "Acre", 12], ["AL", "Alagoas", 27], ["AP", "Amapá", 16], ["AM", "Amazonas", 13], ["BA", "Bahia", 29],
  ["CE", "Ceará", 23], ["DF", "Distrito Federal", 53], ["ES", "Espírito Santo", 32], ["GO", "Goiás", 52],
  ["MA", "Maranhão", 21], ["MT", "Mato Grosso", 51], ["MS", "Mato Grosso do Sul", 50], ["MG", "Minas Gerais", 31],
  ["PA", "Pará", 15], ["PB", "Paraíba", 25], ["PR", "Paraná", 41], ["PE", "Pernambuco", 26], ["PI", "Piauí", 22],
  ["RJ", "Rio de Janeiro", 33], ["RN", "Rio Grande do Norte", 24], ["RS", "Rio Grande do Sul", 43],
  ["RO", "Rondônia", 11], ["RR", "Roraima", 14], ["SC", "Santa Catarina", 42], ["SP", "São Paulo", 35],
  ["SE", "Sergipe", 28], ["TO", "Tocantins", 17]
].map(([sigla, nome, codigo]) => ({ sigla, nome, codigo }));

const MUNICIPIOS_DEMO = {
  MG: [{ codigo: 3106200, nome: "Belo Horizonte" }, { codigo: 3136702, nome: "Juiz de Fora" }, { codigo: 3162203, nome: "São João Nepomuceno" }],
  RS: [{ codigo: 4314902, nome: "Porto Alegre" }],
  SP: [{ codigo: 3550308, nome: "São Paulo" }],
  RJ: [{ codigo: 3304557, nome: "Rio de Janeiro" }]
};
export const municipios = (uf) => MUNICIPIOS_DEMO[uf] || [];

export const ATIVIDADES = [
  { codigo: "01", descricao: "Atividade de exemplo (modo demonstração)", rotuloCurtoAnexo: "Anexo I" },
  { codigo: "02", descricao: "Outra atividade de exemplo (modo demonstração)", rotuloCurtoAnexo: "Anexo III" }
];

// ---------------------------------------------------------------------------
export function regimeObservabilidade(op) {
  const ano = Number(String(op.dhFatoGerador || "").slice(0, 4)) || 2027;
  let totBC = 0, totCBS = 0, totIBSUF = 0, totIBSMun = 0, totIS = 0;

  const objetos = (op.itens || []).map((it) => {
    if (!it.cst || !it.cClassTrib) {
      return { nObj: it.numero, estadoItem: "INCONSISTENCIA_ENTRADA", erros: [{ code: "DEMO-001", title: "Campo obrigatório", pointer: `#/itens/${it.numero - 1}`, detail: "Informe o CST e a cClassTrib do item." }] };
    }
    if (it.ncm === "02013000" && it.cClassTrib === "200035") {
      return { nObj: it.numero, estadoItem: "INCONSISTENCIA_ENTRADA", erros: [{ code: "REG-011", title: "NCM não vinculada", pointer: `#/itens/${it.numero - 1}/ncm`, detail: `NCM de código ${it.ncm} não vinculada à Classificação Tributária de código ${it.cClassTrib} (CBS e IBS)` }] };
    }

    const al = it.aliquotasNominais || (ano <= 2026 ? { cbs: 0.9, ibsEstadual: 0.1, ibsMunicipal: 0 } : null);
    if (!al) {
      return { nObj: it.numero, estadoItem: "INCONSISTENCIA_ENTRADA", erros: [{ code: "DEMO-002", title: "Alíquotas ausentes", pointer: `#/itens/${it.numero - 1}/aliquotasNominais`, detail: "A partir de 2027 as alíquotas nominais precisam ser informadas." }] };
    }

    const tribCalc = {};
    let vIS = 0;
    let vBC = n(it.baseCalculo);
    if (it.impostoSeletivo) {
      const is = it.impostoSeletivo;
      const pIS = n(al.impostoSeletivo && al.impostoSeletivo.adValorem);
      vIS = is.impostoInformado !== undefined ? r2(is.impostoInformado) : r2(n(is.baseCalculo) * pIS / 100);
      tribCalc.IS = { CSTIS: is.cst, cClassTribIS: is.cClassTrib, vBCIS: r2(is.baseCalculo), pIS, uTrib: is.unidade, qTrib: is.quantidade, vIS,
        memoriaCalculo: `Simulação local: vIS = ${r2(is.baseCalculo)} × ${pIS}% = ${vIS}` };
      vBC = r2(n(is.baseCalculo) + vIS);
    }

    const red = REDUCOES[it.cClassTrib] || 0;
    const grupo = (p) => {
      const pEf = r2(n(p) * (1 - red / 100));
      return { p: r2(p), pEf, v: r2(vBC * pEf / 100), gRed: red ? { pRedAliq: r2(red), pAliqEfet: pEf } : undefined };
    };
    const cbs = grupo(al.cbs), uf = grupo(al.ibsEstadual), mun = grupo(al.ibsMunicipal);
    const memo = (nome, g) => `Simulação local: ${nome} = ${vBC} × ${g.pEf}%${red ? ` (alíquota ${g.p}% com redução de ${red}%)` : ""} = ${g.v}`;

    tribCalc.IBSCBS = {
      CST: it.cst, cClassTrib: it.cClassTrib,
      gIBSCBS: {
        vBC,
        gIBSUF: { pIBSUF: uf.p, gRed: uf.gRed, vIBSUF: uf.v, memoriaCalculo: memo("IBS UF", uf) },
        gIBSMun: { pIBSMun: mun.p, gRed: mun.gRed, vIBSMun: mun.v, memoriaCalculo: memo("IBS municipal", mun) },
        vIBS: r2(uf.v + mun.v),
        gCBS: { pCBS: cbs.p, gRed: cbs.gRed, vCBS: cbs.v, memoriaCalculo: memo("CBS", cbs) }
      }
    };

    totBC += vBC; totCBS += cbs.v; totIBSUF += uf.v; totIBSMun += mun.v; totIS += vIS;
    return { nObj: it.numero, estadoItem: it.aliquotasNominais ? "CALCULO_SIMULADO" : "CALCULADO", tribCalc };
  });

  return {
    data: {
      oper: { id: op.id, versao: op.versao, dhFatoGerador: op.dhFatoGerador, municipio: op.municipio, uf: op.uf },
      objetos,
      total: { tribCalc: {
        ISTot: { vIS: r2(totIS) },
        IBSCBSTot: {
          vBCIBSCBS: r2(totBC),
          gIBS: { gIBSUF: { vIBSUF: r2(totIBSUF) }, gIBSMun: { vIBSMun: r2(totIBSMun) }, vIBS: r2(totIBSUF + totIBSMun) },
          gCBS: { vCBS: r2(totCBS) }
        }
      } }
    },
    warning: "Resultado simulado no navegador (modo demonstração)."
  };
}

// Composição observada no exemplo oficial da base unificada.
export function baseUnificada(e) {
  const ano = n(e.anoFatoGerador);
  const soma = n(e.vProd) + n(e.vFrete) + n(e.vSeg) + n(e.vOutro) - n(e.vDesc);
  const avisos = [];
  const ignora = (k) => { if (n(e[k])) avisos.push(`Campo ${k} não compõe as bases para o ano ${ano} e foi ignorado no cálculo`); return 0; };
  const bem = e.natureza !== "servico";
  let deducoes = 0;
  if (ano <= 2026) deducoes += n(e.vPIS) + n(e.vCOFINS); else { ignora("vPIS"); ignora("vCOFINS"); }
  if (ano <= 2032) {
    if (bem) deducoes += n(e.vICMS) + n(e.vICMSUFDest) + n(e.vFCP) + n(e.vFCPUFDest) + n(e.vICMSMono);
    else deducoes += n(e.vISSQN);
  }
  const vII = bem ? n(e.vII) : 0;
  const vIS = ano >= 2027 ? n(e.vIS) : ignora("vIS");
  const baseIS = r2(soma + vII - deducoes);
  return {
    data: { baseRG: r2(baseIS + vIS), baseIS, baseSN: r2(soma + vIS), avisos: ["Aproximação local (modo demonstração).", ...avisos] }
  };
}

export function simplesObservabilidade(op) {
  const t = { vRBSNtot: 0, vBC: 0, vIBSSNtot: 0, vCBSSNtot: 0, totalIs: 0, totalTributos: 0 };
  const objetos = (op.itens || []).map((it) => {
    if (!it.cClassTrib) {
      return { nObj: it.numero, estadoItem: "INCONSISTENCIA_ENTRADA", erros: [{ code: "DEMO-001", title: "cClassTrib obrigatória", pointer: `#/itens/${it.numero - 1}/cClassTrib`, detail: "Informe a classificação tributária do item." }] };
    }
    if (!it.cAtivSN) return { nObj: it.numero, estadoItem: "NAO_CALCULADO" };
    const base = n(it.baseCalculo), is = n(it.valorImpostoSeletivo);
    const pIBS = n(it.pIBSSN), pCBS = n(it.pCBSSN);
    const vIBS = op.CRT === "2" ? 0 : r2(base * pIBS / 100);
    const vCBS = r2(base * pCBS / 100);
    const total = r2(vIBS + vCBS + is);
    t.vRBSNtot += base; t.vBC += base; t.vIBSSNtot += vIBS; t.vCBSSNtot += vCBS; t.totalIs += is; t.totalTributos += total;
    return {
      nObj: it.numero, estadoItem: "CALCULADO",
      tribCalc: { vRBSNitem: r2(base), tpRBSN: 1, tpRBSNDescricao: "Receita bruta (simulação local)", vBC: r2(base), pIBSSN: pIBS, vIBSSN: vIBS, pCBSSN: pCBS, vCBSSN: vCBS, IS: is ? { valor: is } : undefined, totalItem: total }
    };
  });
  Object.keys(t).forEach((k) => { t[k] = r2(t[k]); });
  return { data: { oper: { data: op.data, tpDoc: op.tpDoc, CRT: op.CRT, tpRegimeIBSCBS: op.tpRegimeIBSCBS, tpEnteGov: op.tpEnteGov }, objetos, total: t } };
}

export function erro(codigo) {
  return { data: { codigo, titulo: "Modo demonstração", descricao: "A descrição oficial deste código vem da API. Desative o modo demonstração com a API rodando para consultá-la." } };
}
