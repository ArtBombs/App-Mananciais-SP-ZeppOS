// Idioma da interface (v1.5.0). Relógio em português (pt-BR 20 · pt-PT 15) → português;
// qualquer outro idioma → inglês (a loja da Zepp exige inglês como idioma padrão).
// Tabela: docs.zepp.com › Related Resources › Multilingual Mapping (getLanguage de @zos/settings).
// Namespace com checagem: firmware sem getLanguage cai em português.
import * as zosSettings from '@zos/settings'

function detectar() {
  try {
    if (typeof zosSettings.getLanguage === 'function') {
      const c = Number(zosSettings.getLanguage())
      if (!isNaN(c)) return c === 20 || c === 15 ? 'pt' : 'en'
    }
  } catch (e) {}
  return 'pt'
}

export const LANG = detectar()
export const EN = LANG === 'en'

// Textos da interface. Chave = id curto; valor = [português, inglês].
const T = {
  volumeUtil: ['volume útil', 'useful volume'],
  atualizando: ['atualizando...', 'updating...'],
  noDia: ['% no dia', '% today'],
  chuva: ['CHUVA', 'RAIN'],
  acumMes: ['acumulado no mês', 'this month'],
  ult30: ['últimos 30 dias', 'last 30 days'],
  daMedia: ['% da média', '% of average'],
  semChuva: ['sem dado de chuva', 'no rain data'],
  nesteSistema: ['neste sistema', 'for this system'],
  hoje: ['hoje', 'today'],
  nivel: ['NÍVEL', 'LEVEL'],
  qNatural: ['Entrada natural', 'Natural inflow'],
  qCaptada: ['Captação ETA', 'WTP intake'],
  qJusante: ['Descarga jusante', 'Downstream'],
  qProduzida: ['Produção ETA', 'WTP output'],
  vazoes: ['vazões em m³/s', 'flows in m³/s'],
  represas: ['REPRESAS', 'RESERVOIRS'],
  sistemas: ['SISTEMAS', 'SYSTEMS'],
  dias30: ['30 DIAS', '30 DAYS'],
  pontos: ['pontos percentuais', 'percentage points'],
  carregando: ['carregando…', 'loading…'],
  semConexao: ['sem conexão', 'offline'],
  indisponivel: ['Sabesp indisponível', 'Sabesp unavailable'],
  semDados: ['sem dados', 'no data'],
  salvo: ['salvo', 'saved'],
  offline: ['offline', 'cached'],
  parcial: ['parcial', 'partial'],
  dadosDe: ['Dados de ', 'Data from '],
  atualiza9h: [' · Atualiza às 9h', ' · Updates at 9 am'],
}

export const t = (k) => {
  const v = T[k]
  return v ? v[EN ? 1 : 0] : k
}

// Números: vírgula em português, ponto em inglês.
export const fmt = (n, dec = 1) => {
  if (n === null || n === undefined || isNaN(n)) return '--'
  const s = Number(n).toFixed(dec)
  return EN ? s : s.replace('.', ',')
}

// Data curta: "08/11" em português, "Nov 8" em inglês (evita a ambiguidade dd/mm × mm/dd).
const MESES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const dataCurta = (s) => {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return '--'
  return EN ? MESES[Number(m[2]) - 1] + ' ' + Number(m[3]) : m[3] + '/' + m[2]
}

// Nome do sistema: só o Integrado tem tradução; os outros são nomes próprios.
export const nomeSistemaI18n = (id, nomePt) => (EN && id === 75 ? 'Integrated SP' : nomePt)

// Rótulos dos diagramas ("Por dentro do sistema"). Rios, represas e cidades são nomes próprios.
export function rotuloDiagrama(txt) {
  if (!EN) return txt
  const s = String(txt)
  if (s === 'Captação') return 'Intake'
  if (s === 'ETA') return 'WTP'
  if (s === 'EEAB') return 'Pump'
  let m = s.match(/^ETA (.+)$/)
  if (m) return m[1] + ' WTP'
  m = s.match(/^EEAB (.+)$/)
  if (m) return m[1] + ' Pump'
  m = s.match(/^Túnel (.+)$/)
  if (m) return 'Tunnel ' + m[1]
  return s
}
