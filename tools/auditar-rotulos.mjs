import { build } from 'esbuild'
const res = await build({ entryPoints:['page/index/diagrama.js'], bundle:true, write:false, format:'esm', platform:'node',
  plugins:[{ name:'zos', setup(b){ b.onResolve({filter:/^@zos\//},a=>({path:a.path,namespace:'zos'})); b.onLoad({filter:/.*/,namespace:'zos'},()=>({contents:'export const createWidget=()=>({}),widget={},align={},text_style={},prop={},px=(v)=>v',loader:'js'})) }}]})
const { ESQUEMAS } = await import('data:text/javascript;base64,'+Buffer.from(res.outputFiles[0].text).toString('base64'))
const larg = (t, size) => [...t].length * size * 0.58 // estimativa da fonte do relógio
for (const [id, E] of Object.entries(ESQUEMAS)) {
  if (!E.fundo) continue
  const itens = E.rotulos.map(([x,y,t,size,cor,w]) => ({x,y,t,size,w:Math.max(w||160, Math.ceil([...t].length*size*0.66)+12)}))
    .concat(E.tanques.map(t=>({x:t.cx,y:t.cy,t:'100%',size:t.size,w:Math.max(t.w, Math.ceil(4*t.size*0.66)+12)})))
  for (const r of itens) {
    const L = larg(r.t, r.size), h = Math.round(r.size*1.5)
    const flags = []
    if (L > r.w - 4) flags.push(`largura ${Math.round(L)}>${r.w}`)
    const cantos = [[r.x-L/2, r.y-r.size*0.6],[r.x+L/2, r.y-r.size*0.6],[r.x-L/2, r.y+r.size*0.6],[r.x+L/2, r.y+r.size*0.6]]
    const d = Math.max(...cantos.map(([a,b])=>Math.hypot(a-240,b-240)))
    if (d > 230) flags.push(`borda ${Math.round(d)}`)
    if (flags.length) console.log(id, JSON.stringify(r.t), r.size, '→', flags.join(' · '))
  }
}
