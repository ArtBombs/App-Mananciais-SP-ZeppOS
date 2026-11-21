// Teste da tela Sobre: monta, confere versão/data, abre e fecha o QR. DUMP=arquivo.json grava os widgets.
import { build } from 'esbuild'
const widgets = []
const mk = (type, opts) => { const w = { type, opts: { ...opts }, ev: {}, vivo: true, addEventListener(e, f) { this.ev[e] = f } }; widgets.push(w); return w }
const SW = Number(process.env.DEV_W || 480)
const SH = Number(process.env.DEV_H || 480)
const PAG = SW === SH ? 480 : SH
const store = {}
globalThis.__zos = {
  ui: { createWidget: mk, deleteWidget: (w) => { w.vivo = false }, widget: { TEXT: 'TEXT', IMG: 'IMG', FILL_RECT: 'FILL_RECT', QRCODE: 'QRCODE' }, align: { CENTER_H: 'c', CENTER_V: 'v' }, text_style: { NONE: 0 }, event: { CLICK_UP: 'up' } },
  app: { getPackageInfo: () => ({ version: { name: '1.6.0', code: 25 } }) },
  storage: { localStorage: { getItem: (k, d) => store[k] ?? d, setItem: (k, v) => { if (typeof v !== 'string') throw new Error('string'); store[k] = v } } },
  display: { setPageBrightTime: () => 0 },
  utils: { px: (v) => (v * SW) / 480 },
  device: { getDeviceInfo: () => ({ width: SW, height: SH }) },
  settings: { getLanguage: () => Number(process.env.LANG_ZEPP ?? 20) },
}
const res = await build({ entryPoints: ['page/about/index.page.js'], bundle: true, write: false, format: 'esm', platform: 'node',
  plugins: [{ name: 'zos', setup(b) {
    b.onResolve({ filter: /^@zos\// }, (a) => ({ path: a.path, namespace: 'zos' }))
    b.onLoad({ filter: /.*/, namespace: 'zos' }, (a) => ({ contents: `module.exports = globalThis.__zos.${a.path.split('/')[1]}`, loader: 'js' }))
  } }] })
let page; globalThis.Page = (o) => { page = o }
await import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
page.onInit(JSON.stringify({ data: '2026-11-08' })); page.build()
const textos = () => widgets.filter((w) => w.vivo && w.type === 'TEXT' && w.opts.text).map((w) => w.opts.text)
console.log('Sobre:', textos().join(' | '), '| imagem', widgets.find((w) => w.type === 'IMG').opts.src, '| flag', store.mananciais_sobre_aberto)
if (process.env.DUMP) { const fs = await import('fs'); fs.writeFileSync(process.env.DUMP, JSON.stringify({ canvases: [], rects: [], imgs: widgets.filter((w) => w.type === 'IMG').map((w) => ({ ...w.opts, y: w.opts.y + 3 * PAG })), textos: widgets.filter((w) => w.type === 'TEXT' && w.opts.text).map((w) => ({ ...w.opts, y: w.opts.y + 3 * PAG })) })) }
const apoio = widgets.find((w) => w.type === 'TEXT' && w.opts.text === '' && Math.abs(w.opts.w - (216 * SW) / 480) < 0.01)
apoio.ev.up()
console.log('toque no apoio → QR:', widgets.filter((w) => w.vivo && w.type === 'IMG' && /qr/.test(w.opts.src)).map((w) => w.opts.src + ' @' + w.opts.x + ',' + w.opts.y + ' ' + w.opts.w + '×' + w.opts.h).join(), '| camadas', page.state.qr.length)
page.state.qr[page.state.qr.length - 1].ev.up()
console.log('toque em qualquer lugar → QR fechado?', !page.state.qr && widgets.filter((w) => w.vivo && w.type === 'IMG' && /qr/.test(w.opts.src)).length === 0)
page.onDestroy(); console.log('ao sair, flag:', store.mananciais_sobre_aberto)
