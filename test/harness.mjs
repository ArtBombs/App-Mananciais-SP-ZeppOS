import { build } from 'esbuild'
import { buildPayload } from '../shared/sabesp.js'
import { DATA, geral, nomes, elementos, diario } from './fixture.mjs'

const payload = (id) => buildPayload(id, DATA, diario(id), elementos[id] || [], nomes, geral)
for (const id of [66, 64, 75]) {
  const p = payload(id)
  console.log(`payload ${id}: ${JSON.stringify(p).length} B | vol ${p.vol} var ${p.varDia} | nível ${p.nivel} (${p.nivelDe}) | represas: ${p.represas.map(r=>r.n+' '+r.v).join(', ')}`)
}
console.log('todos:', payload(66).todos.map(t=>t.id+':'+t.v).join(' '))

const widgets = []
globalThis.__canvasOps = []
const mk = (type, opts) => { if (type==='CANVAS') return mkCanvas(opts); const w = { type, opts:{...opts, visible:true}, ev:{}, vivo:true, setProperty(k,v){ if(k==='MORE') Object.assign(this.opts,v); else this.opts[k]=v }, addEventListener(e,f){ this.ev[e]=f } }; widgets.push(w); return w }
function mkCanvas(opts){ const ops=[]; const w={ type:'CANVAS', opts:{...opts, visible:true}, ev:{}, vivo:true, ops, setProperty(){}, addEventListener(){} }
  for (const f of ['setPaint','drawLine','drawRect','strokeRect','drawCircle','strokeCircle','drawPoly','strokePoly','drawArc','strokeArc','clear']) w[f]=(o)=>{ for (const [k,v] of Object.entries(o)) if (typeof v==='number' && !isFinite(v)) throw new Error(f+' '+k+' não finito'); ops.push([f,o]) }
  widgets.push(w); globalThis.__canvasOps.push(ops); return w }
const store = {}
globalThis.__files = {}
globalThis.__zos = {
  ui: { createWidget: mk, deleteWidget:(w)=>{ w.vivo=false; return true }, widget:{TEXT:'TEXT',ARC:'ARC',FILL_RECT:'FILL_RECT',CANVAS:'CANVAS',IMG:'IMG'}, prop:{TEXT:'text',COLOR:'color',MORE:'MORE',VISIBLE:'visible'}, align:{CENTER_H:'c',LEFT:'l',RIGHT:'r',CENTER_V:'v'}, text_style:{NONE:0}, event:{CLICK_UP:'up'} },
  page: { setScrollMode:(o)=>{ globalThis.__scroll=o; globalThis.__lock=false }, setScrollLock:(o)=>{ globalThis.__lock=o.lock }, SCROLL_MODE_SWIPER:'swiper', getSwiperIndex:()=>globalThis.__tela ?? 1 },
  interaction: { KEY_HOME:1, KEY_SHORTCUT:2, KEY_BACK:3, KEY_EVENT_CLICK:10, KEY_EVENT_PRESS:11, KEY_EVENT_RELEASE:12, KEY_EVENT_LONG_PRESS:13, GESTURE_RIGHT:21, GESTURE_LEFT:22,
    onKey:(o)=>{ globalThis.__key=o.callback }, offKey:()=>{ globalThis.__key=null },
    onDigitalCrown:(o)=>{ globalThis.__crown=o.callback }, offDigitalCrown:()=>{ globalThis.__crown=null },
    onGesture:(o)=>{ globalThis.__gest=o.callback }, offGesture:()=>{ globalThis.__gest=null } },
  storage: { localStorage: { getItem(k,d){ if(typeof d!=='string') throw new Error('default precisa ser string'); return store[k]??d }, setItem(k,v){ if(typeof v!=='string') throw new Error('valor precisa ser string'); store[k]=v } } },
  utils: { px:(v)=>v },
  settings: { getLanguage:()=>Number(process.env.LANG_ZEPP ?? 20) },
  display: { setPageBrightTime:()=>0, resetPageBrightTime:()=>0 },
  fs: { writeFileSync:(o)=>{ globalThis.__files[o.path]=o.data } },
  router: { replace:(o)=>{ globalThis.__replace=o }, push:(o)=>{ globalThis.__push=o } },
}
const res = await build({ entryPoints:['page/index/index.page.js'], bundle:true, write:false, format:'esm', platform:'node',
  plugins:[{ name:'zos', setup(b){
    b.onResolve({filter:/^@zos\//}, a=>({path:a.path, namespace:'zos'}))
    b.onResolve({filter:/^@zeppos\/zml\/base-page$/}, a=>({path:a.path, namespace:'zml'}))
    b.onLoad({filter:/.*/, namespace:'zos'}, a=>({contents:`module.exports = globalThis.__zos.${a.path.split('/')[1]}`, loader:'js'}))
    b.onLoad({filter:/.*/, namespace:'zml'}, ()=>({contents:`export const BasePage = (o)=>o`, loader:'js'}))
  }}]})
let page; globalThis.Page = (o)=>{ page=o }
await import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))
const pedidos = []
page.request = async (q) => { pedidos.push(q.params.sistema); return { ok:true, payload: payload(q.params.sistema) } }
page.error = console.error
const tick0 = () => new Promise(r=>setTimeout(r,45))
// router.replace → recria a página do zero (como o relógio faz)
const tick = async () => { await tick0(); if (globalThis.__replace) { const u=globalThis.__replace.url; globalThis.__replace=null; globalThis.__recargas=(globalThis.__recargas||0)+1; page.onDestroy(); widgets.forEach(w=>w.vivo=false); page.state = { ui: {}, sistema: 66, cache: null, todos: null, listaAberta: false }; page.onInit(); page.build(); await tick0(); console.log('   ↻ replace', u, '→ telas', page.state.nTelas) } }
const vis = (w) => w.vivo && w.opts.visible !== false
const tela = (n) => widgets.filter(w=>w.type==='TEXT' && vis(w) && w.opts.y>=n*480 && w.opts.y<(n+1)*480 && w.opts.text).map(w=>w.opts.text).join(' | ')
const lista = () => widgets.filter(w=>w.type==='TEXT' && vis(w) && w.opts.y<480 && w.opts.text)

page.onInit(); page.build(); await tick()
console.log('\n[abre] telas', globalThis.__scroll.options.count, '| pediu', pedidos.join(','))
for (let n=0;n<page.state.nTelas;n++) console.log(` tela ${n+1}:`, tela(n))
let titulo = page.state.ui.titulo
const cv = widgets.find(w=>w.type==='CANVAS'); console.log('modo PNG: imagem', widgets.filter(w=>w.type==='IMG').map(w=>w.opts.src+'@'+w.opts.y).join(','), '| canvases', widgets.filter(w=>w.type==='CANVAS').length, '| água', Object.entries(page.state.ui.diagrama.telas).map(([k,t])=>k+' h'+t.agua.opts.h).join(' ')); console.log('canvas do diagrama:', !!cv, '| operações', cv && cv.ops.length, '| por tipo', cv && JSON.stringify(cv.ops.reduce((a,[f])=>(a[f]=(a[f]||0)+1,a),{})))
if (process.env.DUMP) { const fs=await import('fs'); fs.writeFileSync(process.env.DUMP, JSON.stringify({ ops: cv.ops, textos: widgets.filter(w=>w.type==='TEXT'&&w.vivo&&w.opts.y>=1440&&w.opts.y<1920).map(w=>w.opts) })) }
console.log('widgets da lista antes do toque:', page.state.ui.lista ? page.state.ui.lista.length : 0)

titulo.ev.up(); await tick()
const L = () => page.state.ui.lista
const linha = (nome) => L().find(w=>w.type==='TEXT' && w.opts.text===nome)
console.log('\n[toque no nome] scroll travado:', globalThis.__lock, '| widgets da lista:', L().length, '| linhas:', L().filter(w=>w.type==='TEXT').map(w=>w.opts.text).join(' · '))

const criados = L(); linha('Cantareira').ev.up(); const carr = page.state.ui.carregando; console.log('tela de carregamento:', carr ? carr.filter(w=>w.type==='TEXT').map(w=>w.opts.text).join(' / ') : 'nenhuma'); await tick(); titulo = page.state.ui.titulo
console.log('lista apagada ao fechar:', criados.every(w=>!w.vivo), '| lista atual:', page.state.ui.lista)
console.log('\n[escolheu Cantareira] travado:', globalThis.__lock, '| swiper reaplicado:', globalThis.__scroll.mode, '| salvo:', store.mananciais_sistema, '| pediu', pedidos.join(','))
for (let n=0;n<page.state.nTelas;n++) console.log(` tela ${n+1}:`, tela(n))

titulo.ev.up(); await tick(); linha(['15','20',undefined].includes(process.env.LANG_ZEPP) ? 'Integrado RMSP' : 'Integrated SP').ev.up(); await tick()
console.log('recargas até aqui (66→64 recarrega; 64→75 não):', globalThis.__recargas, '| canvas vivo?', widgets.some(w=>w.type==='CANVAS'&&w.vivo))
console.log('\n[escolheu Integrado RMSP]')
for (let n=0;n<page.state.nTelas;n++) console.log(` tela ${n+1}:`, tela(n))
console.log('\nponte guara.json (deve ser Guarapiranga):', globalThis.__files['guara.json'])
console.log('erros na tela:', widgets.filter(w=>w.vivo && String(w.opts.text).startsWith('ERRO')).map(w=>w.opts.text))
console.log('fora da tela:', widgets.filter(w=> (w.opts.y % 480) + (w.opts.h||0) > 480).length)

// ─── Coroa ──────────────────────────────────────────────────────────
const I = globalThis.__zos.interaction
const espera = (ms) => new Promise(r=>setTimeout(r,ms))
// Clique da coroa como o firmware pode mandar: PRESS → RELEASE → CLICK
const cliqueCoroa = async (key = I.KEY_HOME) => { const k=globalThis.__key; const r=[k(key,I.KEY_EVENT_PRESS), k(key,I.KEY_EVENT_RELEASE), k(key,I.KEY_EVENT_CLICK)]; await tick(); await espera(520); return r }
const gira = async (deg, vezes) => { for (let i=0;i<vezes;i++){ globalThis.__crown && globalThis.__crown(1, deg); await espera(100) } }
const cursorNome = () => page.state.ui.listaLinhas ? page.state.ui.listaLinhas[page.state.cursor].nome.opts.text : '(lista fechada)'
const sist = () => page.state.sistema

console.log('\n── COROA ──')
console.log('sistema atual:', sist(), '| giro capturado com lista fechada?', !!globalThis.__crown)
globalThis.__tela = 2
let r = await cliqueCoroa()
console.log('[tela 2] clique →', JSON.stringify(r), '| lista aberta?', page.state.listaAberta, '(deve: não, e false = padrão do relógio)')
globalThis.__tela = 1
r = await cliqueCoroa()
console.log('[tela 1] clique →', JSON.stringify(r), '| lista aberta?', page.state.listaAberta, '| giro capturado?', !!globalThis.__crown, '| cursor em:', cursorNome())
await gira(-20, 1); console.log('  giro horário 1 passo → cursor:', cursorNome())
await gira(-8, 1);  console.log('  giro curto (-8°, abaixo do passo) → cursor:', cursorNome())
await gira(-8, 1);  console.log('  +(-8°) completa o passo → cursor:', cursorNome())
await gira(-30, 10); console.log('  10 giros horários → cursor (trava no fim):', cursorNome())
await gira(30, 3);  console.log('  3 giros anti-horários → cursor:', cursorNome())
r = await cliqueCoroa(); await tick()
console.log('  clique confirma → lista aberta?', page.state.listaAberta, '| sistema:', sist(), '| título:', page.state.ui.titulo.opts.text, '| giro liberado?', !globalThis.__crown, '| swiper destravado?', globalThis.__lock === false)
r = await cliqueCoroa(); console.log('[tela 1] abre de novo → cursor começa no sistema em uso:', cursorNome())
await gira(-20, 1)
r = await cliqueCoroa(I.KEY_SHORTCUT); console.log('  botão de baixo → fecha sem trocar? aberta:', page.state.listaAberta, '| sistema:', sist())
await cliqueCoroa(); globalThis.__gest(I.GESTURE_RIGHT); await tick(); console.log('  deslizar p/ direita → fecha? aberta:', page.state.listaAberta)
await cliqueCoroa(); const k=globalThis.__key; const longo=[k(1,I.KEY_EVENT_PRESS), k(1,I.KEY_EVENT_LONG_PRESS), k(1,I.KEY_EVENT_RELEASE)]
console.log('  segurar a coroa com lista aberta →', JSON.stringify(longo), '| lista continua aberta?', page.state.listaAberta, '(segurar fica com o sistema)')
page.onDestroy(); console.log('onDestroy libera tudo?', !globalThis.__key && !globalThis.__crown && !globalThis.__gest)
console.log('erros na tela (fim):', widgets.filter(w=>w.vivo && String(w.opts.text).startsWith('ERRO')).length)

// ─── Cenários do relógio real (v1.1.4) ──────────────────────────────
console.log('\n── VARIANTES DO FIRMWARE ──')
// Reabre a página do zero com getSwiperIndex 0-based e eventos em objeto
widgets.length = 0
globalThis.__tela = 0 // 0-based: tela 1 = 0
page.state = { ui: {}, sistema: 66, cache: null, todos: null, listaAberta: false }
page.onInit(); page.build(); await tick()
const dbg = () => page.state.ui.dbg && page.state.ui.dbg.opts.text
const k2 = globalThis.__key
console.log('linha debug ao abrir:', dbg())
const ev = (key, e) => k2({ key, event: e }) // formato objeto
ev(1, I.KEY_EVENT_PRESS); ev(1, I.KEY_EVENT_CLICK); await tick()
console.log('[getSwiperIndex=0, evento objeto] clique → lista aberta?', page.state.listaAberta, '| debug:', dbg())
globalThis.__crown({ key: 1, degree: -20 }); await espera(100)
console.log('  giro em objeto {degree:-20} → cursor:', cursorNome(), '| debug lista:', page.state.ui.dbgLista && page.state.ui.dbgLista.opts.text)
globalThis.__crown(-20); await espera(100)
console.log('  giro só com número (-20) → cursor:', cursorNome())
await espera(520); ev(1, I.KEY_EVENT_CLICK); await tick()
console.log('  clique confirma → aberta?', page.state.listaAberta, '| sistema:', sist())
// on_page tem prioridade: simula ir para a tela 2 pelo callback
const onPage = globalThis.__scroll.options.modeParams.on_page
console.log('modeParams enviado:', JSON.stringify({ crown_enable: globalThis.__scroll.options.modeParams.crown_enable, on_page: typeof onPage }))
onPage(1); globalThis.__tela = 0 // getSwiperIndex desatualizado de propósito
await espera(520); ev(1, I.KEY_EVENT_CLICK); await tick()
console.log('[on_page=1 (tela 2)] clique → aberta?', page.state.listaAberta, '(deve: não)')
onPage(0); await espera(520); ev(1, I.KEY_EVENT_CLICK); await tick()
console.log('[on_page=0 (tela 1)] clique → aberta?', page.state.listaAberta, '(deve: sim) | debug:', dbg())

await espera(520); globalThis.__tela = 1; onPage(0); ev(1, I.KEY_EVENT_CLICK); await tick()
console.log('crown_enable com lista aberta:', globalThis.__scroll.options.modeParams.crown_enable, '| travado:', globalThis.__lock)
await espera(520); ev(1, I.KEY_EVENT_CLICK); await tick()
console.log('crown_enable depois de fechar:', globalThis.__scroll.options.modeParams.crown_enable, '| travado:', globalThis.__lock, '| aberta:', page.state.listaAberta)

// ─── Códigos reais do Balance (diagnóstico de 05/11): clique 13, giro 38/40, evento 1 ───
console.log('\n── CÓDIGOS REAIS DO BALANCE ──')
if (page.state.listaAberta) { page.fecharLista(); await tick() }
await espera(520); globalThis.__tela = 1; onPage(0)
const kr = (key) => globalThis.__key(key, 1)
console.log('[tela 1] coroa clica (13/1) →', kr(13), '| lista aberta?', page.state.listaAberta, '| cursor:', cursorNome())
const giroReal = async (key, n) => { const r=[]; for (let i=0;i<n;i++){ r.push(kr(key)); await espera(60) } return r }
let rr = await giroReal(40, 2); console.log('  2× giro 40 (DOWN) →', JSON.stringify(rr), '| cursor:', cursorNome())
rr = await giroReal(38, 1); console.log('  1× giro 38 (UP) → cursor:', cursorNome())
kr(40); kr(40); console.log('  2 eventos 40 colados (<35 ms, mesmo dente) → cursor:', cursorNome())
await espera(520); console.log('  coroa clica (13/1) →', kr(13), '| aberta?', page.state.listaAberta, '| sistema:', sist(), '| crown_enable:', globalThis.__scroll.options.modeParams.crown_enable)
onPage(2); await espera(520)
console.log('[tela 3] giro 38 →', kr(38), '(false = sistema troca de tela) | clique 13 →', kr(13), '| aberta?', page.state.listaAberta)
console.log('debug tela 1:', page.state.ui.dbg && page.state.ui.dbg.opts.text)

// ─── Diagrama do Alto Tietê ───────────────────────────────────────
console.log('\n── ALTO TIETÊ ──')
widgets.length = 0
store.mananciais_sistema = '65'
page.state = { ui: {}, sistema: 66, cache: null, todos: null, listaAberta: false }
page.onInit(); page.build(); await tick()
const cv65 = widgets.find(w=>w.type==='CANVAS' && w.vivo)
console.log('sistema', page.state.sistema, '| telas', page.state.nTelas, '| canvas vivos', widgets.filter(w=>w.type==='CANVAS'&&w.vivo).length, '| água', Object.entries(page.state.ui.diagrama.telas).map(([k,t])=>k+' h'+t.agua.opts.h+' '+t.agua.opts.color.toString(16)).join(' · '))
for (let n=0;n<page.state.nTelas;n++) console.log(` tela ${n+1}:`, tela(n))
console.log('erros:', widgets.filter(w=>w.vivo && String(w.opts.text).startsWith('ERRO')).map(w=>w.opts.text))
if (process.env.DUMP65) { const fs=await import('fs'); const t4=(w)=>w.vivo&&w.opts.y>=1440&&w.opts.y<1920; fs.writeFileSync(process.env.DUMP65, JSON.stringify({ canvases: widgets.filter(w=>w.type==='CANVAS'&&t4(w)).map(w=>({x:w.opts.x,y:w.opts.y,ops:w.ops})), rects: widgets.filter(w=>w.type==='FILL_RECT'&&t4(w)).map(w=>w.opts), imgs: widgets.filter(w=>w.type==='IMG'&&t4(w)).map(w=>w.opts), textos: widgets.filter(w=>w.type==='TEXT'&&t4(w)).map(w=>w.opts) })) }
// trocar Alto Tietê → Cantareira recarrega; → Guarapiranga recarrega com o outro desenho
const r0 = globalThis.__recargas
page.selecionar(66); await tick()
console.log('Alto Tietê → Guarapiranga: recarregou?', globalThis.__recargas === r0 + 1, '| telas', page.state.nTelas, '| tanques', page.state.ui.diagrama && page.state.ui.diagrama.tanques.map(t=>t.chave).join(','))


// ─── Rio Claro (PNG) ──────────────────────────────────────────────
console.log('\n── RIO CLARO ──')
widgets.length = 0
store.mananciais_sistema = '69'
page.state = { ui: {}, sistema: 66, cache: null, todos: null, listaAberta: false }
page.onInit(); page.build(); await tick()
console.log('telas', page.state.nTelas, '| canvas vivos', widgets.filter(w=>w.type==='CANVAS'&&w.vivo).length, '| água', Object.entries(page.state.ui.diagrama.telas).map(([k,t])=>k+' h'+t.agua.opts.h).join(' '))
console.log(' tela 4:', tela(3))
if (process.env.DUMP69) { const fs=await import('fs'); const t4=(w)=>w.vivo&&w.opts.y>=1440&&w.opts.y<1920; fs.writeFileSync(process.env.DUMP69, JSON.stringify({ canvases: [], rects: widgets.filter(w=>w.type==='FILL_RECT'&&t4(w)).map(w=>w.opts), imgs: widgets.filter(w=>w.type==='IMG'&&t4(w)).map(w=>w.opts), textos: widgets.filter(w=>w.type==='TEXT'&&t4(w)).map(w=>w.opts) })) }

// ─── Cotia (PNG) ──────────────────────────────────────────────────
console.log('\n── COTIA ──')
widgets.length = 0
store.mananciais_sistema = '67'
page.state = { ui: {}, sistema: 66, cache: null, todos: null, listaAberta: false }
page.onInit(); page.build(); await tick()
console.log('telas', page.state.nTelas, '| canvas vivos', widgets.filter(w=>w.type==='CANVAS'&&w.vivo).length, '| água', Object.entries(page.state.ui.diagrama.telas).map(([k,t])=>k+' h'+t.agua.opts.h).join(' '))
console.log(' tela 4:', tela(3))
if (process.env.DUMP67) { const fs=await import('fs'); const t4=(w)=>w.vivo&&w.opts.y>=1440&&w.opts.y<1920; fs.writeFileSync(process.env.DUMP67, JSON.stringify({ canvases: [], rects: widgets.filter(w=>w.type==='FILL_RECT'&&t4(w)).map(w=>w.opts), imgs: widgets.filter(w=>w.type==='IMG'&&t4(w)).map(w=>w.opts), textos: widgets.filter(w=>w.type==='TEXT'&&t4(w)).map(w=>w.opts) })) }

// ─── Rio Grande (PNG) ─────────────────────────────────────────────
console.log('\n── RIO GRANDE ──')
widgets.length = 0
store.mananciais_sistema = '68'
page.state = { ui: {}, sistema: 66, cache: null, todos: null, listaAberta: false }
page.onInit(); page.build(); await tick()
console.log('telas', page.state.nTelas, '| canvas vivos', widgets.filter(w=>w.type==='CANVAS'&&w.vivo).length, '| água', Object.entries(page.state.ui.diagrama.telas).map(([k,t])=>k+' h'+t.agua.opts.h).join(' '))
console.log(' tela 4:', tela(3))
if (process.env.DUMP68) { const fs=await import('fs'); const t4=(w)=>w.vivo&&w.opts.y>=1440&&w.opts.y<1920; fs.writeFileSync(process.env.DUMP68, JSON.stringify({ canvases: [], rects: widgets.filter(w=>w.type==='FILL_RECT'&&t4(w)).map(w=>w.opts), imgs: widgets.filter(w=>w.type==='IMG'&&t4(w)).map(w=>w.opts), textos: widgets.filter(w=>w.type==='TEXT'&&t4(w)).map(w=>w.opts) })) }

// ─── Cantareira (PNG) ─────────────────────────────────────────────
console.log('\n── CANTAREIRA ──')
widgets.length = 0
store.mananciais_sistema = '64'
page.state = { ui: {}, sistema: 66, cache: null, todos: null, listaAberta: false }
page.onInit(); page.build(); await tick()
console.log('telas', page.state.nTelas, '| canvas vivos', widgets.filter(w=>w.type==='CANVAS'&&w.vivo).length, '| água', Object.entries(page.state.ui.diagrama.telas).map(([k,t])=>k+' h'+t.agua.opts.h).join(' '))
console.log(' tela 4:', tela(3))
if (process.env.DUMP64) { const fs=await import('fs'); const t4=(w)=>w.vivo&&w.opts.y>=1440&&w.opts.y<1920; fs.writeFileSync(process.env.DUMP64, JSON.stringify({ canvases: [], rects: widgets.filter(w=>w.type==='FILL_RECT'&&t4(w)).map(w=>w.opts), imgs: widgets.filter(w=>w.type==='IMG'&&t4(w)).map(w=>w.opts), textos: widgets.filter(w=>w.type==='TEXT'&&t4(w)).map(w=>w.opts) })) }

// ─── São Lourenço (PNG) ───────────────────────────────────────────
console.log('\n── SÃO LOURENÇO ──')
widgets.length = 0
store.mananciais_sistema = '72'
page.state = { ui: {}, sistema: 66, cache: null, todos: null, listaAberta: false }
page.onInit(); page.build(); await tick()
console.log('telas', page.state.nTelas, '| canvas vivos', widgets.filter(w=>w.type==='CANVAS'&&w.vivo).length, '| água', Object.entries(page.state.ui.diagrama.telas).map(([k,t])=>k+' h'+t.agua.opts.h).join(' '))
console.log(' tela 4:', tela(3))
if (process.env.DUMP72) { const fs=await import('fs'); const t4=(w)=>w.vivo&&w.opts.y>=1440&&w.opts.y<1920; fs.writeFileSync(process.env.DUMP72, JSON.stringify({ canvases: [], rects: widgets.filter(w=>w.type==='FILL_RECT'&&t4(w)).map(w=>w.opts), imgs: widgets.filter(w=>w.type==='IMG'&&t4(w)).map(w=>w.opts), textos: widgets.filter(w=>w.type==='TEXT'&&t4(w)).map(w=>w.opts) })) }

// ─── Prévia de todos os diagramas (DUMPALL=pasta) ─────────────────
if (process.env.DUMPALL) {
  const fs = await import('fs')
  for (const id of [66, 65, 64, 67, 68, 69, 72]) {
    widgets.length = 0
    store.mananciais_sistema = String(id)
    page.state = { ui: {}, sistema: 66, cache: null, todos: null, listaAberta: false }
    page.onInit(); page.build(); await tick()
    const t4 = (w) => w.vivo && w.opts.y >= 1440 && w.opts.y < 1920
    fs.writeFileSync(process.env.DUMPALL + '/d' + id + '.json', JSON.stringify({ canvases: [], rects: widgets.filter(w=>w.type==='FILL_RECT'&&t4(w)).map(w=>w.opts), imgs: widgets.filter(w=>w.type==='IMG'&&t4(w)).map(w=>w.opts), textos: widgets.filter(w=>w.type==='TEXT'&&t4(w)).map(w=>w.opts) }))
  }
}

// ─── Gesto para o Sobre ───────────────────────────────────────────
console.log('\n── SOBRE ──')
widgets.length = 0
store.mananciais_sistema = '66'
page.state = { ui: {}, sistema: 66, cache: null, todos: null, listaAberta: false }
page.onInit(); page.build(); await tick()
globalThis.__push = null
console.log('deslizar ← :', globalThis.__gest(22), '| push', JSON.stringify(globalThis.__push))
store.mananciais_sobre_aberto = '1'
console.log('coroa com o Sobre por cima → lista abre?', (globalThis.__key(13,1), page.state.listaAberta))
store.mananciais_sobre_aberto = '0'
globalThis.__key(13,1); console.log('coroa depois de voltar → lista abre?', page.state.listaAberta)
globalThis.__push = null
console.log('deslizar ← com a lista aberta:', globalThis.__gest(22), '| push', globalThis.__push, '| deslizar → fecha a lista:', globalThis.__gest(21), page.state.listaAberta)
console.log('deslizar → fora da lista (sistema decide):', globalThis.__gest(21))

// ─── Página inteira para capturas da loja (DUMPPAGINA=arquivo.json, SISTEMA_CAPTURA=66) ──
if (process.env.DUMPPAGINA) {
  const fs = await import('fs')
  widgets.length = 0
  store.mananciais_sistema = process.env.SISTEMA_CAPTURA || '66'
  // dados reais da Sabesp de 08/11/2026 (Guarapiranga) para as capturas da loja
  const real = JSON.parse(fs.readFileSync(new URL(process.env.CAPTURA_JSON || './dados/captura-2026-11-08.json', import.meta.url)))
  page.request = async () => ({ ok: true, payload: real })
  page.state = { ui: {}, sistema: 66, cache: null, todos: null, listaAberta: false }
  page.onInit(); page.build(); await tick()
  const vivos = () => widgets.filter((w) => w.vivo && w.opts.visible !== false && w.type !== 'CANVAS').map((w) => ({ type: w.type, ...w.opts }))
  const pag = vivos()
  page.abrirLista() // lista de sistemas (camada sobre a tela 1)
  const comLista = vivos()
  fs.writeFileSync(process.env.DUMPPAGINA, JSON.stringify({ n: page.state.nTelas, widgets: pag, lista: comLista.filter((w) => w.y < 480) }))
}
