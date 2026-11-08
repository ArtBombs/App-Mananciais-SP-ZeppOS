"""Pinta de preto, dentro da caixa de cada reservatório, a área FORA da forma (canto de baixo à
direita arredondado). Assim o app desenha o nível com FILL_RECT simples, sem canvas, e o PNG
por cima recorta o canto.
  node tools/esquema-svg.mjs 65 --tanques > /tmp/t.json
  python3 tools/mascara_png.py assets/common.w480-r/image/diagrama_65.png /tmp/t.json
Idempotente: só acrescenta preto por baixo do que já existe."""
import json, sys
import numpy as np
from PIL import Image

png, tq = sys.argv[1], json.load(open(sys.argv[2]))
im = Image.open(png).convert('RGBA')
a = np.array(im).astype(float) / 255
SS = 4
for t in tq:
    x1, y1, x2, y2, r = t['x1'], t['y1'], t['x2'], t['y2'], t['r']
    for y in range(int(y1), int(np.ceil(y2))):
        for x in range(int(x1), int(np.ceil(x2))):
            dentro = 0
            for sy in range(SS):
                for sx in range(SS):
                    px, py = x + (sx + .5) / SS, y + (sy + .5) / SS
                    ok = x1 <= px <= x2 and y1 <= py <= y2
                    if ok and px > x2 - r and py > y2 - r:
                        ok = (px - (x2 - r)) ** 2 + (py - (y2 - r)) ** 2 <= r * r
                    dentro += ok
            fora = 1 - dentro / SS / SS
            if fora <= 0:
                continue
            # composição: pixel existente POR CIMA do preto com alpha = fora
            sa = a[y, x, 3]
            oa = sa + fora * (1 - sa)
            if oa > 0:
                a[y, x, :3] = (a[y, x, :3] * sa) / oa  # preto não soma cor
                a[y, x, 3] = oa
Image.fromarray((a * 255).round().astype('uint8'), 'RGBA').save(png, optimize=True)
print(png, 'ok,', len(tq), 'reservatórios')
