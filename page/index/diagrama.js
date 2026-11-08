// Tela "Por dentro do sistema" — um esquema por sistema, desenhado em código: um CANVAS + TEXT por cima.
// Guarapiranga: desenho da ArtBombs no Illustrator (Telas Manaciais SP.ai, 6ª prancheta).
// Alto Tietê: versão redonda do diagrama do site da Sabesp, no mesmo estilo.
// Coordenadas em px de design (480), relativas ao topo da tela do diagrama.
// A doc do CANVAS limita a 3 camadas empilhadas: aqui é um canvas só.
import { createWidget, widget, align, text_style, prop } from '@zos/ui'
import { rotuloDiagrama } from '../i18n'
import { px } from '@zos/utils'

const P = (v) => Math.round(px(v))
const pt = (x, y, r = 0) => ({ x, y, r })

// ─── Geometria ─────────────────────────────────────────────────────
// Polilinha com cantos arredondados (raio por ponto: pt(x, y, r)). Devolve pontos densos.
function arredondar(pts, rPadrao = 0, fechado = false, passosMin = 3) {
  const n = pts.length
  const out = []
  for (let i = 0; i < n; i++) {
    const p = pts[i]
    const r = p.r || rPadrao
    const ponta = !fechado && (i === 0 || i === n - 1)
    if (ponta || r <= 0) {
      out.push(p)
      continue
    }
    const a = pts[(i - 1 + n) % n]
    const b = pts[(i + 1) % n]
    const d1 = Math.hypot(a.x - p.x, a.y - p.y)
    const d2 = Math.hypot(b.x - p.x, b.y - p.y)
    const rr = Math.min(r, d1, d2)
    const passos = Math.max(passosMin, Math.ceil(rr / 3)) // curva lisa em raios grandes
    const p1 = { x: p.x + ((a.x - p.x) / d1) * rr, y: p.y + ((a.y - p.y) / d1) * rr }
    const p2 = { x: p.x + ((b.x - p.x) / d2) * rr, y: p.y + ((b.y - p.y) / d2) * rr }
    // Bézier racional com controle no canto: peso sin(φ/2) = arco de círculo exato.
    const cosf = ((a.x - p.x) * (b.x - p.x) + (a.y - p.y) * (b.y - p.y)) / (d1 * d2)
    const k = Math.sqrt(Math.max(0, (1 - cosf) / 2))
    for (let s = 0; s <= passos; s++) {
      const t = s / passos
      const u = 1 - t
      const w = 2 * u * t * k
      const den = u * u + w + t * t
      out.push({ x: (u * u * p1.x + w * p.x + t * t * p2.x) / den, y: (u * u * p1.y + w * p.y + t * t * p2.y) / den })
    }
  }
  return out
}

// Recorta um polígono convexo, ficando com a parte abaixo de y = yl.
function abaixoDe(pts, yl) {
  const out = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const ina = a.y >= yl
    const inb = b.y >= yl
    if (ina) out.push(a)
    if (ina !== inb) {
      const t = (yl - a.y) / (b.y - a.y)
      out.push({ x: a.x + t * (b.x - a.x), y: yl })
    }
  }
  return out
}

// ─── Primitivas no canvas ─────────────────────────────────────────
function pintar(cv, cor, lw) {
  cv.setPaint({ color: cor, line_width: P(lw) })
}

// Traço grosso: segmentos + círculos nas juntas (sem "dentes" nos cantos).
function traco(cv, pts, lw, cor, fechado = false) {
  const q = fechado ? pts.concat([pts[0]]) : pts
  pintar(cv, cor, lw)
  for (let i = 0; i < q.length - 1; i++) {
    cv.drawLine({ x1: P(q[i].x), y1: P(q[i].y), x2: P(q[i + 1].x), y2: P(q[i + 1].y), color: cor })
  }
  if (lw > 2) {
    const ini = fechado ? 0 : 1
    const fim = fechado ? pts.length : pts.length - 1
    for (let i = ini; i < fim; i++) cv.drawCircle({ center_x: P(pts[i].x), center_y: P(pts[i].y), radius: P(lw / 2), color: cor })
  }
}

// Tracejado ao longo do caminho (as "gotas" brancas dentro do cano).
function tracejado(cv, pts, cor, tam = 13, vao = 10, lw = 2, fase = 4) {
  pintar(cv, cor, lw)
  const per = tam + vao
  let pos = fase % per // posição dentro do padrão
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const L = Math.hypot(b.x - a.x, b.y - a.y)
    if (L < 0.01) continue
    const ux = (b.x - a.x) / L
    const uy = (b.y - a.y) / L
    let s = 0
    while (s < L) {
      const resto = pos < tam ? tam - pos : per - pos
      const passo = Math.min(resto, L - s)
      if (pos < tam && passo > 0.5) {
        cv.drawLine({
          x1: P(a.x + ux * s), y1: P(a.y + uy * s),
          x2: P(a.x + ux * (s + passo)), y2: P(a.y + uy * (s + passo)),
          color: cor,
        })
      }
      s += passo
      pos = (pos + passo) % per
    }
  }
}

function poligono(cv, pts, cor, ox = 0, oy = 0) {
  cv.drawPoly({ data_array: pts.map((p) => ({ x: P(p.x - ox), y: P(p.y - oy) })), color: cor })
}

// Seta (triângulo cheio) — ponta em (x, y), 15 × 15, apontando para dir.
function seta(cv, x, y, dir, cor) {
  const L = 15
  const m = 7.5
  const v = {
    e: [pt(x, y), pt(x + L, y - m), pt(x + L, y + m)],
    d: [pt(x, y), pt(x - L, y - m), pt(x - L, y + m)],
    b: [pt(x, y), pt(x - m, y - L), pt(x + m, y - L)],
    c: [pt(x, y), pt(x - m, y + L), pt(x + m, y + L)],
  }[dir]
  poligono(cv, v, cor)
}

function retangulo(cv, x1, y1, x2, y2, cor) {
  cv.drawRect({ x1: P(x1), y1: P(y1), x2: P(x2), y2: P(y2), color: cor })
}

// ─── Elementos ────────────────────────────────────────────────────
// Cano: azul grosso + tracejado branco.
function cano(cv, pts, C, r = 8) {
  const d = arredondar(pts, r)
  traco(cv, d, 4, C.agua)
  tracejado(cv, d, C.text)
}

// Estação elevatória (EEAB): bocal de saída em cima à direita, entrada embaixo à esquerda.
function bomba(cv, cx, cy, C) {
  const bocal = (x1, y1, x2, y2) => {
    retangulo(cv, x1, y1, x2, y2, C.bg)
    traco(cv, arredondar([pt(x1, y1), pt(x2, y1), pt(x2, y2), pt(x1, y2)], 1.5, true, 2), 2, C.text, true)
  }
  bocal(cx, cy - 10.5, cx + 16, cy - 4)
  bocal(cx - 16.5, cy + 3.5, cx, cy + 10)
  cv.drawCircle({ center_x: P(cx), center_y: P(cy), radius: P(10.5), color: C.bg })
  pintar(cv, C.text, 2)
  cv.strokeCircle({ center_x: P(cx), center_y: P(cy), radius: P(9.5), color: C.text })
  cv.strokeCircle({ center_x: P(cx), center_y: P(cy), radius: P(3.8), color: C.text })
}

// Barragem: trapézio com cantos arredondados, contorno branco e miolo preto.
function barragem(cv, pts, C, lw = 4, r = 6) {
  const d = arredondar(pts, r, true)
  poligono(cv, d, C.bg)
  traco(cv, d, lw, C.text, true)
}

// Prédios de São Paulo (desenho original em 139..226 × 282..366), com origem e escala.
function saoPaulo(cv, ox, oy, s, C) {
  const X = (x) => ox + (x - 139) * s
  const Y = (y) => oy + (y - 282) * s
  const lw = Math.max(1.5, 2 * s)
  const predio = (x1, y1, x2, y2, janelas) => {
    const d = arredondar([pt(X(x1), Y(y2)), pt(X(x1), Y(y1), 4 * s), pt(X(x2), Y(y1), 4 * s), pt(X(x2), Y(y2))])
    poligono(cv, d, C.bg)
    traco(cv, d, lw, C.text)
    for (const [x, y] of janelas) {
      retangulo(cv, X(x), Y(y), X(x + 8), Y(y + 8), C.text)
      retangulo(cv, X(x + 2.5), Y(y + 2.5), X(x + 5.5), Y(y + 5.5), C.bg)
    }
  }
  predio(164, 282, 201.5, 366, [[172, 291], [186, 291], [172, 304], [186, 304], [186, 317], [186, 330], [186, 344]])
  predio(145, 308, 181, 366, [[152, 317], [166, 317], [152, 330], [166, 330], [152, 344], [166, 344]])
  predio(200, 313, 221, 366, [[205, 322], [205, 334], [205, 348]])
  traco(cv, [pt(X(139), Y(366.5)), pt(X(226), Y(366.5))], Math.max(2, 2.5 * s), C.text)
}

// ETA (desenho original em 307..370 × 326..363), com origem e escala.
function eta(cv, ox, oy, s, C) {
  const X = (x) => ox + (x - 307) * s
  const Y = (y) => oy + (y - 326) * s
  const caixa = (x1, y1, x2, y2, r) => arredondar([pt(X(x1), Y(y1)), pt(X(x2), Y(y1)), pt(X(x2), Y(y2)), pt(X(x1), Y(y2))], r * s, true, 2)
  const borda = caixa(307, 326, 370, 363, 3)
  poligono(cv, borda, C.bg)
  traco(cv, borda, 2, C.agua, true)
  traco(cv, caixa(333, 331, 366, 343, 2.5), 2, C.agua, true)
  traco(cv, caixa(333, 346, 366, 358, 2.5), 2, C.agua, true)
  pintar(cv, C.agua, 2)
  for (const y of [333.8, 344.3, 354.7]) {
    for (const x of [315, 324.5]) cv.strokeCircle({ center_x: P(X(x)), center_y: P(Y(y)), radius: P(Math.max(2, 3 * s)), color: C.agua })
  }
}

// Marca de túnel (‖) atravessando um cano vertical.
// o = 'v' (cano vertical, marcas deitadas) | 'h' (cano horizontal, marcas em pé)
function tunel(cv, x, y, C, o = 'v') {
  if (o === 'h') {
    traco(cv, [pt(x - 3, y - 7), pt(x - 3, y + 7)], 2, C.text)
    traco(cv, [pt(x + 3, y - 7), pt(x + 3, y + 7)], 2, C.text)
    return
  }
  traco(cv, [pt(x - 7, y - 3), pt(x + 7, y - 3)], 2, C.text)
  traco(cv, [pt(x - 7, y + 3), pt(x + 7, y + 3)], 2, C.text)
}

// Bomba de pé. dir 'b' (água descendo): entrada em cima em x-6,75, saída embaixo em x+7,25.
// dir 'c' (subindo): saída em cima em x-7,25, entrada embaixo em x+6,75.
function bombaV(cv, cx, cy, dir, C) {
  const bocal = (x1, y1, x2, y2) => {
    retangulo(cv, x1, y1, x2, y2, C.bg)
    traco(cv, arredondar([pt(x1, y1), pt(x2, y1), pt(x2, y2), pt(x1, y2)], 1.5, true, 2), 2, C.text, true)
  }
  if (dir === 'c') {
    bocal(cx - 10.5, cy - 16, cx - 4, cy)
    bocal(cx + 3.5, cy, cx + 10, cy + 16.5)
  } else {
    bocal(cx - 10, cy - 16.5, cx - 3.5, cy)
    bocal(cx + 4, cy, cx + 10.5, cy + 16)
  }
  cv.drawCircle({ center_x: P(cx), center_y: P(cy), radius: P(10.5), color: C.bg })
  pintar(cv, C.text, 2)
  cv.strokeCircle({ center_x: P(cx), center_y: P(cy), radius: P(9.5), color: C.text })
  cv.strokeCircle({ center_x: P(cx), center_y: P(cy), radius: P(3.8), color: C.text })
}

// Rio: faixa azul com o canal (cano tracejado) no meio.
function rio(cv, y1, y2, x1, x2, C) {
  poligono(cv, [pt(x1, y1), pt(x2, y1), pt(x2, y2), pt(x1, y2)], C.chuva)
}

// Reservatório: quadrado com o canto de baixo à direita redondo.
const formaTanque = (t) => arredondar([pt(t.x1, t.y1), pt(t.x2, t.y1), pt(t.x2, t.y2, t.r), pt(t.x1, t.y2)], 0, true)

// Unidade compacta (barragem + reservatório + nome), usada nos sistemas com muitas represas.
// xr = lado direito da barragem, yt = topo. Tamanho = metade da barragem da Guarapiranga.
// s = escala (1 = barragem 27×50 e reservatório 70×34). semTanque: captação/represa sem dado de volume.
function unidade(chave, nome, xr, yt, s = 1, semTanque = false) {
  const x1 = xr + 2
  const y1 = yt + 10 * s
  return {
    chave, nome, semTanque,
    barragem: [pt(xr - 14 * s, yt), pt(xr, yt), pt(xr, yt + 50 * s), pt(xr - 27 * s, yt + 50 * s)],
    blw: s >= 1.4 ? 4 : 3, br: Math.round(4 * s),
    x1, y1, x2: x1 + 70 * s, y2: y1 + 34 * s, r: 22 * s,
    cx: x1 + 35 * s, cy: yt + 27 * s, size: Math.round(20 * s), w: 70 * s,
    // nome: em cima do reservatório; sem reservatório, em cima da barragem
    rx: semTanque ? xr - 10 * s : x1 + 35 * s + 5, ry: semTanque ? yt - 12 : y1 - 16, rsize: s >= 2 ? 17 : 15,
  }
}
const nomeEm = (u, rx, ry, rsize = u.rsize) => Object.assign(u, { rx, ry, rsize })
// Cópia da unidade deslocada (posição medida no PNG da arte, que moveu o conjunto barragem + reservatório).
const mover = (u, dx, dy) => ({
  ...u, barragem: u.barragem.map((p) => pt(p.x + dx, p.y + dy)),
  x1: u.x1 + dx, x2: u.x2 + dx, y1: u.y1 + dy, y2: u.y2 + dy, cx: u.cx + dx, cy: u.cy + dy, rx: u.rx + dx, ry: u.ry + dy,
})
const barragemDe = (u) => ['barragem', u.barragem.map((p) => [p.x, p.y]), u.blw, u.br]
const tanquesDe = (us) => us.filter((u) => !u.semTanque)
// Nome em cima do reservatório: começa depois da barragem (não encosta no topo dela) e,
// se passar da borda redonda da tela, diminui a fonte (mín. 12).
function nomeAjustado(u) {
  const n = [...String(u.nome)].length
  const cabe = (rx, ry, size) => {
    const larg = n * size * 0.58
    const dx = Math.max(Math.abs(rx - larg / 2 - 240), Math.abs(rx + larg / 2 - 240))
    return Math.hypot(dx, Math.abs(ry - 240) + size * 0.4) <= 234
  }
  if (u.semTanque) return [u.rx, u.ry, u.nome, u.rsize, 'text', 150]
  // 1) empurra para a direita até sair de cima da barragem (diminuindo a fonte se bater na borda)
  for (let size = u.rsize; size >= 13; size--) {
    const rx = Math.max(u.rx, u.x1 + (n * size * 0.58) / 2 + 3)
    if (cabe(rx, u.ry, size)) return [rx, u.ry, u.nome, size, 'text', 150]
  }
  // 2) não coube: mantém o centro e sobe o nome para acima do topo da barragem
  const topo = u.barragem ? Math.min(...u.barragem.map((p) => p.y)) : u.y1 - 10
  for (let size = u.rsize; size >= 12; size--) {
    const ry = Math.min(u.ry, topo - size * 0.6 - 3)
    if (cabe(u.rx, ry, size)) return [u.rx, ry, u.nome, size, 'text', 150]
  }
  return [u.rx, u.ry, u.nome, 12, 'text', 150]
}
const nomesDe = (us) => us.map(nomeAjustado)

// Reservatório 70×34 numa posição medida no PNG (x1, y1 = canto de cima à esquerda da janela).
function tanqueEm(chave, nome, x1, y1, x2 = x1 + 70, y2 = y1 + 34) {
  return { chave, nome, x1, y1, x2, y2, r: 22, cx: x1 + 35, cy: y1 + 17, size: 20, w: 70, rx: x1 + 40, ry: y1 - 16, rsize: 15 }
}

// A caixa cresce com o texto (v1.3.2: rótulos truncados no relógio) e tem folga em cima e
// embaixo para acentos (Á, ã, ç). O texto continua centrado em (cx, cy).
function rotulo(y0, cx, cy, txt, size, cor, w = 160) {
  const wa = Math.max(w, Math.ceil([...String(txt)].length * size * 0.66) + 12)
  const h = Math.round(size * 1.9)
  return createWidget(widget.TEXT, {
    x: px(Math.round(cx - wa / 2)), y: px(Math.round(y0 + cy - h / 2)), w: px(wa), h: px(h),
    text: txt, text_size: px(size), color: cor,
    align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.NONE,
  })
}

// ─── Esquemas declarativos ────────────────────────────────────────
// Cada desenho é uma lista de elementos. O relógio interpreta a lista no canvas (reserva quando
// não há PNG) e tools/esquema-svg.mjs gera o SVG para finalizar no Illustrator.
//   ['cano', [[x,y],…], r?] · ['bomba', cx, cy] · ['seta', x, y, 'e'|'d'|'b'|'c']
//   ['barragem', [[x,y],…], lw?, r?] · ['poligono', [[x,y],…], cor] · ['rio', y1, y2, x1, x2]
//   ['bombaV', cx, cy, 'b'|'c'] · ['tunel', x, y, 'v'|'h'] · ['eta', ox, oy, escala] · ['saoPaulo', ox, oy, escala]
const pts = (l) => l.map(([x, y]) => pt(x, y))
function desenharLista(cv, lista, C) {
  for (const [tipo, ...a] of lista) {
    if (tipo === 'cano') cano(cv, pts(a[0]), C, a[1] ?? 8)
    else if (tipo === 'bomba') bomba(cv, a[0], a[1], C)
    else if (tipo === 'bombaV') bombaV(cv, a[0], a[1], a[2], C)
    else if (tipo === 'seta') seta(cv, a[0], a[1], a[2], C.text)
    else if (tipo === 'barragem') barragem(cv, pts(a[0]), C, a[1] ?? 4, a[2] ?? 6)
    else if (tipo === 'poligono') poligono(cv, pts(a[0]), C[a[1]])
    else if (tipo === 'rio') rio(cv, a[0], a[1], a[2], a[3], C)
    else if (tipo === 'tunel') tunel(cv, a[0], a[1], C, a[2])
    else if (tipo === 'eta') eta(cv, a[0], a[1], a[2], C)
    else if (tipo === 'saoPaulo') saoPaulo(cv, a[0], a[1], a[2], C)
  }
}

// ─── Guarapiranga (66) ────────────────────────────────────────────
const TANQUES_66 = [
  { chave: 'guarapiranga', x1: 92, y1: 142, x2: 192, y2: 210, r: 55, cx: 136, cy: 173, size: 36, w: 100 },
  { chave: 'billings', x1: 296, y1: 64, x2: 358, y2: 120, r: 28, cx: 327, cy: 90, size: 26, w: 64 },
  { chave: 'capivari', x1: 395, y1: 204, x2: 458, y2: 259, r: 27, cx: 425, cy: 229, size: 20, w: 64 },
]

const DESENHO_66 = [
  ['cano', [[284, 50], [284, 34.5], [233, 34.5]]], // Billings → EEAB
  ['cano', [[200.5, 48.75], [138, 48.75], [74.5, 90], [74.5, 122]]], // EEAB → Guarapiranga
  ['cano', [[385, 186], [385, 166.5], [289, 166.5]]], // Capivari → EEAB
  ['cano', [[256.5, 180.75], [216, 180.75], [216, 99], [83, 99], [83, 122]]], // EEAB → Guarapiranga
  ['cano', [[68, 222], [68, 254], [248.5, 254]]], // Guarapiranga → EEAB
  ['cano', [[281, 240.5], [326, 240.5], [326, 326]]], // EEAB → ETA
  ['cano', [[307, 346], [222, 346]]], // ETA → São Paulo
  ['cano', [[50.5, 222], [50.5, 347.5], [97, 347.5], [97, 408]]], // descarga → rio
  ['poligono', [[70, 408], [410, 408], [390, 434], [90, 434]], 'chuva'], // Rio Pinheiros
  ['cano', [[82, 421.75], [398, 421.75]]],
  ['bomba', 217, 42], ['bomba', 273, 174], ['bomba', 265, 247.25],
  ['seta', 249, 34.5, 'e'], ['seta', 157.5, 48.75, 'e'], ['seta', 324.5, 166.5, 'e'], ['seta', 226.5, 180.75, 'e'],
  ['seta', 163.5, 254, 'd'], ['seta', 326, 305, 'b'], ['seta', 256, 346, 'e'], ['seta', 50.5, 298, 'b'],
  ['barragem', [[62, 122], [90, 122], [90, 222], [37, 222]]], // Guarapiranga
  ['barragem', [[272, 48], [294, 48], [294, 122], [253, 122]]], // Billings
  ['barragem', [[373, 186], [393, 186], [393, 262], [353, 262]]], // Capivari
  ['saoPaulo', 139, 282, 1],
  ['eta', 307, 326, 1],
]

const ROTULOS_66 = [
  [331, 54, 'Billings', 15], [145, 122, 'Guarapiranga', 17], [427, 182, 'Capivari', 15, 'text', 90],
  [215, 67, 'EEAB', 15, 'text', 70], [273, 199, 'EEAB', 15, 'text', 70], [265, 272, 'EEAB', 15, 'text', 70],
  [182, 381, 'São Paulo', 17], [340, 381, 'ETA', 17, 'agua', 80], [235, 449, 'Rio Pinheiros', 17, 'text', 180],
]

// ─── Alto Tietê (65) ──────────────────────────────────────────────
// Do diagrama do site: Paraitinga e Ponte Nova soltam no Rio Tietê; a EEAB Biritiba bombeia do rio
// para Biritiba; Biritiba → Túnel T2 → Jundiaí → Túnel T3 → Taiaçupeba → captação → ETA → São Paulo.
// Jundiaí e Taiaçupeba também descarregam no Tietê. (EEABs Itapanhaú, Rio Grande e Guaió ficaram de fora.)
const AT = {
  par: unidade('paraitinga', 'Paraitinga', 128, 62),
  pon: unidade('ponte nova', 'Ponte Nova', 290, 62),
  bir: unidade('biritiba', 'Biritiba', 366, 196),
  jun: unidade('jundia', 'Jundiaí', 245, 280),
  tai: unidade('taia', 'Taiaçupeba', 125, 340),
}
// Desenho em código (reserva, layout v1.2.1). Com o PNG, valem as posições abaixo.
const DESENHO_65_TANQUES = Object.values(AT)
// Janelas dos reservatórios medidas no PNG ajustado na arte (07/11).
const TANQUES_65 = [
  tanqueEm('paraitinga', 'Paraitinga', 130, 72),
  nomeEm(tanqueEm('ponte nova', 'Ponte Nova', 292, 72), 326, 58),
  tanqueEm('biritiba', 'Biritiba', 376, 184, 447, 219),
  tanqueEm('jundia', 'Jundiaí', 230, 243),
  tanqueEm('taia', 'Taiaçupeba', 118, 315),
]

const DESENHO_65 = [
  ['rio', 142, 158, 0, 480], // Rio Tietê, correndo para a esquerda
  ['cano', [[10, 150], [470, 150]]],
  ['cano', [[112, 100], [112, 150]]], // Paraitinga → Tietê
  ['cano', [[274, 100], [274, 150]]], // Ponte Nova → Tietê
  ['cano', [[310, 150], [310, 182.75], [316, 182.75]]], // Tietê → EEAB Biritiba
  ['cano', [[347, 168.75], [359, 168.75], [359, 205]]], // EEAB → Biritiba
  ['cano', [[347, 236], [347, 296], [317, 296]]], // Biritiba → Túnel T2 → Jundiaí
  ['cano', [[229, 320], [229, 356], [197, 356]]], // Jundiaí → Túnel T3 → Taiaçupeba
  ['cano', [[232, 305], [92, 305], [92, 150]]], // Jundiaí → Tietê
  ['cano', [[112, 370], [66, 370], [66, 150]]], // Taiaçupeba → Tietê
  ['cano', [[111, 380], [111, 418], [134, 418]]], // Taiaçupeba → captação
  ['cano', [[166, 404.5], [201, 404.5]]], // captação → ETA
  ['cano', [[247, 411], [284, 411]]], // ETA → São Paulo
  ['bomba', 332, 176], // EEAB Biritiba
  ['bomba', 150, 411.25], // captação Taiaçupeba
  ['tunel', 347, 266], ['tunel', 229, 340],
  ['seta', 210, 150, 'e'], ['seta', 430, 150, 'e'], ['seta', 112, 138, 'b'], ['seta', 274, 138, 'b'],
  ['seta', 347, 292, 'b'], ['seta', 92, 200, 'c'], ['seta', 66, 230, 'c'], ['seta', 197, 404.5, 'd'], ['seta', 280, 411, 'd'],
  ...DESENHO_65_TANQUES.map((t) => ['barragem', t.barragem.map((p) => [p.x, p.y]), 3, 4]),
  ['eta', 201, 397, 0.75],
  ['saoPaulo', 287, 374, 0.6],
]

const ROTULOS_65 = nomesDe(TANQUES_65).concat([
  // posições medidas no PNG (bombas, túneis, ETA e prédios)
  [190, 171, 'Rio Tietê', 15, 'text', 100],
  [316, 203, 'EEAB', 13, 'text', 50],
  [393, 243, 'Túnel T2', 13, 'text', 70],
  [257, 301, 'Túnel T3', 13, 'text', 70],
  [141, 408, 'Captação', 13, 'text', 70],
  [237, 425, 'ETA', 15, 'agua', 50],
  [375, 375, 'São Paulo', 15, 'text', 90],
])

// ─── Cantareira (64) ──────────────────────────────────────────────
// Jaguari/Jacareí → Túnel 7 → Cachoeira → Túnel 6 → Atibainha → Túnel 5 → Paiva Castro → EEAB Santa Inês
// → Águas Claras → Captação → ETA Guaraú → São Paulo. Jaguari (PBS) → EEAB Paraíba do Sul → Atibainha.
// (Fora: descargas para a bacia do Piracicaba, rios afluentes, postos e vazões.)
const CN = {
  jj: unidade('jacare', 'Jaguari/Jacareí', 190, 58),
  ca: unidade('cachoeira', 'Cachoeira', 345, 128),
  at: unidade('atibainha', 'Atibainha', 345, 215),
  pc: unidade('paiva', 'Paiva Castro', 110, 210),
  ac: nomeEm(unidade('guas claras', 'Águas Claras', 150, 305), 207, 299),
  pbs: nomeEm(unidade('pbs', 'Jaguari (PBS)', 350, 320), 405, 314),
}
const DESENHO_64 = [
  ['cano', [[178, 100], [178, 116], [338, 116], [338, 135]]], // Túnel 7
  ['cano', [[338, 170], [338, 222]]], // Túnel 6
  ['cano', [[333, 228], [183, 228]]], // Túnel 5
  ['cano', [[98, 252], [98, 284.75], [104, 284.75]]], // Paiva Castro → EEAB Santa Inês
  ['cano', [[136, 270.75], [143, 270.75], [143, 312]]], // → Águas Claras
  ['cano', [[348.75, 327], [348.75, 308]]], // Jaguari (PBS) → EEAB
  ['cano', [[334.75, 276], [334.75, 258]]], // → Atibainha
  ['cano', [[137, 350], [137, 402], [148.5, 402]]], // Águas Claras → captação
  ['cano', [[181, 388.5], [196, 388.5]]], // → ETA
  ['cano', [[243, 395], [264, 395]]], // ETA → São Paulo
  ['bomba', 120, 278], ['bombaV', 342, 292, 'c'], ['bomba', 165, 395.25],
  ['tunel', 258, 116, 'h'], ['tunel', 338, 186], ['tunel', 258, 228, 'h'],
  ['seta', 305, 116, 'd'], ['seta', 338, 212, 'b'], ['seta', 200, 228, 'e'], ['seta', 143, 302, 'b'], ['seta', 262, 395, 'd'],
  ...Object.values(CN).map(barragemDe),
  ['eta', 196, 381, 0.75],
  ['saoPaulo', 264, 385, 0.6],
]
// Posições medidas no PNG da arte (07/11): Cachoeira, Paiva Castro, Águas Claras e PBS deslocados.
const CN_PNG = [
  CN.jj, mover(CN.ca, -14, -23), CN.at, mover(CN.pc, -52, -51), mover(CN.ac, -10, -6), nomeEm(mover(CN.pbs, 0, 7), 390, 317),
]
const ROTULOS_64 = nomesDe(CN_PNG).concat([
  [220, 142, 'Túnel 7', 13, 'text', 70], [300, 180, 'Túnel 6', 13, 'text', 70], [260, 242, 'Túnel 5', 13, 'text', 70],
  [68, 297, 'EEAB', 13, 'text', 50], [397, 291, 'Paraíba do Sul', 13, 'text', 100],
  [92, 381, 'Captação', 12, 'text', 70], [197, 427, 'ETA Guaraú', 13, 'agua', 90], [286, 437, 'São Paulo', 15, 'text', 90],
])

// ─── Cotia (67) ───────────────────────────────────────────────────
// Pedro Beicht → Cachoeira da Graça → Captação → ETA Alto Cotia → São Paulo.
// Cachoeira da Graça → Isolina (sem dado de volume) → ETA Baixo Cotia → São Paulo.
const CT = {
  pb: nomeEm(unidade('pedro beicht', 'Pedro Beicht', 290, 75, 1.4), 336, 73),
  cg: nomeEm(unidade('graça', 'Cachoeira da Graça', 210, 190, 1.4), 290, 186),
  is: nomeEm(unidade('isolina', 'Isolina', 110, 300, 1.4, true), 140, 330),
}
const DESENHO_67 = [
  ['cano', [[268, 138], [268, 160], [200, 160], [200, 198]]], // Pedro Beicht → Cachoeira da Graça
  ['cano', [[186, 240], [100, 240], [100, 308]]], // Cachoeira da Graça → Isolina
  ['cano', [[196, 252], [196, 323], [215.5, 323]]], // → captação
  ['cano', [[248, 309.5], [282, 309.5]]], // → ETA Alto Cotia
  ['cano', [[329, 316], [352, 316], [352, 405], [268, 405]]], // → São Paulo
  ['cano', [[92, 362], [92, 395], [130, 395]]], // Isolina → ETA Baixo Cotia
  ['cano', [[177, 395], [212, 395]]], // → São Paulo
  ['bomba', 232, 316.25],
  ['seta', 225, 160, 'e'], ['seta', 100, 292, 'b'], ['seta', 290, 405, 'e'], ['seta', 205, 395, 'd'],
  ...Object.values(CT).map(barragemDe),
  ['eta', 282, 302, 0.75], ['eta', 130, 381, 0.75],
  ['saoPaulo', 214, 380, 0.6],
]
// Posições medidas no PNG da arte (07/11): barragens deslocadas, ETAs, bomba e prédios.
const CT_PNG = [mover(CT.pb, -67, -31), mover(CT.cg, -12, -24), mover(CT.is, -12, -30)]
const ROTULOS_67 = nomesDe(CT_PNG).concat([
  [215, 297, 'Captação', 13, 'text', 70], [294, 298, 'ETA Alto Cotia', 13, 'agua', 100],
  [142, 391, 'ETA Baixo Cotia', 13, 'agua', 110], [272, 436, 'São Paulo', 15, 'text', 90],
])

// ─── Rio Grande (68) ──────────────────────────────────────────────
// Ribeirão da Estiva (sem dado) → Rio Grande; Estiva → Captação → ETA Rib. da Estiva → São Paulo.
// Rio Grande → Captação → ETA Rio Grande → São Paulo; Rio Grande → Billings; EEAB Rio Pequeno → Rio Grande.
// (Fora: EEAB Rio Grande–Taiaçupeba.)
const RG = {
  rg: unidade('rio grande', 'Rio Grande', 230, 180, 1.4),
  es: nomeEm(unidade('estiva', 'Rib. da Estiva', 380, 95, 1, true), 320, 85),
}
const DESENHO_68 = [
  ['cano', [[362, 128], [345, 128], [345, 205], [332, 205]]], // Estiva → Rio Grande
  ['cano', [[200, 236], [55, 236]]], // Rio Grande → Billings
  ['cano', [[198, 244], [198, 269.5]]], // Rio Grande → captação
  ['cano', [[212, 302], [212, 330], [142, 330]]], // → ETA Rio Grande
  ['cano', [[118, 344], [118, 405], [178, 405]]], // → São Paulo
  ['cano', [[224, 244], [224, 284]]], // EEAB Rio Pequeno → Rio Grande
  ['cano', [[238, 316], [238, 345], [300, 345]]], // Rio Pequeno → EEAB
  ['cano', [[376, 140], [376, 273.5]]], // Estiva → captação
  ['cano', [[390, 306], [390, 370], [337, 370]]], // → ETA Rib. da Estiva
  ['cano', [[290, 370], [255, 370], [255, 405], [234, 405]]], // → São Paulo
  ['bombaV', 204.75, 286, 'b'], ['bombaV', 231.25, 300, 'c'], ['bombaV', 382.75, 290, 'b'],
  ['seta', 345, 180, 'b'], ['seta', 85, 236, 'e'], ['seta', 118, 375, 'b'], ['seta', 175, 405, 'd'],
  ['seta', 255, 345, 'e'], ['seta', 390, 345, 'b'],
  ...Object.values(RG).map(barragemDe),
  ['eta', 95, 316, 0.75], ['eta', 290, 356, 0.75],
  ['saoPaulo', 180, 378, 0.6],
]
// Posições medidas no PNG da arte (07/11): Rio Grande deslocado; bombas, ETAs e prédios.
const RG_PNG = [mover(RG.rg, -61, -59), RG.es]
const ROTULOS_68 = nomesDe(RG_PNG).concat([
  [55, 221, 'Billings', 15, 'text', 80],
  [120, 262, 'Captação', 13, 'text', 70], [118, 302, 'ETA Rio Grande', 13, 'agua', 100],
  [280, 262, 'EEAB Rio Pequeno', 13, 'text', 120],
  [420, 238, 'Captação', 13, 'text', 70], [322, 369, 'ETA Rib. da Estiva', 13, 'agua', 120],
  [201, 436, 'São Paulo', 15, 'text', 90],
])

// ─── Rio Claro (69) ───────────────────────────────────────────────
// Ribeirão do Campo → Rio Claro → Captação Poço Preto → ETA Casa Grande → São Paulo.
// Poço Preto → Captação Rio Claro (km 76) → ETA Casa Grande. (Fora: EEAB Guaratuba e a descarga do km 76.)
const RC = {
  cp: nomeEm(unidade('campo', 'Ribeirão do Campo', 320, 90, 1.2), 322, 84, 14),
  pp: nomeEm(unidade('poço preto', 'Poço Preto', 210, 175, 1, true), 197, 163),
  km: nomeEm(unidade('km 76', 'Rio Claro (km 76)', 105, 245, 1, true), 82, 233, 13),
}
const DESENHO_69 = [
  ['cano', [[296, 144], [296, 195], [212, 195]]], // Ribeirão do Campo → Poço Preto
  ['cano', [[192, 215], [150, 215], [150, 265], [107, 265]]], // Poço Preto → km 76
  ['cano', [[92, 290], [92, 338.75], [103.5, 338.75]]], // km 76 → captação
  ['cano', [[136, 325.25], [170, 325.25], [170, 386], [190, 386]]], // → ETA Casa Grande
  ['cano', [[205, 220], [205, 372]]], // Poço Preto → captação → ETA
  ['cano', [[237, 386], [284, 386]]], // ETA → São Paulo
  ['bomba', 120, 332],
  ['seta', 235, 195, 'e'], ['seta', 125, 265, 'e'], ['seta', 205, 355, 'b'], ['seta', 276, 386, 'd'],
  ...Object.values(RC).map(barragemDe),
  ['eta', 190, 372, 0.75],
  ['saoPaulo', 284, 360, 0.6],
]
const ROTULOS_69 = nomesDe(Object.values(RC)).concat([
  [255, 182, 'Rio Claro', 13, 'text', 70],
  [120, 352, 'Captação', 13, 'text', 70], [238, 300, 'Captação', 13, 'text', 70],
  [213, 413, 'ETA Casa Grande', 13, 'agua', 110], [353, 349, 'São Paulo', 15, 'text', 90], // São Paulo: posição do PNG da arte
])

// ─── São Lourenço (72) ────────────────────────────────────────────
// Rio Juquiá → Cachoeira do França → Captação → ETA São Lourenço → São Paulo; descarga no Rio Juquiá.
const SL = {
  cf: nomeEm(unidade('fran', 'Cachoeira do França', 240, 95, 2), 310, 84),
}
const DESENHO_72 = [
  ['cano', [[425, 128], [384, 128]]], // Rio Juquiá → represa
  ['cano', [[200, 170], [60, 170]]], // descarga → Rio Juquiá
  ['cano', [[215, 190], [215, 249.5]]], // → captação
  ['cano', [[229, 282], [229, 330], [183, 330]]], // → ETA São Lourenço
  ['cano', [[151, 349], [151, 410], [198, 410]]], // → São Paulo
  ['bombaV', 221.75, 266, 'b'],
  ['seta', 402, 128, 'e'], ['seta', 90, 170, 'e'], ['seta', 192, 410, 'd'],
  barragemDe(SL.cf),
  ['eta', 120, 312, 1],
  ['saoPaulo', 200, 370, 0.8],
]
// Posições medidas no PNG da arte (07/11): represa 31 px à esquerda; bomba, ETA e prédios.
const SL_PNG = [mover(SL.cf, -31, 0)]
const ROTULOS_72 = nomesDe(SL_PNG).concat([
  [90, 154, 'Rio Juquiá', 15, 'text', 90],
  [250, 240, 'Captação', 13, 'text', 70], [122, 272, 'ETA São Lourenço', 14, 'agua', 130],
  [252, 432, 'São Paulo', 15, 'text', 90],
])

// ─── Registro ─────────────────────────────────────────────────────
// fundo: PNG 480×480 da ArtBombs (tudo o que é fixo, reservatórios vazados, sem textos) em
// assets/common.w480-r/image/diagrama_<id>.png. Com fundo: ~200 ms para montar no Balance; só código: ~1,2 s.
export const ESQUEMAS = {
  66: { nome: 'Guarapiranga', desenho: DESENHO_66, tanques: TANQUES_66, rotulos: ROTULOS_66, fundo: 'image/diagrama_66.png' },
  65: { nome: 'Alto Tietê', desenho: DESENHO_65, tanques: TANQUES_65, rotulos: ROTULOS_65, fundo: 'image/diagrama_65.png' },
  64: { nome: 'Cantareira', desenho: DESENHO_64, tanques: tanquesDe(CN_PNG), rotulos: ROTULOS_64, fundo: 'image/diagrama_64.png' },
  67: { nome: 'Cotia', desenho: DESENHO_67, tanques: tanquesDe(CT_PNG), rotulos: ROTULOS_67, fundo: 'image/diagrama_67.png' },
  68: { nome: 'Rio Grande', desenho: DESENHO_68, tanques: tanquesDe(RG_PNG), rotulos: ROTULOS_68, fundo: 'image/diagrama_68.png' },
  69: { nome: 'Rio Claro', desenho: DESENHO_69, tanques: tanquesDe(Object.values(RC)), rotulos: ROTULOS_69, fundo: 'image/diagrama_69.png' },
  72: { nome: 'São Lourenço', desenho: DESENHO_72, tanques: tanquesDe(SL_PNG), rotulos: ROTULOS_72, fundo: 'image/diagrama_72.png' },
}
export { formaTanque }
// No relógio a tela só existe com PNG: o modo canvas quebra depois de alguns router.replace.
export const temDiagrama = (id) => !!(ESQUEMAS[id] && ESQUEMAS[id].fundo)
export const temFundoPng = (id) => !!(ESQUEMAS[id] && ESQUEMAS[id].fundo)

// modo 'png': fundo em imagem + um canvas pequeno só do tamanho de cada reservatório.
// modo 'codigo': tudo num canvas 480×480.
export function montarDiagrama(sistema, y0, C, modo = 'png') {
  const E = ESQUEMAS[sistema]
  if (!E) return null
  const usaPng = modo === 'png' && !!E.fundo
  const dg = { sistema, tanques: E.tanques, pct: {}, telas: {}, modo: usaPng ? 'png' : 'codigo' }
  if (usaPng) {
    // SEM canvas no modo PNG: o Balance limita os canvas e não os libera no router.replace
    // (v1.2.4: "not a function" ao trocar de sistema). Cada reservatório = 2 FILL_RECT
    // (vazio + água) por baixo; o PNG por cima tem o canto arredondado já pintado de preto
    // (tools/mascara_png.py), então o retângulo vira a forma certa.
    for (const t of E.tanques) {
      const caixa = (yt, cor) => ({ x: px(Math.round(t.x1)), y: px(Math.round(y0 + yt)), w: px(Math.round(t.x2 - t.x1)), h: px(Math.max(1, Math.round(t.y2 - yt))), color: cor })
      const vazio = createWidget(widget.FILL_RECT, caixa(t.y1, C.track))
      const agua = createWidget(widget.FILL_RECT, caixa(t.y2 - 1, C.track))
      dg.telas[t.chave] = { agua, vazio, caixa }
    }
    createWidget(widget.IMG, { x: 0, y: px(y0), w: px(480), h: px(480), src: E.fundo })
  } else {
    const cv = createWidget(widget.CANVAS, { x: 0, y: px(y0), w: px(480), h: px(480) })
    desenharLista(cv, E.desenho, C)
    for (const t of E.tanques) dg.telas[t.chave] = { cv, ox: 0, oy: 0 }
  }

  // Reservatórios vazios até o primeiro dado
  pintarTanques(dg, null, C)

  // Textos (widgets por cima do canvas)
  for (const [x, y, t, size, cor, w] of E.rotulos) rotulo(y0, x, y, rotuloDiagrama(t), size, C[cor || 'text'], w || 160)
  for (const t of E.tanques) dg.pct[t.chave] = rotulo(y0, t.cx, t.cy, '--%', t.size, C.text, t.w)
  return dg
}

// Nível de cada reservatório: fundo C.track + água C.chuva até a altura do volume.
// Desenho opaco por cima do anterior, sem precisar limpar o canvas.
export function pintarTanques(dg, represas, C, setText) {
  if (!dg || !dg.telas) return
  const acha = (chave) => (represas || []).find((r) => String(r.n || '').toLowerCase().indexOf(chave) >= 0)
  for (const t of dg.tanques) {
    const tl = dg.telas[t.chave]
    if (!tl) continue
    const rp = acha(t.chave)
    const v = rp && typeof rp.v === 'number' ? rp.v : null
    if (tl.agua) {
      // modo PNG: só ajusta a altura do retângulo da água
      const nivel = v === null ? 0 : Math.max(0, Math.min(100, v)) / 100
      const h = Math.round((t.y2 - t.y1) * nivel)
      tl.agua.setProperty(prop.MORE, h >= 1 ? tl.caixa(t.y2 - h, C.chuva) : tl.caixa(t.y2 - 1, C.track))
      if (setText && dg.pct[t.chave]) setText(dg.pct[t.chave], v === null ? '--%' : Math.round(v) + '%')
      continue
    }
    const forma = formaTanque(t)
    poligono(tl.cv, forma, C.track, tl.ox, tl.oy)
    if (v !== null && v > 0) {
      const nivel = Math.max(0, Math.min(100, v)) / 100
      const yl = t.y2 - (t.y2 - t.y1) * nivel
      const agua = abaixoDe(forma, yl)
      if (agua.length >= 3) poligono(tl.cv, agua, C.chuva, tl.ox, tl.oy)
    }
    if (setText && dg.pct[t.chave]) setText(dg.pct[t.chave], v === null ? '--%' : Math.round(v) + '%')
  }
}
