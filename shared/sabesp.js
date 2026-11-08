// Portal dos Mananciais (Sabesp) — API pública v4, sem chave.
// Endpoints mapeados no bundle do site (04/11/2026):
//   GET /api/v4/dados/ultima-data                                   -> { data: "YYYY-MM-DD" }
//   GET /api/v4/sistemas/{id}/dados/diario/{ini}/{fim}              -> série diária do sistema
//   GET /api/v4/sistemas/{id}/elementos/dados/resumo-diario/{data}  -> por represa (nível, volume, chuva)
//   GET /api/v4/sistemas/dados/resumo-diario/{data}                 -> todos os sistemas no dia
//   GET /api/v4/represas                                            -> nomes das represas por id
// Dados consolidados diariamente às 9:00. A vazão captada é do dia anterior.

export const API = 'https://mananciais.sabesp.com.br/api/v4'
export const HIST_DIAS = 30
export const SISTEMA_PADRAO = 66 // Guarapiranga
export const SISTEMA_PONTE = 66 // o mostrador mostra sempre a Guarapiranga

// Mesma ordem da home do site. 75 = Sistema Integrado Metropolitano (total da RMSP).
// (71 = cópia de Cotia e 74 = Cantareira Velho existem na API, mas o site não mostra.)
export const SISTEMAS = [
  { id: 75, nome: 'Integrado RMSP' },
  { id: 64, nome: 'Cantareira' },
  { id: 65, nome: 'Alto Tietê' },
  { id: 66, nome: 'Guarapiranga' },
  { id: 67, nome: 'Cotia' },
  { id: 68, nome: 'Rio Grande' },
  { id: 69, nome: 'Rio Claro' },
  { id: 72, nome: 'São Lourenço' },
]
export const nomeSistema = (id) => (SISTEMAS.find((s) => s.id === id) || {}).nome || 'Sistema ' + id

export const PARAM = { chuva: 1, nivel: 2, volPct: 684, volHm3: 685 }
export const MAX_REPRESAS = 7

const pad = (n) => (n < 10 ? '0' : '') + n

export function ymd(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

export function parseYmd(s) {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s, n) {
  const d = parseYmd(s)
  d.setDate(d.getDate() + n)
  return ymd(d)
}

const r = (v, dec) => (v === null || v === undefined || isNaN(v) ? null : Number(Number(v).toFixed(dec)))

// Represas do sistema: elementos com volume útil (%) e nome conhecido.
// No Integrado (75) os "elementos" são os próprios sistemas — o nome vem de SISTEMAS.
export function extrairRepresas(sistemaId, resumo, nomesRepresas) {
  const porEl = {}
  for (const x of resumo || []) {
    if (x.idElemento === sistemaId) continue // o próprio sistema
    if (!porEl[x.idElemento]) porEl[x.idElemento] = { id: x.idElemento }
    const e = porEl[x.idElemento]
    if (x.idParametro === PARAM.volPct) e.v = x.value
    if (x.idParametro === PARAM.nivel) e.nv = x.value
  }
  const out = []
  for (const e of Object.values(porEl)) {
    if (e.v === undefined) continue
    const nome = (nomesRepresas && nomesRepresas[e.id]) || (SISTEMAS.some((s) => s.id === e.id) ? nomeSistema(e.id) : null)
    if (!nome) continue
    out.push({ n: String(nome).replace(/^Represa\s+/i, ''), v: r(e.v, 1), nv: r(e.nv, 2) })
  }
  return out.slice(0, MAX_REPRESAS)
}

// Volume e variação de todos os sistemas (lista de seleção + ponte do mostrador)
export function extrairTodos(geral) {
  return SISTEMAS.map((s) => {
    const g = (geral || []).find((x) => x.idSistema === s.id) || {}
    return { id: s.id, v: r(g.volumeUtilArmazenadoPorcentagem, 1), dv: r(g.variacaoVolumeUtil, 1) }
  })
}

// Monta o pacote compacto que vai por Bluetooth ao relógio.
export function buildPayload(sistemaId, dataStr, diario, resumo, nomesRepresas, geral) {
  const serie = (diario || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1))
  // Último dia: série diária; se ela falhar (a API da Sabesp às vezes cai em partes), o resumo
  // geral de todos os sistemas tem os mesmos campos do dia.
  const g = (geral || []).find((x) => x.idSistema === sistemaId) || {}
  const ult = serie[serie.length - 1] || {}
  const d = {}
  for (const k of Object.keys(g).concat(Object.keys(ult))) d[k] = ult[k] !== undefined && ult[k] !== null ? ult[k] : g[k]
  const represas = extrairRepresas(sistemaId, resumo, nomesRepresas)
  return {
    v: 2, // versão do formato
    sistema: sistemaId,
    data: dataStr,
    ts: Date.now(),
    vol: r(d.volumeUtilArmazenadoPorcentagem, 1),
    varDia: r(d.variacaoVolumeUtil, 1),
    hm3: r(d.volumeUtilArmazenadoHm3, 2),
    chuvaDia: r(d.chuva, 1),
    chuvaMes: r(d.chuvaAcumuladaNoMes, 1),
    chuvaHist: r(d.chuvaMediaHistorica, 1),
    qNatural: r(d.vazaoNatural, 2),
    qCaptada: r(d.vazaoCaptada, 2),
    qJusante: r(d.vazaoJusante, 2),
    qProduzida: r(d.vazaoProduzida, 2),
    nivel: represas.length ? represas[0].nv : null,
    nivelDe: represas.length ? represas[0].n : null,
    represas,
    todos: extrairTodos(geral),
    histVol: serie.map((x) => r(x.volumeUtilArmazenadoPorcentagem, 1)),
    histChuva: serie.map((x) => r(x.chuva, 1)),
    histIni: serie.length ? String(serie[0].date).slice(0, 10) : null,
  }
}
