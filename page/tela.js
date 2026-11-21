// Formato da tela (v1.6.0): redonda 480 (Balance…) ou quadrada 390×450 (Bip 6, GTS 4, Active 2 quadrado…).
// O layout é desenhado uma vez, em 480×480 por tela. No quadrado, px() já reduz tudo pela
// designWidth (480 → 390, ×0,8125), então cada tela vira um quadrado de 390×390 centralizado na
// altura de 450: sobram 30 px em cima e 30 embaixo. As imagens de assets/common.w390-s são as mesmas
// de 480×480: o zeus as reduz pelo mesmo fator. Só a posição vertical precisa de conta, porque a
// página do swiper no quadrado tem 450 px, e não 390.
import * as zosDevice from '@zos/device'
import { px } from '@zos/utils'

const DEV = (() => {
  try {
    const i = typeof zosDevice.getDeviceInfo === 'function' ? zosDevice.getDeviceInfo() : null
    if (i && i.width && i.height) return { w: i.width, h: i.height }
  } catch (e) {}
  return { w: 480, h: 480 }
})()

export const QUAD = DEV.w !== DEV.h
export const DESENHO = 480 // lado da tela no desenho (designWidth)
export const LARG = QUAD ? DEV.w : px(DESENHO) // largura real
export const ALT = QUAD ? DEV.h : px(DESENHO) // altura real de uma tela (página do swiper)
const OY = QUAD ? Math.round((DEV.h - px(DESENHO)) / 2) : 0 // 30 no Bip 6

// y do desenho (telas empilhadas de 480 em 480) → y real.
export function Y(y) {
  if (!QUAD || y < 0) return px(y)
  const p = Math.floor(y / DESENHO)
  return p * ALT + OY + px(y - p * DESENHO)
}

// Retângulo que cobre a tela inteira (fundo de camada): no quadrado vai de ponta a ponta, sem as faixas.
export function telaCheia(y) {
  const p = Math.floor(Math.max(0, y) / DESENHO)
  return { x: 0, y: QUAD ? p * ALT : px(p * DESENHO), w: LARG, h: ALT }
}
