// Tela "Sobre" — arte da ArtBombs (assets/common.w480-r/image/sobre.png) + versão e data dinâmicas.
// Entra deslizando para a esquerda na página principal; volta deslizando para a direita (padrão do sistema).
// Toque em "Apoie o projeto / ArtBombs" abre o QR em tela cheia; toque em qualquer lugar volta.
import { createWidget, widget, align, text_style, event } from '@zos/ui'
import * as zosUi from '@zos/ui'
import * as zosApp from '@zos/app'
import { localStorage } from '@zos/storage'
import { setPageBrightTime } from '@zos/display'
import { px } from '@zos/utils'
import { EN, t, dataCurta } from '../i18n'

const C = { bg: 0x000000, branco: 0xffffff, agua: 0x2ec4d6 }
const VERSAO_RESERVA = '1.5.0' // se getPackageInfo não existir no firmware
// Apoio (LivePix): https://livepix.gg/artbombs — para trocar o link, regerar a imagem:
//   python3 tools/qr_png.py <link> assets/common.w480-r/image/qr_apoio.png
// Avisa a página principal que o Sobre está por cima (para a coroa não abrir a lista escondida).
const K_SOBRE = 'mananciais_sobre_aberto' // mesma chave em page/index

function versao() {
  try {
    const info = typeof zosApp.getPackageInfo === 'function' ? zosApp.getPackageInfo() : null
    if (info && info.version && info.version.name) return info.version.name
  } catch (e) {}
  return VERSAO_RESERVA
}


function texto(o) {
  return createWidget(widget.TEXT, {
    x: px(o.x), y: px(o.y), w: px(o.w), h: px(o.h),
    text: o.text, text_size: px(o.size), color: o.color,
    align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.NONE,
  })
}

// Área de toque invisível (TEXT vazio é transparente e aceita eventos).
function area(x, y, w, h, fn) {
  const a = createWidget(widget.TEXT, { x: px(x), y: px(y), w: px(w), h: px(h), text: '' })
  a.addEventListener(event.CLICK_UP, fn)
  return a
}

function apagar(w) {
  try {
    if (w && typeof zosUi.deleteWidget === 'function') zosUi.deleteWidget(w)
  } catch (e) {}
}

Page({
  state: { params: {}, qr: null },

  onInit(params) {
    try {
      this.state.params = typeof params === 'string' && params ? JSON.parse(params) : params || {}
    } catch (e) {
      this.state.params = {}
    }
    try {
      localStorage.setItem(K_SOBRE, '1')
    } catch (e) {}
    try {
      setPageBrightTime({ brightTime: 30000 })
    } catch (e) {}
  },

  build() {
    createWidget(widget.IMG, { x: 0, y: 0, w: px(480), h: px(480), src: EN ? 'image/sobre_en.png' : 'image/sobre.png' }) // inglês: tools/sobre_en.py
    // Posições medidas na arte (08/11): data na faixa azul-petróleo; versão na pílula do apoio.
    texto({ x: 40, y: 281, w: 400, h: 38, text: t('dadosDe') + dataCurta(this.state.params.data) + t('atualiza9h'), size: 20, color: C.branco })
    texto({ x: 158, y: 372, w: 120, h: 32, text: 'v' + versao(), size: 18, color: C.agua })
    // "Apoie o projeto" + pílula da versão + mini QR + "Made by ArtBomb's"
    area(132, 340, 216, 116, () => this.abrirQR())
  },

  abrirQR() {
    if (this.state.qr) return
    const L = []
    L.push(createWidget(widget.FILL_RECT, { x: 0, y: 0, w: px(480), h: px(480), color: C.bg }))
    // QR em imagem (tools/qr_png.py): o widget QRCODE do Balance desenha o código menor que o
    // pedido e preso no canto de cima (v1.3.6). Quadro branco 320×320 centralizado.
    L.push(createWidget(widget.IMG, { x: px(80), y: px(80), w: px(320), h: px(320), src: 'image/qr_apoio.png' }))
    // Toque em qualquer lugar fecha (camada transparente por cima de tudo).
    L.push(area(0, 0, 480, 480, () => this.fecharQR()))
    this.state.qr = L
  },

  fecharQR() {
    ;(this.state.qr || []).forEach(apagar)
    this.state.qr = null
  },

  onDestroy() {
    try {
      localStorage.setItem(K_SOBRE, '0')
    } catch (e) {}
  },
})
