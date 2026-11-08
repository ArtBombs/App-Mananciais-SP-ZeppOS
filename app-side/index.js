import { BaseSideService } from '@zeppos/zml/base-side'
import { API, HIST_DIAS, SISTEMAS, SISTEMA_PADRAO, addDays, buildPayload } from '../shared/sabesp'

const CACHE = (id) => 'mananciais_payload_' + id
const CACHE_REPRESAS = 'mananciais_represas'
let nomesRepresas = null // { idElemento: nome } — muda raramente, guardado no celular

async function getJSON(path) {
  const res = await fetch({
    url: API + path,
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  if (res.status && res.status !== 200) throw new Error('HTTP ' + res.status + ' em ' + path)
  const body = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
  if (!body || body.succeeded === false) throw new Error('Resposta inválida em ' + path)
  return body.data
}

function lerStore(k) {
  try {
    const s = settings.settingsStorage.getItem(k)
    return s ? JSON.parse(s) : null
  } catch (e) {
    return null
  }
}

function gravarStore(k, v) {
  try {
    settings.settingsStorage.setItem(k, JSON.stringify(v))
  } catch (e) {}
}

async function obterNomesRepresas() {
  if (nomesRepresas) return nomesRepresas
  nomesRepresas = lerStore(CACHE_REPRESAS)
  if (nomesRepresas) return nomesRepresas
  const lista = await getJSON('/represas')
  nomesRepresas = {}
  for (const x of lista || []) nomesRepresas[x.id] = x.name
  gravarStore(CACHE_REPRESAS, nomesRepresas)
  return nomesRepresas
}

// A API da Sabesp às vezes cai em partes (08/11 de madrugada: "SQL Server not accessible" no
// resumo por represa e a série diária levando 35 s para falhar). Cada chamada tem prazo, e
// só o resumo geral é obrigatório: sem série ou sem represas, o app mostra o dia mesmo assim.
const PRAZO_MS = 12000
function comPrazo(p, ms = PRAZO_MS) {
  return new Promise((ok, falha) => {
    const t = setTimeout(() => falha(new Error('Sabesp lenta')), ms)
    p.then((v) => (clearTimeout(t), ok(v)), (e) => (clearTimeout(t), falha(e)))
  })
}

async function buscarSistema(id) {
  const ultima = await comPrazo(getJSON('/dados/ultima-data'))
  const data = String(ultima.data || ultima).slice(0, 10)
  const ini = addDays(data, -(HIST_DIAS - 1))
  const opcional = (p) => comPrazo(p).catch(() => null)
  const [diario, resumo, geral, nomes] = await Promise.all([
    opcional(getJSON(`/sistemas/${id}/dados/diario/${ini}/${data}`)),
    opcional(getJSON(`/sistemas/${id}/elementos/dados/resumo-diario/${data}`)),
    comPrazo(getJSON(`/sistemas/dados/resumo-diario/${data}`)),
    obterNomesRepresas().catch(() => ({})),
  ])
  const p = buildPayload(id, data, diario, resumo, nomes, geral)
  if (!diario || !resumo) {
    // Parcial: completa com o que o celular já tinha (histórico de 30 dias e represas).
    p.parcial = true
    const ant = lerStore(CACHE(id))
    if (ant) {
      if (!diario && ant.histVol) {
        p.histVol = ant.histVol
        p.histChuva = ant.histChuva
        p.histIni = ant.histIni
      }
      if (!resumo && ant.represas) {
        p.represas = ant.represas
        p.nivel = ant.nivel
        p.nivelDe = ant.nivelDe
      }
    }
  }
  return p
}

AppSideService(
  BaseSideService({
    onInit() {},
    onRun() {},
    onDestroy() {},

    onRequest(req, res) {
      if (req.method !== 'guara.get') return res('método desconhecido')
      const pedido = Number(req.params && req.params.sistema)
      const id = SISTEMAS.some((s) => s.id === pedido) ? pedido : SISTEMA_PADRAO

      buscarSistema(id)
        .then((p) => {
          if (!p.parcial) gravarStore(CACHE(id), p)
          res(null, { ok: true, payload: p })
        })
        .catch((err) => {
          this.error('falha Sabesp:', err && err.message)
          const cache = lerStore(CACHE(id))
          if (cache) res(null, { ok: true, stale: true, payload: cache })
          else res(null, { ok: false, sistema: id, error: String((err && err.message) || err) })
        })
    },
  }),
)
