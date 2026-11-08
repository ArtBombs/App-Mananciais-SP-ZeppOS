// Side service com a API da Sabesp caindo em partes (como em 08/11/2026 de madrugada).
import { build } from 'esbuild'
import { DATA, geral, nomes, elementos, diario } from './fixture.mjs'
const store = {}
globalThis.settings = { settingsStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v } } }
let falhar = new Set()
globalThis.fetch = async ({ url }) => {
  const p = url.replace(/^.*\/api\/v4/, '')
  const ok = (data) => ({ status: 200, body: JSON.stringify({ succeeded: true, data }) })
  if (falhar.has('lenta')) return new Promise(() => {}) // nunca responde
  for (const f of falhar) if (p.includes(f)) {
    return { status: 400, body: 'A network-related or instance-specific error occurred... SQL Server' }
  }
  if (p === '/dados/ultima-data') return ok({ data: DATA })
  if (p === '/represas') return ok(Object.entries(nomes).map(([id, name]) => ({ id: +id, name })))
  if (p.startsWith('/sistemas/dados/resumo-diario')) return ok(geral)
  let m = p.match(/^\/sistemas\/(\d+)\/dados\/diario/); if (m) return ok(diario(+m[1]))
  m = p.match(/^\/sistemas\/(\d+)\/elementos/); if (m) return ok(elementos[+m[1]] || [])
  return { status: 404, body: '' }
}
let svc; globalThis.AppSideService = (o) => { svc = o }
const res = await build({ entryPoints: ['app-side/index.js'], bundle: true, write: false, format: 'esm', platform: 'node',
  plugins: [{ name: 'zml', setup(b) { b.onResolve({ filter: /^@zeppos\/zml\/base-side$/ }, (a) => ({ path: a.path, namespace: 'zml' })); b.onLoad({ filter: /.*/, namespace: 'zml' }, () => ({ contents: 'export const BaseSideService = (o)=>o', loader: 'js' })) } }] })
await import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
svc.error = () => {}
const pedir = (id) => new Promise((ok) => svc.onRequest({ method: 'guara.get', params: { sistema: id } }, (e, r) => ok(r)))
const resumo = (r) => r.ok ? `ok vol ${r.payload.vol} var ${r.payload.varDia} hist ${r.payload.histVol.length} represas ${r.payload.represas.length}${r.payload.parcial ? ' (parcial)' : ''}${r.stale ? ' (cache)' : ''}` : 'falhou: ' + r.error
console.log('API inteira     :', resumo(await pedir(66)))
falhar = new Set(['/elementos', '/diario'])
console.log('SQL fora (com cache no celular):', resumo(await pedir(66)))
delete store.mananciais_payload_66
console.log('SQL fora (sem cache, recém-instalado):', resumo(await pedir(66)))
delete store.mananciais_payload_66
falhar = new Set(['lenta'])
const t0 = Date.now(); const r = await pedir(66); console.log('API travada (sem cache):', resumo(r), '| respondeu em', Math.round((Date.now() - t0) / 1000), 's')
process.exit(0)
