"""Renderiza as telas do app (widgets gravados pelo harness) em PNG 480×480 com o fundo
redondo, para as imagens da loja. Fonte Inter no lugar da fonte do sistema (aproximação).
  DUMPPAGINA=pagina.json node test/harness.mjs
  python3 tools/capturas.py pagina.json pasta_saida [sobre.json]"""
import json, sys, os
from PIL import Image, ImageDraw, ImageFont

S = 3  # supersampling
RAIZ = os.path.join(os.path.dirname(__file__), '..', 'assets', 'common.w480-r')
FONTES = ['/usr/share/fonts/opentype/inter/Inter-Regular.otf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']
FONTE = next(f for f in FONTES if os.path.exists(f))
cor = lambda c: '#%06x' % (c & 0xFFFFFF)
_fc = {}
def fonte(px):
    k = round(px * S * 0.94)
    if k not in _fc: _fc[k] = ImageFont.truetype(FONTE, k)
    return _fc[k]

def tela(widgets, y0):
    im = Image.new('RGBA', (480 * S, 480 * S), (0, 0, 0, 255))
    g = ImageDraw.Draw(im)
    for w in widgets:
        if not (y0 <= w.get('y', 0) < y0 + 480): continue
        x, y = w.get('x', 0) * S, (w['y'] - y0) * S
        t = w['type']
        if t == 'FILL_RECT':
            ww, hh = w['w'] * S, w['h'] * S
            r = min(w.get('radius', 0) * S, ww / 2, hh / 2)
            g.rounded_rectangle([x, y, x + ww - 1, y + hh - 1], r, fill=cor(w['color']))
        elif t == 'ARC':
            lw = w['line_width'] * S
            a0, a1 = w['start_angle'], w['end_angle']
            if a1 - a0 < 1: continue
            box = [x + lw / 2, y + lw / 2, x + w['w'] * S - lw / 2, y + w['h'] * S - lw / 2]
            g.arc([box[0] - lw / 2, box[1] - lw / 2, box[2] + lw / 2, box[3] + lw / 2], a0, a1, fill=cor(w['color']), width=int(lw))
            # pontas arredondadas, como no relógio
            import math
            cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
            rr = (box[2] - box[0]) / 2
            for a in (a0, a1):
                px_, py_ = cx + rr * math.cos(math.radians(a)), cy + rr * math.sin(math.radians(a))
                g.ellipse([px_ - lw / 2, py_ - lw / 2, px_ + lw / 2, py_ + lw / 2], fill=cor(w['color']))
        elif t == 'IMG':
            p = Image.open(os.path.join(RAIZ, w['src'])).convert('RGBA')
            p = p.resize((p.width * S, p.height * S), Image.LANCZOS)
            im.alpha_composite(p, (int(x), int(y)))
        elif t == 'TEXT' and w.get('text'):
            f = fonte(w['text_size'])
            ww, hh = w['w'] * S, w['h'] * S
            al = w.get('align_h', 'c')
            ax = {'l': x, 'r': x + ww}.get(al, x + ww / 2)
            anchor = {'l': 'lm', 'r': 'rm'}.get(al, 'mm')
            g.text((ax, y + hh / 2), str(w['text']), font=f, fill=cor(w['color']), anchor=anchor)
    im = im.resize((480, 480), Image.LANCZOS)
    m = Image.new('L', (480 * S, 480 * S), 0)
    ImageDraw.Draw(m).ellipse([0, 0, 480 * S - 1, 480 * S - 1], fill=255)
    out = Image.new('RGBA', (480, 480), (0, 0, 0, 0))
    out.paste(im, mask=m.resize((480, 480), Image.LANCZOS))
    return out

pagina, saida = sys.argv[1], sys.argv[2]
os.makedirs(saida, exist_ok=True)
d = json.load(open(pagina))
nomes = ['1_volume', '2_chuva', '3_nivel_vazoes', '4_por_dentro', '5_represas', '6_tendencia']
for k in range(d['n']):
    tela(d['widgets'], k * 480).save(os.path.join(saida, nomes[k] + '.png'))
if d.get('lista'):
    tela(d['lista'], 0).save(os.path.join(saida, '0_lista_sistemas.png'))
if len(sys.argv) > 3:
    s = json.load(open(sys.argv[3]))
    ws = [dict(type='IMG', **w) for w in s['imgs']] + [dict(type='TEXT', **w) for w in s['textos']]
    tela(ws, 1440).save(os.path.join(saida, '7_sobre.png'))
print('ok', saida)
