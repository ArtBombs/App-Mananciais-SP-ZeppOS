"""Gera assets/common.w480-r/image/sobre_en.png a partir da arte da ArtBombs (sobre.png):
apaga os textos em português e escreve a versão em inglês com Source Sans 3 (parente aberto da
Myriad, calibrada pela largura dos textos originais). Uso: python3 tools/sobre_en.py <pasta-das-fontes>"""
import sys
from PIL import Image, ImageDraw, ImageFont

FONTES = sys.argv[1]
SRC = 'assets/common.w480-r/image/sobre.png'
DST = 'assets/common.w480-r/image/sobre_en.png'
F = lambda wt, s: ImageFont.truetype(f'{FONTES}/source-sans-3-latin-{wt}-normal.woff', s)

PRETO, FAIXA = (0, 0, 0, 255), (10, 28, 34, 255)
BRANCO, AZUL = (255, 255, 255, 255), (17, 184, 226, 255)

S = 4  # desenha em 4× e reduz (antialias igual ao do Illustrator)
base = Image.open(SRC).convert('RGBA')
big = base.resize((480 * S, 480 * S), Image.NEAREST)
d = ImageDraw.Draw(big)
R = lambda x0, y0, x1, y1, c: d.rectangle((x0 * S, y0 * S, x1 * S, y1 * S), fill=c)

# 1) apaga os textos em português (só o retângulo de cada texto; logo, QR e pílula ficam)
R(176, 76, 420, 146, PRETO)      # título
R(14, 202, 466, 255, FAIXA)      # faixa: 2 linhas
R(142, 347, 271, 369, PRETO)     # "Apoie o projeto:"

def texto(partes, y_base, size, wt, x0=None, cx=None):
    """partes = [(txt, cor)]; y_base = linha de base (px na arte 480)."""
    f = F(wt, size * S)
    total = sum(f.getlength(t) for t, _ in partes)
    x = (cx * S - total / 2) if cx is not None else x0 * S
    for t, c in partes:
        d.text((x, y_base * S), t, font=f, fill=c, anchor='ls')
        x += f.getlength(t)

# 2) inglês — mesmas linhas de base e tamanhos do original
texto([('Reservoirs of', BRANCO)], 110, 34.2, 400, x0=188)
texto([('São Paulo State', BRANCO)], 135, 24.5, 400, x0=187)
texto([('Free, independent app, not affiliated with Sabesp.', BRANCO)], 218, 18.1, 400, cx=240)
texto([('Public data from ', BRANCO), ("Sabesp's Portal dos Mananciais.", AZUL)], 245, 18.1, 400, cx=240)
texto([('Support us:', BRANCO)], 362, 17.8, 400, x0=148)

out = big.resize((480, 480), Image.LANCZOS)
out.putalpha(base.getchannel('A'))  # mesma máscara redonda da arte
out.save(DST)
print('ok', DST)
