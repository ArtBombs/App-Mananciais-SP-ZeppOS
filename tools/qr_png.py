"""Gera o QR de apoio da tela Sobre como imagem (o widget QRCODE do Balance desenha o código
menor que o pedido e preso no canto de cima). Estilo da arte da ArtBombs: quadro branco 320×320
com cantos arredondados (r 28), módulos pretos centralizados, cantos de fora transparentes.
  python3 tools/qr_png.py https://livepix.gg/artbombs assets/common.w480-r/image/qr_apoio.png"""
import sys
import qrcode
from PIL import Image, ImageDraw

conteudo, saida = sys.argv[1], sys.argv[2]
LADO, RAIO, AREA = 320, 28, 250  # quadro, canto, espaço máximo do código
qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=0)
qr.add_data(conteudo)
qr.make(fit=True)
m = qr.get_matrix()
n = len(m)
mod = AREA // n  # módulo inteiro: bordas nítidas
cod = mod * n
x0 = y0 = (LADO - cod) // 2
im = Image.new('RGBA', (LADO, LADO), (0, 0, 0, 0))
g = ImageDraw.Draw(im)
g.rounded_rectangle([0, 0, LADO - 1, LADO - 1], RAIO, fill=(255, 255, 255, 255))
for i, linha in enumerate(m):
    for j, escuro in enumerate(linha):
        if escuro:
            g.rectangle([x0 + j * mod, y0 + i * mod, x0 + (j + 1) * mod - 1, y0 + (i + 1) * mod - 1], fill=(0, 0, 0, 255))
im.save(saida, optimize=True)
print(saida, f'versão {qr.version}, {n}×{n} módulos de {mod}px, código {cod}px, margem {x0}px')
