import { BasePage } from '@zeppos/zml/base-page'
// Importação nomeada SÓ para o que já rodou no Balance. Num módulo ES (QuickJS), um nome
// importado que o firmware não exporta impede a página de carregar (tela preta, sem erro).
// Funções mais novas vêm pelo namespace: se não existirem, ficam undefined e o código desvia.
import { createWidget, widget, prop, align, text_style, event } from '@zos/ui'
import * as zosUi from '@zos/ui'
import { setScrollMode, SCROLL_MODE_SWIPER } from '@zos/page'
import * as zosPage from '@zos/page'
import * as zosI from '@zos/interaction'
import { localStorage } from '@zos/storage'
import { setPageBrightTime, resetPageBrightTime } from '@zos/display'
import { writeFileSync } from '@zos/fs'
import { px } from '@zos/utils'
import * as zosRouter from '@zos/router'
import { montarDiagrama, pintarTanques, temDiagrama } from './diagrama'
import { SISTEMAS, SISTEMA_PADRAO, SISTEMA_PONTE, MAX_REPRESAS, nomeSistema as nomeSistemaPt } from '../../shared/sabesp'
import { t, fmt, dataCurta, nomeSistemaI18n } from '../i18n'

// ─── Design tokens ────────────────────────────────────────────────
const C = {
  bg: 0x000000,
  track: 0x14262c,
  text: 0xe8f4f6,
  muted: 0x7a9aa3,
  agua: 0x2ec4d6, // ≥ 60%
  atencao: 0xf2c94c, // 40–60%
  alerta: 0xf2994a, // 30–40%
  critico: 0xeb5757, // < 30%
  chuva: 0x5b8def,
  sobe: 0x6fcf97,
  desce: 0xeb5757,
}
const SCREEN = 480 // designWidth
// Telas: Volume · Chuva · Nível · [Por dentro do sistema] · Represas · 30 dias.
// O diagrama (4ª) só existe nos sistemas com esquema em diagrama.js; nos outros são 5 telas.
function layoutTelas(id) {
  const ordem = ['volume', 'chuva', 'nivel'].concat(temDiagrama(id) ? ['diagrama'] : [], ['represas', 'tend'])
  const Y = {}
  ordem.forEach((nome, i) => (Y[nome] = i * SCREEN))
  return { Y, n: ordem.length }
}
const URL_PAGINA = 'page/index/index.page'
const URL_SOBRE = 'page/about/index.page'
const K_SOBRE = 'mananciais_sobre_aberto' // '1' enquanto o Sobre está por cima (mesma chave em page/about)
const BRILHO_MS = 30000 // tempo de tela acesa com o app aberto
const K_SISTEMA = 'mananciais_sistema'
const K_CACHE = (id) => 'mananciais_payload_' + id
const K_TODOS = 'mananciais_todos'

// Ponte para mostradores: arquivo em /data deste app, lido por outros apps via
// openSync({ path, options: { appId } }) (API 3.0). Só ASCII, formato curto e estável.
// Sempre a Guarapiranga, qualquer que seja o sistema aberto no app.
const PONTE_ARQUIVO = 'guara.json'
function gravarPonte(d) {
  let v = null
  let dv = null
  const t = (d.todos || []).find((x) => x.id === SISTEMA_PONTE)
  if (t) {
    v = t.v
    dv = t.dv
  } else if (d.sistema === SISTEMA_PONTE || d.sistema === undefined) {
    v = d.vol
    dv = d.varDia
  }
  if (v === null || v === undefined) return
  try {
    writeFileSync({
      path: PONTE_ARQUIVO,
      data: JSON.stringify({ f: 1, d: d.data, v, dv, ts: d.ts }),
      options: { encoding: 'utf8' },
    })
  } catch (e) {}
}

// Arco do medidor: 270°, abertura embaixo.
// Convenção do ARC no Zepp OS (docs oficiais): 0° = 3h, crescendo no sentido horário.
// 135° = 7h30 → passa pelo topo → 405° (= 45°, 4h30).
const ARC_INI = 135
const ARC_SPAN = 270

const nomeSistema = (id) => nomeSistemaI18n(id, nomeSistemaPt(id))
const sinal = (n, dec = 1) => (n === null || n === undefined ? '--' : (n > 0 ? '+' : '') + fmt(n, dec))
const ddmm = dataCurta
const corVolume = (v) => (v === null || v === undefined ? C.muted : v >= 60 ? C.agua : v >= 40 ? C.atencao : v >= 30 ? C.alerta : C.critico)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const maiusc = (s) => String(s || '').toUpperCase()

function lerJSON(k) {
  try {
    const s = localStorage.getItem(k, '')
    return s ? JSON.parse(s) : null
  } catch (e) {
    return null
  }
}
function gravarJSON(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch (e) {}
}

function text(y0, o) {
  return createWidget(widget.TEXT, {
    x: px(o.x ?? 40),
    y: px(y0 + o.y),
    w: px(o.w ?? SCREEN - 80),
    h: px(o.h ?? 40),
    text: o.text ?? '--',
    text_size: px(o.size ?? 24),
    color: o.color ?? C.text,
    align_h: o.align ?? align.CENTER_H,
    align_v: align.CENTER_V,
    text_style: text_style.NONE,
  })
}

function rect(x, y, w, h, color, radius = 0) {
  return createWidget(widget.FILL_RECT, { x: px(x), y: px(y), w: px(w), h: px(Math.max(1, h)), color, radius: px(radius) })
}

// ─── Coroa (Balance: clique e giro = KEY_HOME; botão de baixo = KEY_SHORTCUT) ───
// degree do onDigitalCrown: negativo = sentido horário; quanto mais rápido, maior.
const COROA_PASSO = 15 // graus acumulados para andar 1 item (↑ = menos sensível)
const COROA_SENTIDO = -1 // sentido do cursor na lista: 1 = DOWN(40) desce · -1 = inverte (escolha de design, 05/11)
const COROA_INTERVALO_MS = 90 // tempo mínimo entre dois passos
const CLIQUE_DEDUP_MS = 500 // alguns firmwares mandam CLICK e RELEASE do mesmo toque
const GIRO_DEDUP_MS = 35 // ignora evento duplicado do mesmo "dente" da coroa

function chamar(fn, ...args) {
  try {
    if (typeof fn === 'function') return fn(...args)
  } catch (e) {}
  return undefined
}

// DIAGNÓSTICO: linha pequena na tela 1 e na lista com os eventos crus de tecla e coroa.
const DEBUG_BOTOES = false

// Página atual (0 = Volume). Fonte principal: callback on_page do swiper (0-based, doc oficial).
// A doc do getSwiperIndex diz "começa em 1", a do swipeToIndex/on_page "começa em 0" → por
// isso o getSwiperIndex só é usado como reserva e aceita 0 ou 1 como primeira tela.
let paginaOnPage = null
function naPrimeiraTela() {
  if (typeof paginaOnPage === 'number') return paginaOnPage === 0
  const i = chamar(zosPage.getSwiperIndex)
  return typeof i !== 'number' || i <= 1
}

// API 1.0 (hmApp) ainda existe no runtime dos apps v3; usada como canal reserva.
function hmAppGlobal() {
  try {
    return typeof hmApp !== 'undefined' ? hmApp : null
  } catch (e) {
    return null
  }
}

// O firmware pode mandar (key, valor) ou um objeto { key, degree | event }.
const num = (v) => (typeof v === 'number' ? v : Number(v))
function argsTecla(a, b) {
  if (a && typeof a === 'object') return [num(a.key), num(a.event ?? a.keyEvent ?? a.type)]
  return [num(a), num(b)]
}
function argsCoroa(a, b) {
  if (a && typeof a === 'object') return [num(a.key), num(a.degree ?? a.value ?? a.angle)]
  if (b === undefined && typeof a === 'number') return [zosI.KEY_HOME, a]
  return [num(a), num(b)]
}

function travarRolagem(lock) {
  try {
    if (typeof zosPage.setScrollLock === 'function') zosPage.setScrollLock({ lock })
  } catch (e) {}
}

// Apaga o widget; sem deleteWidget no firmware, esconde e tira da tela.
function apagar(w) {
  try {
    if (typeof zosUi.deleteWidget === 'function') return zosUi.deleteWidget(w)
  } catch (e) {}
  try {
    w.setProperty(prop.VISIBLE, false)
  } catch (e) {}
  try {
    w.setProperty(prop.MORE, { x: px(-1000), y: px(-1000), w: px(1), h: px(1) })
  } catch (e) {}
}

function setRect(wd, x, y, w, h, color, radius = 0) {
  wd.setProperty(prop.MORE, { x: px(x), y: px(y), w: px(w), h: px(Math.max(1, h)), color, radius: px(radius) })
}


Page(
  BasePage({
    state: { ui: {}, sistema: SISTEMA_PADRAO, cache: null, todos: null, listaAberta: false },

    onInit() {
      paginaOnPage = null // após router.replace a página nova começa na tela 1
      // Tela acesa por 30 s enquanto esta página estiver aberta (o sistema reseta ao sair).
      try {
        setPageBrightTime({ brightTime: BRILHO_MS })
      } catch (e) {}

      try {
        const salvo = Number(localStorage.getItem(K_SISTEMA, '') || SISTEMA_PADRAO) // padrão sempre string
        this.state.sistema = SISTEMAS.some((s) => s.id === salvo) ? salvo : SISTEMA_PADRAO
      } catch (e) {
        this.state.sistema = SISTEMA_PADRAO
      }
      this.state.cache = lerJSON(K_CACHE(this.state.sistema))
      this.state.todos = lerJSON(K_TODOS)
      try {
        localStorage.setItem(K_SOBRE, '0')
      } catch (e) {}
      // Teclas registradas cedo (antes de montar a tela e do swiper).
      this.ligarBotoes()
    },

    // Em vez de tela preta, mostra o erro (fase de desenvolvimento).
    mostrarErro(onde, e) {
      try {
        this.error(onde, e)
      } catch (x) {}
      try {
        createWidget(widget.TEXT, {
          x: px(50), y: px(170), w: px(380), h: px(160),
          text: 'ERRO em ' + onde + ':\n' + String((e && e.message) || e).slice(0, 120),
          text_size: px(22), color: C.critico,
          align_h: align.CENTER_H, align_v: align.CENTER_V,
          text_style: text_style.WRAP === undefined ? text_style.NONE : text_style.WRAP,
        })
      } catch (x) {}
    },

    // Erro dentro de uma tela específica (sem derrubar as outras).
    mostrarErroEm(y0, onde, e) {
      try {
        this.error(onde, e)
      } catch (x) {}
      try {
        text(y0, { x: 60, w: 360, y: 180, h: 120, text: 'ERRO ' + onde + ': ' + String((e && e.message) || e).slice(0, 80), size: 20, color: C.critico })
      } catch (x) {}
    },

    build() {
      try {
        this.montarTelas()
      } catch (e) {
        this.mostrarErro('build', e)
        return
      }
      this.debug()
      // Ciclo de vida: onInit → build. Pinta o cache e busca o dado novo.
      try {
        if (this.state.cache) this.render(this.state.cache, t('salvo'))
      } catch (e) {
        this.mostrarErro('render (cache)', e)
      }
      this.atualizar()
    },

    // ─── Botões físicos ───────────────────────────────────────────
    // Só captura a coroa na tela 1 e com a lista aberta; no resto, devolve false
    // e o relógio mantém o comportamento padrão.
    // Dois canais (diagnóstico): K = onKey (API 2+) · H = hmApp.registerKeyEvent (API 1).
    // A doc diz que só 1 registro vale; o que chegar primeiro aparece na linha amarela.
    ligarBotoes() {
      this.state.dbg = { k: '-', nk: 0, c: '-', nc: 0 }
      // Gestos (um registro só): com a lista aberta, deslizar para a direita fecha a lista;
      // fora dela, deslizar para a esquerda abre o Sobre. O resto segue o padrão do sistema.
      chamar(zosI.onGesture, {
        callback: (ev) => {
          if (ev === zosI.GESTURE_RIGHT && this.state.listaAberta) {
            this.fecharLista()
            return true
          }
          if (ev === zosI.GESTURE_LEFT && !this.state.listaAberta) return this.abrirSobre()
          return false
        },
      })
      chamar(zosI.onKey, {
        callback: (a, b) => {
          const [key, ev] = argsTecla(a, b)
          const r = this.tecla(key, ev)
          this.debug('k', 'K' + key + '/' + ev + (r ? '✓' : ''))
          return r
        },
      })
      const HM = hmAppGlobal()
      if (HM && typeof HM.registerKeyEvent === 'function') {
        try {
          HM.registerKeyEvent((key, acao) => {
            const k = key === HM.key.HOME ? zosI.KEY_HOME : key === HM.key.SHORTCUT ? zosI.KEY_SHORTCUT : key === HM.key.BACK ? zosI.KEY_BACK : -1
            const a = HM.action || {}
            const ev = acao === a.CLICK ? zosI.KEY_EVENT_CLICK : acao === a.PRESS ? zosI.KEY_EVENT_PRESS : acao === a.RELEASE ? zosI.KEY_EVENT_RELEASE : acao === a.LONG_PRESS ? zosI.KEY_EVENT_LONG_PRESS : -1
            const r = this.tecla(k, ev)
            this.debug('k', 'H' + key + '/' + acao + (r ? '✓' : ''))
            return r
          })
        } catch (e) {}
      }
      // Constantes reais do firmware: select/up/down/home e evento click
      const tem = 's' + zosI.KEY_SELECT + ' u' + zosI.KEY_UP + ' d' + zosI.KEY_DOWN + ' h' + zosI.KEY_HOME + ' c' + zosI.KEY_EVENT_CLICK
      this.debug('init', tem)
    },

    // Mostra o último evento cru (tecla key/evento, coroa graus) e a página atual.
    debug(tipo, valor) {
      if (!DEBUG_BOTOES) return
      const d = this.state.dbg || (this.state.dbg = { k: '-', nk: 0, c: '-', nc: 0 })
      if (tipo === 'k') {
        d.k = valor
        d.nk++
      } else if (tipo === 'c') {
        d.c = valor
        d.nc++
      } else if (tipo === 'init') d.init = valor
      const sw = chamar(zosPage.getSwiperIndex)
      const txt = d.k + '×' + d.nk + ' ' + d.c + '×' + d.nc + ' p' + paginaOnPage + ' s' + sw + ' [' + (d.init || '') + ']'
      const ui = this.state.ui
      try {
        if (ui.dbg) ui.dbg.setProperty(prop.TEXT, txt)
        if (ui.dbgLista) ui.dbgLista.setProperty(prop.TEXT, d.k + '×' + d.nk + ' ' + d.c + '×' + d.nc)
      } catch (e) {}
    },

    tecla(key, ev) {
      // Com o Sobre por cima, as teclas são dele (não abre a lista escondida aqui embaixo).
      if (!this.state.listaAberta && this.sobreAberto()) return false
      const naLista = this.state.listaAberta
      // Visto no Balance (05/11/2026, linha de diagnóstico): dentro do app a coroa chega como
      // clique = 13 (KEY_SELECT) e giro = 38 (KEY_UP) / 40 (KEY_DOWN), sempre com evento 1.
      // A doc fala em KEY_HOME; mantido como reserva para outros aparelhos.
      const ehSelect = key === zosI.KEY_SELECT || key === 13 || key === zosI.KEY_HOME
      const ehCima = key === zosI.KEY_UP || key === 38
      const ehBaixo = key === zosI.KEY_DOWN || key === 40
      const ehClique = ev === zosI.KEY_EVENT_CLICK || ev === 1 || ev === zosI.KEY_EVENT_RELEASE
      const cliqueNovo = () => {
        const agora = Date.now()
        if (agora - (this.state.ultimoClique || 0) < CLIQUE_DEDUP_MS) return false
        this.state.ultimoClique = agora
        return true
      }

      // Giro da coroa: com a lista aberta move o cursor; fora dela, o sistema troca de tela.
      if (ehCima || ehBaixo) {
        if (!naLista) return false
        if (ev === zosI.KEY_EVENT_CLICK || ev === 1) {
          const agora = Date.now()
          if (agora - (this.state.ultimoGiro || 0) >= GIRO_DEDUP_MS) {
            this.state.ultimoGiro = agora
            this.moverCursor((ehBaixo ? 1 : -1) * COROA_SENTIDO)
          }
        }
        return true
      }

      if (ehSelect) {
        if (!naLista && !naPrimeiraTela()) return false
        if (ev === zosI.KEY_EVENT_PRESS) {
          this.state.pressaoLonga = false
          return true
        }
        if (ev === zosI.KEY_EVENT_LONG_PRESS) {
          this.state.pressaoLonga = true
          return false // segurar continua sendo do sistema
        }
        if (ehClique) {
          if (this.state.pressaoLonga) return false
          if (cliqueNovo()) {
            if (naLista) this.confirmarCursor()
            else this.abrirLista()
          }
          return true
        }
        return false
      }

      // Botão de baixo (ou voltar) fecha a lista sem trocar
      if (naLista && (key === zosI.KEY_SHORTCUT || key === zosI.KEY_BACK)) {
        if (ehClique && cliqueNovo()) this.fecharLista()
        return true
      }
      return false
    },

    girarCoroa(degree) {
      if (!this.state.listaAberta || !isFinite(degree) || degree === 0) return
      this.state.coroaAcc = (this.state.coroaAcc || 0) - degree * COROA_SENTIDO
      if (Math.abs(this.state.coroaAcc) < COROA_PASSO) return
      const agora = Date.now()
      if (agora - (this.state.coroaUltimo || 0) < COROA_INTERVALO_MS) return
      const dir = this.state.coroaAcc > 0 ? 1 : -1
      this.state.coroaAcc = 0
      this.state.coroaUltimo = agora
      this.moverCursor(dir)
    },

    montarTelas() {
      const lay = layoutTelas(this.state.sistema)
      this.state.Y = lay.Y
      this.state.nTelas = lay.n
      this.state.comDiagrama = temDiagrama(this.state.sistema)
      const Y = lay.Y
      this.swiper()
      const ui = this.state.ui

      // ── Tela 1 · Volume ─────────────────────────────────────────
      let y0 = 0
      createWidget(widget.ARC, {
        x: px(40), y: px(y0 + 40), w: px(400), h: px(400),
        start_angle: ARC_INI, end_angle: ARC_INI + ARC_SPAN,
        color: C.track, line_width: px(22),
      })
      ui.arc = createWidget(widget.ARC, {
        x: px(40), y: px(y0 + 40), w: px(400), h: px(400),
        start_angle: ARC_INI, end_angle: ARC_INI + 1,
        color: C.agua, line_width: px(22),
      })
      // Nome do sistema dentro do arco, logo acima do valor. Toque → lista dos sistemas.
      ui.titulo = text(y0, { x: 90, w: 300, y: 112, h: 36, text: maiusc(nomeSistema(this.state.sistema)), size: 24, color: C.muted })
      ui.tituloTraco = rect(222, 146, 36, 3, C.muted, 2) // affordance: "toque aqui"
      ui.titulo.addEventListener(event.CLICK_UP, () => this.abrirLista())
      ui.vol = text(y0, { y: 150, h: 110, text: '--', size: 96 })
      text(y0, { y: 258, text: t('volumeUtil'), size: 26, color: C.muted })
      ui.varDia = text(y0, { y: 298, text: '', size: 28 })
      ui.hm3 = text(y0, { y: 338, text: '', size: 24, color: C.muted })
      ui.status = text(y0, { y: 410, h: 32, text: t('atualizando'), size: 20, color: C.muted })
      if (DEBUG_BOTOES) ui.dbg = text(y0, { x: 80, w: 320, y: 380, h: 28, text: '', size: 16, color: C.atencao })

      // ── Tela 2 · Chuva ──────────────────────────────────────────
      y0 = Y.chuva
      text(y0, { y: 52, text: t('chuva'), size: 22, color: C.muted })
      ui.chuvaMes = text(y0, { y: 95, h: 90, size: 76 })
      text(y0, { y: 182, text: t('acumMes'), size: 24, color: C.muted })
      rect(80, y0 + 232, 320, 16, C.track, 8)
      ui.chuvaBar = rect(80, y0 + 232, 1, 16, C.chuva, 8)
      ui.chuvaPct = text(y0, { y: 258, size: 22, color: C.muted })
      ui.chuvaDia = text(y0, { y: 298, size: 26 })
      ui.chuvaBars = []
      for (let i = 0; i < 30; i++) ui.chuvaBars.push(rect(90 + i * 10, y0 + 419, 7, 1, C.track))
      text(y0, { y: 424, h: 28, text: t('ult30'), size: 18, color: C.muted })

      // ── Tela 3 · Nível e vazões ─────────────────────────────────
      y0 = Y.nivel
      ui.nivelDe = text(y0, { x: 70, w: 340, y: 52, text: t('nivel'), size: 22, color: C.muted })
      ui.nivel = text(y0, { y: 84, h: 60, size: 48 })
      const linha = (y, label) => {
        text(y0, { x: 70, w: 200, y, text: label, size: 22, color: C.muted, align: align.LEFT })
        return text(y0, { x: 250, w: 160, y, size: 26, align: align.RIGHT })
      }
      ui.qNatural = linha(175, t('qNatural'))
      ui.qCaptada = linha(225, t('qCaptada'))
      ui.qJusante = linha(275, t('qJusante'))
      ui.qProduzida = linha(325, t('qProduzida'))
      text(y0, { y: 372, h: 26, text: t('vazoes'), size: 18, color: C.muted })

      // ── Tela 4 · Por dentro do sistema (só Guarapiranga) ────────
      if (Y.diagrama !== undefined) {
        try {
          // PNG quando o sistema tem fundo (≈200 ms no Balance); senão, desenho em código (≈1,2 s).
          ui.diagrama = montarDiagrama(this.state.sistema, Y.diagrama, C)
        } catch (e) {
          ui.diagrama = null
          this.mostrarErroEm(Y.diagrama, 'diagrama', e)
        }
      }

      // ── Represas ────────────────────────────────────────────────
      y0 = Y.represas
      ui.repTitulo = text(y0, { y: 52, text: t('represas'), size: 22, color: C.muted })
      ui.repRows = []
      for (let i = 0; i < MAX_REPRESAS; i++) {
        const y = 92 + i * 44
        ui.repRows.push({
          nome: text(y0, { x: 70, w: 230, y, h: 40, text: '', size: 22, color: C.muted, align: align.LEFT }),
          val: text(y0, { x: 290, w: 120, y, h: 40, text: '', size: 26, align: align.RIGHT }),
        })
      }

      // ── Tendência 30 dias ───────────────────────────────────────
      {
        y0 = Y.tend
        text(y0, { y: 52, text: t('dias30'), size: 22, color: C.muted })
        ui.delta = text(y0, { y: 88, h: 70, size: 56 })
        text(y0, { y: 155, text: t('pontos'), size: 22, color: C.muted })
        ui.volBars = []
        for (let i = 0; i < 30; i++) ui.volBars.push(rect(90 + i * 10, y0 + 379, 7, 1, C.track))
        ui.iniLbl = text(y0, { x: 80, w: 160, y: 392, h: 30, size: 20, color: C.muted, align: align.LEFT })
        ui.fimLbl = text(y0, { x: 240, w: 160, y: 392, h: 30, size: 20, color: C.muted, align: align.RIGHT })
      }

      // A lista dos sistemas é criada só quando aberta (nada cobre a tela 1 ao iniciar).
    },

    onDestroy() {
      try {
        resetPageBrightTime()
      } catch (e) {}
      chamar(zosI.offKey)
      chamar(zosI.offDigitalCrown)
      chamar(zosI.offGesture)
      const HM = hmAppGlobal()
      try {
        if (HM && HM.unregisterKeyEvent) HM.unregisterKeyEvent()
        if (HM && HM.unregisterSpinEvent) HM.unregisterSpinEvent()
      } catch (e) {}
    },

    // coroaDoSistema = false entrega a coroa ao app (usado com a lista aberta).
    swiper(coroaDoSistema = true) {
      setScrollMode({
        mode: SCROLL_MODE_SWIPER,
        options: {
          height: px(SCREEN),
          count: this.state.nTelas || 5,
          // API 3.0: avisa a troca de página (índice começa em 0). Firmware sem suporte ignora.
          modeParams: {
            crown_enable: coroaDoSistema, // true: a coroa troca de tela (padrão)
            on_page: (i) => {
              paginaOnPage = num(i)
              this.debug()
            },
          },
        },
      })
    },

    // ─── Lista de sistemas ────────────────────────────────────────
    // A camada é criada ao abrir (por último = por cima de tudo) e apagada ao fechar.
    // Nada fica escondido sobre a tela 1 enquanto a lista não está em uso.
    abrirLista() {
      if (this.state.listaAberta) return
      this.state.listaAberta = true
      chamar(() => this.swiper(false)) // tira a coroa do sistema enquanto a lista está aberta
      travarRolagem(true)
      try {
        const L = (this.state.ui.lista = [])
        const linhas = (this.state.ui.listaLinhas = [])
        const add = (w) => (L.push(w), w)
        const todos = this.state.todos || []
        const yLinha = (i) => 72 + i * 44
        this.state.cursor = Math.max(0, SISTEMAS.findIndex((s) => s.id === this.state.sistema))

        const fundo = add(rect(0, 0, SCREEN, SCREEN, C.bg, 0))
        fundo.addEventListener(event.CLICK_UP, () => {}) // bloqueia toques nas telas por baixo
        const tit = add(text(0, { x: 140, w: 200, y: 30, h: 36, text: t('sistemas'), size: 22, color: C.muted }))
        tit.addEventListener(event.CLICK_UP, () => this.fecharLista())

        // 1) áreas de toque de cada linha (pretas) → 2) cursor → 3) marcador e textos.
        // Nessa ordem o cursor fica visível por cima das áreas e por baixo dos textos.
        SISTEMAS.forEach((s, i) => {
          add(rect(72, yLinha(i) + 2, 336, 40, C.bg, 20)).addEventListener(event.CLICK_UP, () => this.selecionar(s.id))
        })
        this.state.ui.cursor = add(rect(72, yLinha(this.state.cursor) + 2, 336, 40, C.track, 20))
        this.state.ui.cursor.addEventListener(event.CLICK_UP, () => this.confirmarCursor())

        SISTEMAS.forEach((s, i) => {
          const y = yLinha(i)
          const t = todos.find((x) => x.id === s.id) || {}
          const escolher = () => this.selecionar(s.id)
          if (s.id === this.state.sistema) add(rect(82, y + 19, 6, 6, C.agua, 3)) // sistema em uso
          const nome = add(text(0, { x: 96, w: 200, y, h: 44, text: nomeSistema(s.id), size: 22, color: C.muted, align: align.LEFT }))
          const val = add(text(0, { x: 290, w: 94, y, h: 44, text: fmt(t.v) + '%', size: 24, color: corVolume(t.v), align: align.RIGHT }))
          ;[nome, val].forEach((w) => w.addEventListener(event.CLICK_UP, escolher))
          linhas.push({ y, nome })
        })
        this.pintarCursor()

        // Giro da coroa só é capturado com a lista aberta (fora dela, a coroa troca de tela).
        this.state.coroaAcc = 0
        // Dois canais (diagnóstico): C = onDigitalCrown (API 2+) · S = hmApp.registerSpinEvent (API 1)
        chamar(zosI.onDigitalCrown, {
          callback: (a, b) => {
            const [, degree] = argsCoroa(a, b)
            this.debug('c', 'C' + Math.round(degree * 10) / 10)
            this.girarCoroa(degree)
          },
        })
        const HM = hmAppGlobal()
        if (HM && typeof HM.registerSpinEvent === 'function') {
          try {
            HM.registerSpinEvent((a, b) => {
              const degree = typeof b === 'number' ? b : num(a)
              this.debug('c', 'S' + Math.round(degree * 10) / 10)
              this.girarCoroa(degree)
            })
          } catch (e) {}
        }
        if (DEBUG_BOTOES) {
          this.state.ui.dbgLista = add(text(0, { x: 110, w: 260, y: 428, h: 24, text: '', size: 15, color: C.muted }))
          this.debug()
        }
        // (deslizar para a direita fecha a lista: gesto registrado em ligarBotoes)
      } catch (e) {
        this.fecharLista()
        this.mostrarErro('lista', e)
      }
    },

    moverCursor(dir) {
      const novo = clamp(this.state.cursor + dir, 0, SISTEMAS.length - 1)
      if (novo === this.state.cursor) return
      this.state.cursor = novo
      this.pintarCursor()
    },

    pintarCursor() {
      const ui = this.state.ui
      const linhas = ui.listaLinhas || []
      const ln = linhas[this.state.cursor]
      if (!ln || !ui.cursor) return
      setRect(ui.cursor, 72, ln.y + 2, 336, 40, C.track, 20)
      linhas.forEach((l, i) => l.nome.setProperty(prop.COLOR, i === this.state.cursor ? C.text : C.muted))
    },

    confirmarCursor() {
      const s = SISTEMAS[this.state.cursor]
      if (s) this.selecionar(s.id)
      else this.fecharLista()
    },

    fecharLista() {
      if (!this.state.listaAberta) return
      this.state.listaAberta = false
      chamar(zosI.offDigitalCrown)
      const HM = hmAppGlobal()
      try {
        if (HM && HM.unregisterSpinEvent) HM.unregisterSpinEvent()
      } catch (e) {}
      const L = this.state.ui.lista || []
      this.state.ui.lista = null
      this.state.ui.listaLinhas = null
      this.state.ui.cursor = null
      this.state.ui.dbgLista = null
      L.forEach(apagar)
      travarRolagem(false)
      this.swiper() // a doc avisa: destravar volta para rolagem livre
    },

    selecionar(id) {
      if (id === this.state.sistema) {
        this.fecharLista()
        return
      }
      this.state.sistema = id
      try {
        localStorage.setItem(K_SISTEMA, String(id))
      } catch (e) {}
      // Saindo de / indo para um sistema com diagrama: muda o número de telas ou o desenho →
      // recarrega a página (o onInit lê o sistema salvo e monta o layout certo).
      if ((temDiagrama(id) || this.state.comDiagrama) && typeof zosRouter.replace === 'function') {
        // Tela de carregamento (3 widgets) por cima da lista; a troca fica para o próximo ciclo
        // (30 ms) para ela chegar a aparecer. A lista não é desmontada: a página toda é trocada.
        this.mostrarCarregando(id)
        const trocar = () => {
          try {
            zosRouter.replace({ url: URL_PAGINA })
          } catch (e) {
            this.esconderCarregando()
            this.fecharLista()
            this.aplicarSistema(id)
          }
        }
        if (typeof setTimeout === 'function') setTimeout(trocar, 30)
        else trocar()
        return
      }
      this.fecharLista()
      this.aplicarSistema(id)
    },

    abrirSobre() {
      if (this.state.listaAberta || this.state.ui.carregando || typeof zosRouter.push !== 'function') return false
      const d = this.state.cache
      try {
        zosRouter.push({ url: URL_SOBRE, params: JSON.stringify({ data: d && d.data ? d.data : '' }) })
        return true
      } catch (e) {
        return false
      }
    },

    sobreAberto() {
      try {
        return localStorage.getItem(K_SOBRE, '0') === '1'
      } catch (e) {
        return false
      }
    },

    mostrarCarregando(id) {
      try {
        const L = (this.state.ui.carregando = [])
        const fundo = rect(0, 0, SCREEN, SCREEN, C.bg, 0)
        fundo.addEventListener(event.CLICK_UP, () => {}) // segura toques durante a troca
        L.push(fundo)
        L.push(text(0, { y: 196, h: 44, text: maiusc(nomeSistema(id)), size: 28, color: C.text }))
        L.push(text(0, { y: 244, h: 32, text: t('carregando'), size: 20, color: C.muted }))
      } catch (e) {}
    },

    esconderCarregando() {
      ;(this.state.ui.carregando || []).forEach(apagar)
      this.state.ui.carregando = null
    },

    aplicarSistema(id) {
      const ui = this.state.ui
      try {
        ui.titulo.setProperty(prop.TEXT, maiusc(nomeSistema(id)))
        this.state.cache = lerJSON(K_CACHE(id))
        if (this.state.cache) this.render(this.state.cache, t('salvo'))
        else this.limpar()
      } catch (e) {
        this.mostrarErro('trocar sistema', e)
      }
      this.atualizar()
    },

    limpar() {
      const ui = this.state.ui
      ui.vol.setProperty(prop.TEXT, '--')
      ui.varDia.setProperty(prop.TEXT, '')
      ui.hm3.setProperty(prop.TEXT, '')
      ui.status.setProperty(prop.TEXT, t('atualizando'))
      ui.arc.setProperty(prop.MORE, {
        x: px(40), y: px(40), w: px(400), h: px(400),
        start_angle: ARC_INI, end_angle: ARC_INI + 1, color: C.muted, line_width: px(22),
      })
    },

    // ─── Dados ────────────────────────────────────────────────────
    atualizar() {
      const pedido = this.state.sistema
      this.request({ method: 'guara.get', params: { sistema: pedido } })
        .then((r) => {
          if (!r || !r.ok) throw new Error((r && r.error) || t('semDados'))
          const p = r.payload
          const id = p.sistema || pedido
          gravarJSON(K_CACHE(id), p)
          if (p.todos) {
            this.state.todos = p.todos
            gravarJSON(K_TODOS, p.todos)
          }
          gravarPonte(p)
          if (id !== this.state.sistema) return // usuário trocou de sistema no meio da busca
          this.state.cache = p
          try {
            this.render(p, r.stale ? t('offline') : p.parcial ? t('parcial') : '')
          } catch (e) {
            this.mostrarErro('render', e)
          }
        })
        .catch((e) => {
          this.error('request:', e)
          if (pedido !== this.state.sistema) return
          const ui = this.state.ui
          const c = this.state.cache
          const bruto = String((e && e.message) || e || '')
          const msg = /network|timeout|lenta|HTTP|inválida|SQL/i.test(bruto) ? t('indisponivel') : bruto.slice(0, 28)
          if (ui.status) ui.status.setProperty(prop.TEXT, (c ? t('semConexao') + ' · ' + ddmm(c.data) : t('semConexao')) + (msg ? ' · ' + msg : ''))
        })
    },

    render(d, origem) {
      const ui = this.state.ui
      if (!d || !ui.vol) return

      // Tela 1
      const cor = corVolume(d.vol)
      const prog = clamp(d.vol ?? 0, 0, 100)
      ui.arc.setProperty(prop.MORE, {
        x: px(40), y: px(40), w: px(400), h: px(400),
        start_angle: ARC_INI, end_angle: ARC_INI + Math.max(1, (ARC_SPAN * prog) / 100),
        color: cor, line_width: px(22),
      })
      ui.vol.setProperty(prop.TEXT, fmt(d.vol) + '%')
      ui.varDia.setProperty(prop.TEXT, sinal(d.varDia) + t('noDia'))
      ui.varDia.setProperty(prop.COLOR, d.varDia > 0 ? C.sobe : d.varDia < 0 ? C.desce : C.muted)
      ui.hm3.setProperty(prop.TEXT, fmt(d.hm3, 2) + ' hm³')
      ui.status.setProperty(prop.TEXT, 'Sabesp · ' + ddmm(d.data) + (origem ? ' · ' + origem : ''))

      // Tela 2 — o Integrado RMSP não tem chuva na API
      const Y = this.state.Y || layoutTelas(d.sistema).Y
      const y2 = Y.chuva
      const temChuva = d.chuvaHist !== null && d.chuvaHist !== undefined
      ui.chuvaMes.setProperty(prop.TEXT, temChuva ? fmt(d.chuvaMes) + ' mm' : '--')
      const pctMes = temChuva && d.chuvaHist ? (d.chuvaMes / d.chuvaHist) * 100 : 0
      setRect(ui.chuvaBar, 80, y2 + 232, Math.max(1, (320 * clamp(pctMes, 0, 100)) / 100), 16, C.chuva, 8)
      ui.chuvaPct.setProperty(prop.TEXT, temChuva ? fmt(pctMes) + t('daMedia') + ' (' + fmt(d.chuvaHist, 0) + ' mm)' : t('semChuva'))
      ui.chuvaDia.setProperty(prop.TEXT, temChuva ? t('hoje') + ' ' + fmt(d.chuvaDia) + ' mm' : t('nesteSistema'))
      this.barras(ui.chuvaBars, d.histChuva || [], y2 + 420, 60, 0, null, C.chuva)

      // Tela 3
      ui.nivelDe.setProperty(prop.TEXT, d.nivelDe && d.nivel !== null ? t('nivel') + ' · ' + maiusc(d.nivelDe) : t('nivel'))
      ui.nivel.setProperty(prop.TEXT, d.nivel === null || d.nivel === undefined ? '--' : fmt(d.nivel, 2) + ' m')
      ui.qNatural.setProperty(prop.TEXT, fmt(d.qNatural, 2))
      ui.qCaptada.setProperty(prop.TEXT, fmt(d.qCaptada, 2))
      ui.qJusante.setProperty(prop.TEXT, fmt(d.qJusante, 2))
      ui.qProduzida.setProperty(prop.TEXT, fmt(d.qProduzida, 2))

      // Por dentro do sistema: nível dos 3 reservatórios
      if (ui.diagrama && d.sistema === ui.diagrama.sistema) {
        try {
          pintarTanques(ui.diagrama, d.represas, C, (w, t) => w.setProperty(prop.TEXT, t))
        } catch (e) {}
      }

      // Represas
      const reps = d.represas || []
      ui.repTitulo.setProperty(prop.TEXT, d.sistema === 75 ? t('sistemas') : t('represas'))
      ui.repRows.forEach((row, i) => {
        const rp = reps[i]
        row.nome.setProperty(prop.TEXT, rp ? rp.n : '')
        row.val.setProperty(prop.TEXT, rp ? fmt(rp.v) + '%' : '')
        row.val.setProperty(prop.COLOR, rp ? corVolume(rp.v) : C.text)
      })

      // 30 dias
      const h = (d.histVol || []).filter((v) => v !== null)
      if (h.length > 1) {
        const delta = h[h.length - 1] - h[0]
        ui.delta.setProperty(prop.TEXT, sinal(delta))
        ui.delta.setProperty(prop.COLOR, delta > 0 ? C.sobe : delta < 0 ? C.desce : C.text)
        const lo = Math.floor(Math.min(...h) - 2)
        const hi = Math.ceil(Math.max(...h) + 1)
        this.barras(ui.volBars, d.histVol, Y.tend + 380, 170, lo, hi, null)
        ui.iniLbl.setProperty(prop.TEXT, ddmm(d.histIni) + ' ' + fmt(h[0]) + '%')
        ui.fimLbl.setProperty(prop.TEXT, ddmm(d.data) + ' ' + fmt(h[h.length - 1]) + '%')
      } else {
        ui.delta.setProperty(prop.TEXT, '--')
        ui.delta.setProperty(prop.COLOR, C.text)
        this.barras(ui.volBars, [], Y.tend + 380, 170, 0, 100, null)
        ui.iniLbl.setProperty(prop.TEXT, '')
        ui.fimLbl.setProperty(prop.TEXT, '')
      }
    },

    // Mini gráfico de barras alinhado à direita (o último dia fica na ponta).
    barras(lista, valores, base, altMax, lo, hi, corFixa) {
      const n = lista.length
      const vals = valores.slice(-n)
      const max = hi ?? Math.max(10, ...vals.map((v) => v || 0))
      const off = n - vals.length
      for (let i = 0; i < n; i++) {
        const v = i >= off ? vals[i - off] : null
        const x = 90 + i * 10
        if (v === null || v === undefined) {
          setRect(lista[i], x, base - 1, 7, 1, C.track)
          continue
        }
        const t = clamp((v - lo) / (max - lo), 0, 1)
        const hgt = Math.max(2, Math.round(t * altMax))
        const cor = corFixa ?? (i === n - 1 ? C.text : corVolume(v))
        setRect(lista[i], x, base - hgt, 7, hgt, cor, 2)
      }
    },
  }),
)
