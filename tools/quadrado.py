"""Monta assets/common.w390-s (relógios quadrados 390×450: Bip 6, GTS 4, Active 2 quadrado…)
a partir de assets/common.w480-r.
  python3 tools/quadrado.py
- Diagramas, QR e ícone: cópia direta. O zeus reduz as imagens pela designWidth (480 → 390, ×0,8125),
  igual ao px() do código, então o PNG de 480×480 chega ao relógio em 390×390.
- Sobre (sobre.png / sobre_en.png): arte própria em 480×554 (→ 390×450): a arte redonda fica no meio,
  37 px abaixo do topo (= 30 px reais, a mesma folga que page/tela.js usa), e as duas faixas
  (texto e data) vão de ponta a ponta da tela em vez de terminarem no círculo."""
import os, shutil
from PIL import Image, ImageDraw

R, Q = 'assets/common.w480-r/', 'assets/common.w390-s/'
W, H = 480, round(450 * 480 / 390)  # 480×554
OY = round(30 * 480 / 390)  # 37
FAIXAS = [(182, 278, (10, 28, 34, 255)), (278, 325, (14, 64, 73, 255))]  # y na arte redonda, cor


def sobre(nome):
    a = Image.open(R + nome).convert('RGBA')
    out = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    g = ImageDraw.Draw(out)
    for y0, y1, c in FAIXAS:
        g.rectangle([0, OY + y0, W - 1, OY + y1 - 1], fill=c)
    out.alpha_composite(a, (0, OY))
    out.save(Q + nome)


if __name__ == '__main__':
    os.makedirs(Q + 'image', exist_ok=True)
    shutil.copy(R + 'icon.png', Q + 'icon.png')
    for f in sorted(os.listdir(R + 'image')):
        if f.startswith('sobre'):
            sobre('image/' + f)
        else:
            shutil.copy(R + 'image/' + f, Q + 'image/' + f)
    print('ok', sorted(os.listdir(Q + 'image')))
