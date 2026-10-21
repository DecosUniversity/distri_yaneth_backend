"""Cronograma de instalacion (3 dias) con la misma estructura que la exportacion de GanttProject.
Uso: python gantt_instalacion.py <OUT_PNG>"""
import sys
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]
K = 2  # escala (la imagen original es de 790x174)
W, H = 790 * K, 174 * K
img = Image.new('RGB', (W, H), 'white')
d = ImageDraw.Draw(img)
font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 11 * K)
font_b = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 12 * K)
font_title = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 13 * K)

GRID, HEADER, BAR, BAR_EDGE, ZEBRA = (210, 210, 210), (240, 240, 240), (140, 182, 206), (70, 110, 140), (241, 241, 228)
TASKS = [('Día 1 - Preparación del servidor', '21/10/26', 0),
         ('Día 2 - Migración y configuración', '22/10/26', 1),
         ('Día 3 - Configuración inicial de datos y pruebas', '23/10/26', 2)]
DAYS = [19, 20, 21, 22, 23, 24, 25]  # lun 19 - dom 25 de octubre de 2026
X_NAME, X_START, X_END, X_CHART = 0, 400 * K, 490 * K, 580 * K
ROW_H, Y_HEAD, Y_BANNER = 20 * K, 94 * K, 46 * K
DAY_W = (W - X_CHART) // len(DAYS)


def s(v):
    return v * K


# banda superior (en lugar del logotipo de GanttProject)
d.rectangle([s(35), Y_BANNER, X_CHART, Y_HEAD], fill=(95, 150, 150))
d.text((s(50), Y_BANNER + s(13)), 'Cronograma de instalación – Distribuidora Yaneth', font=font_title, fill='white')
# cabecera del calendario
d.text((X_CHART + s(4), Y_BANNER + s(8)), 'octubre 2026', font=font_title, fill='black')
d.line([X_CHART, Y_BANNER + s(32), W, Y_BANNER + s(32)], fill=GRID)
for i, day in enumerate(DAYS):
    x = X_CHART + i * DAY_W
    if day in (24, 25):  # fin de semana
        d.rectangle([x, Y_HEAD, x + DAY_W, H], fill=(246, 246, 246))
    d.text((x + s(3), Y_BANNER + s(34)), str(day), font=font, fill='black')
    d.line([x, Y_BANNER + s(32), x, H], fill=GRID)
# cabecera de la tabla
d.rectangle([0, Y_HEAD, X_CHART, Y_HEAD + ROW_H], fill=HEADER)
for x, label in ((X_NAME, 'Nombre'), (X_START, 'Fecha de inicio'), (X_END, 'Fecha de fin')):
    width = (X_START if x == X_NAME else (X_END if x == X_START else X_CHART)) - x
    tw = d.textlength(label, font=font)
    d.text((x + (width - tw) / 2, Y_HEAD + s(3)), label, font=font, fill='black')
for x in (X_START, X_END, X_CHART):
    d.line([x, Y_HEAD, x, H], fill=GRID)
d.line([0, Y_HEAD + ROW_H, W, Y_HEAD + ROW_H], fill=GRID)

bars = []
for r, (name, date, offset) in enumerate(TASKS):
    y = Y_HEAD + ROW_H * (r + 1)
    if r % 2 == 1:
        d.rectangle([0, y, X_CHART - 1, y + ROW_H], fill=ZEBRA)
    d.ellipse([s(25), y + s(8), s(31), y + s(14)], fill=(150, 150, 150))
    d.text((s(40), y + s(3)), name, font=font, fill='black')
    d.text((X_START + s(8), y + s(3)), date, font=font, fill='black')
    d.text((X_END + s(8), y + s(3)), date, font=font, fill='black')
    d.line([0, y + ROW_H, W, y + ROW_H], fill=(232, 232, 232))
    x0 = X_CHART + DAYS.index(21 + offset) * DAY_W + s(2)
    box = [x0, y + s(4), x0 + DAY_W - s(4), y + ROW_H - s(4)]
    d.rectangle(box, fill=BAR, outline=BAR_EDGE, width=K)
    bars.append(box)
# dependencias fin -> inicio
for a, b in zip(bars, bars[1:]):
    xm = a[2] - s(6)
    d.line([xm, a[3], xm, b[1] + s(1)], fill='black', width=K)
    d.polygon([(xm - s(3), b[1] - s(4)), (xm + s(3), b[1] - s(4)), (xm, b[1] + s(1))], fill='black')

img.save(OUT, dpi=(96 * K, 96 * K))
print('ok', img.size)
