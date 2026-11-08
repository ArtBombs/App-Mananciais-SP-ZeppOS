// Gera o SVG 480×480 de um diagrama "Por dentro do sistema" a partir das listas de page/index/diagrama.js
// (as mesmas que o relógio desenha), para finalizar no Illustrator e exportar o PNG de fundo.
//   node tools/esquema-svg.mjs 65 [saida.svg]
// Grupos: ARTE (exportar) · GUIA_reservatorios e GUIA_textos (esconder antes de exportar) · GUIA_tela.
import { build } from 'esbuild'
import { writeFileSync } from 'fs'

// Mesmos tokens de page/index/index.page.js
const C = {
  bg: '#000000', track: '#14262c', text: '#e8f4f6', muted: '#7a9aa3',
  agua: '#2ec4d6', chuva: '#5b8def',
}

const res = await build({
  entryPoints: ['page/index/diagrama.js'], bundle: true, write: false, format: 'esm', platform: 'node',
  plugins: [{ name: 'zos', setup(b) {
    b.onResolve({ filter: /^@zos\// }, (a) => ({ path: a.path, namespace: 'zos' }))
    b.onLoad({ filter: /.*/, namespace: 'zos' }, () => ({ contents: 'export const createWidget=()=>({}),widget={},align={},text_style={},prop={},px=(v)=>v', loader: 'js' }))
  } }],
})
const { ESQUEMAS } = await import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'))

const id = Number(process.argv[2] || 65)
if (process.argv.includes('--tanques')) {
  // JSON das janelas dos reservatórios (usado por tools/mascara_png.py)
  console.log(JSON.stringify(ESQUEMAS[id].tanques.map(({ chave, x1, y1, x2, y2, r }) => ({ chave, x1, y1, x2, y2, r }))))
  process.exit(0)
}
const E = ESQUEMAS[id]
if (!E) throw new Error('sem esquema para ' + id)
const saida = process.argv[3] || `design/diagrama_${id}.svg`

const n = (v) => Math.round(v * 100) / 100

// Polilinha com cantos em arco. A distância de tangência é a mesma do relógio (min(r, lados)).
function caminho(pontos, r = 0, fechado = false) {
  const P = pontos.map(([x, y, rr]) => ({ x, y, r: rr ?? r }))
  const N = P.length
  const out = []
  for (let i = 0; i < N; i++) {
    const p = P[i]
    const ponta = !fechado && (i === 0 || i === N - 1)
    if (ponta || !p.r) {
      out.push((out.length ? 'L' : 'M') + n(p.x) + ' ' + n(p.y))
      continue
    }
    const a = P[(i - 1 + N) % N]
    const b = P[(i + 1) % N]
    const d1 = Math.hypot(a.x - p.x, a.y - p.y)
    const d2 = Math.hypot(b.x - p.x, b.y - p.y)
    const t = Math.min(p.r, d1, d2)
    const u1 = { x: (a.x - p.x) / d1, y: (a.y - p.y) / d1 }
    const u2 = { x: (b.x - p.x) / d2, y: (b.y - p.y) / d2 }
    const phi = Math.acos(Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y)))
    const R = t * Math.tan(phi / 2)
    const p1 = { x: p.x + u1.x * t, y: p.y + u1.y * t }
    const p2 = { x: p.x + u2.x * t, y: p.y + u2.y * t }
    const cruz = (p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x)
    out.push((out.length ? 'L' : 'M') + n(p1.x) + ' ' + n(p1.y))
    out.push(`A${n(R)} ${n(R)} 0 0 ${cruz > 0 ? 1 : 0} ${n(p2.x)} ${n(p2.y)}`)
  }
  return out.join(' ') + (fechado ? ' Z' : '')
}

const caixa = (x1, y1, x2, y2, r) => caminho([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], r, true)

function bomba(cx, cy) {
  const boc = (x1, y1, x2, y2) => `<path d="${caixa(x1, y1, x2, y2, 1.5)}" fill="${C.bg}" stroke="${C.text}" stroke-width="2"/>`
  return `<g id="bomba">${boc(cx, cy - 10.5, cx + 16, cy - 4)}${boc(cx - 16.5, cy + 3.5, cx, cy + 10)}` +
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="9.5" fill="${C.bg}" stroke="${C.text}" stroke-width="2"/>` +
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="3.8" fill="none" stroke="${C.text}" stroke-width="2"/></g>`
}

function bombaV(cx, cy, dir) {
  const boc = (x1, y1, x2, y2) => `<path d="${caixa(x1, y1, x2, y2, 1.5)}" fill="${C.bg}" stroke="${C.text}" stroke-width="2"/>`
  const b = dir === 'c'
    ? boc(cx - 10.5, cy - 16, cx - 4, cy) + boc(cx + 3.5, cy, cx + 10, cy + 16.5)
    : boc(cx - 10, cy - 16.5, cx - 3.5, cy) + boc(cx + 4, cy, cx + 10.5, cy + 16)
  return `<g id="bomba">${b}<circle cx="${n(cx)}" cy="${n(cy)}" r="9.5" fill="${C.bg}" stroke="${C.text}" stroke-width="2"/>` +
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="3.8" fill="none" stroke="${C.text}" stroke-width="2"/></g>`
}

function seta(x, y, dir) {
  const L = 15, m = 7.5
  const v = {
    e: [[x, y], [x + L, y - m], [x + L, y + m]], d: [[x, y], [x - L, y - m], [x - L, y + m]],
    b: [[x, y], [x - m, y - L], [x + m, y - L]], c: [[x, y], [x - m, y + L], [x + m, y + L]],
  }[dir]
  return `<polygon points="${v.map((p) => p.map(n).join(',')).join(' ')}" fill="${C.text}"/>`
}

function eta(ox, oy, s) {
  const X = (x) => ox + (x - 307) * s
  const Y = (y) => oy + (y - 326) * s
  const bx = (x1, y1, x2, y2, r, fill) => `<path d="${caixa(X(x1), Y(y1), X(x2), Y(y2), r * s)}" fill="${fill}" stroke="${C.agua}" stroke-width="2"/>`
  let o = `<g id="ETA">${bx(307, 326, 370, 363, 3, C.bg)}${bx(333, 331, 366, 343, 2.5, 'none')}${bx(333, 346, 366, 358, 2.5, 'none')}`
  for (const y of [333.8, 344.3, 354.7]) for (const x of [315, 324.5]) o += `<circle cx="${n(X(x))}" cy="${n(Y(y))}" r="${n(Math.max(2, 3 * s))}" fill="none" stroke="${C.agua}" stroke-width="2"/>`
  return o + '</g>'
}

function saoPaulo(ox, oy, s) {
  const X = (x) => ox + (x - 139) * s
  const Y = (y) => oy + (y - 282) * s
  const lw = n(Math.max(1.5, 2 * s))
  const predio = (x1, y1, x2, y2, janelas) => {
    let o = `<path d="${caminho([[X(x1), Y(y2), 0], [X(x1), Y(y1), 4 * s], [X(x2), Y(y1), 4 * s], [X(x2), Y(y2), 0]])}" fill="${C.bg}" stroke="${C.text}" stroke-width="${lw}"/>`
    for (const [x, y] of janelas) {
      o += `<rect x="${n(X(x))}" y="${n(Y(y))}" width="${n(8 * s)}" height="${n(8 * s)}" fill="${C.text}"/>`
      o += `<rect x="${n(X(x + 2.5))}" y="${n(Y(y + 2.5))}" width="${n(3 * s)}" height="${n(3 * s)}" fill="${C.bg}"/>`
    }
    return o
  }
  return '<g id="Sao_Paulo">' +
    predio(164, 282, 201.5, 366, [[172, 291], [186, 291], [172, 304], [186, 304], [186, 317], [186, 330], [186, 344]]) +
    predio(145, 308, 181, 366, [[152, 317], [166, 317], [152, 330], [166, 330], [152, 344], [166, 344]]) +
    predio(200, 313, 221, 366, [[205, 322], [205, 334], [205, 348]]) +
    `<line x1="${n(X(139))}" y1="${n(Y(366.5))}" x2="${n(X(226))}" y2="${n(Y(366.5))}" stroke="${C.text}" stroke-width="${n(Math.max(2, 2.5 * s))}"/></g>`
}

const arte = []
for (const [tipo, ...a] of E.desenho) {
  if (tipo === 'cano') {
    const d = caminho(a[0], a[1] ?? 8)
    arte.push(`<g id="cano"><path d="${d}" fill="none" stroke="${C.agua}" stroke-width="4" stroke-linejoin="round"/>` +
      `<path d="${d}" fill="none" stroke="${C.text}" stroke-width="2" stroke-dasharray="13 10" stroke-dashoffset="4"/></g>`)
  } else if (tipo === 'bomba') arte.push(bomba(a[0], a[1]))
  else if (tipo === 'bombaV') arte.push(bombaV(a[0], a[1], a[2]))
  else if (tipo === 'seta') arte.push(seta(a[0], a[1], a[2]))
  else if (tipo === 'barragem') arte.push(`<path id="barragem" d="${caminho(a[0], a[2] ?? 6, true)}" fill="${C.bg}" stroke="${C.text}" stroke-width="${a[1] ?? 4}" stroke-linejoin="round"/>`)
  else if (tipo === 'poligono') arte.push(`<polygon points="${a[0].map((p) => p.map(n).join(',')).join(' ')}" fill="${C[a[1]]}"/>`)
  else if (tipo === 'rio') arte.push(`<rect id="rio" x="${a[2]}" y="${a[0]}" width="${a[3] - a[2]}" height="${a[1] - a[0]}" fill="${C.chuva}"/>`)
  else if (tipo === 'tunel' && a[2] === 'h') arte.push(`<g id="tunel" stroke="${C.text}" stroke-width="2"><line x1="${a[0] - 3}" y1="${a[1] - 7}" x2="${a[0] - 3}" y2="${a[1] + 7}"/><line x1="${a[0] + 3}" y1="${a[1] - 7}" x2="${a[0] + 3}" y2="${a[1] + 7}"/></g>`)
  else if (tipo === 'tunel') arte.push(`<g id="tunel" stroke="${C.text}" stroke-width="2"><line x1="${a[0] - 7}" y1="${a[1] - 3}" x2="${a[0] + 7}" y2="${a[1] - 3}"/><line x1="${a[0] - 7}" y1="${a[1] + 3}" x2="${a[0] + 7}" y2="${a[1] + 3}"/></g>`)
  else if (tipo === 'eta') arte.push(eta(a[0], a[1], a[2]))
  else if (tipo === 'saoPaulo') arte.push(saoPaulo(a[0], a[1], a[2]))
}

// Reservatórios: precisam ficar TRANSPARENTES no PNG (o app pinta o nível por baixo).
const tanques = E.tanques.map((t) => {
  const d = `M${t.x1} ${t.y1} H${t.x2} V${t.y2 - t.r} A${t.r} ${t.r} 0 0 1 ${t.x2 - t.r} ${t.y2} H${t.x1} Z`
  return `<path d="${d}" fill="${C.chuva}" fill-opacity="0.35" stroke="${C.muted}" stroke-width="1" stroke-dasharray="3 3"/>` +
    `<text x="${t.cx}" y="${t.cy}" font-size="${t.size}" fill="${C.text}" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif">00%</text>`
}).join('')

const textos = E.rotulos.map(([x, y, txt, size, cor]) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${C[cor || 'text']}" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif">${txt}</text>`).join('')

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Mananciais SP · Por dentro do sistema · ${E.nome} (${id}) · 480×480 px
     Exportar só o grupo ARTE: PNG 480×480, fundo transparente, nome diagrama_${id}.png
     GUIA_*: esconder antes de exportar (reservatórios e textos são desenhados pelo app). -->
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480">
<g id="GUIA_tela"><circle cx="240" cy="240" r="240" fill="#000000"/></g>
<g id="ARTE">
${arte.join('\n')}
</g>
<g id="GUIA_reservatorios">${tanques}</g>
<g id="GUIA_textos">${textos}</g>
</svg>
`
writeFileSync(saida, svg)
console.log(saida, svg.length, 'bytes')
