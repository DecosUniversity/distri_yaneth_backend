"""Cronograma del proyecto (Ilustracion 13) con la misma estructura que la exportacion de GanttProject.
Refleja lo ejecutado: cinco iteraciones, operacion en paralelo por modulo, aseguramiento de la calidad
e instalacion. Uso: python gantt_proyecto.py <OUT_PNG>"""
import sys
from datetime import date, timedelta
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]
K = 2
D = date

# (nombre, inicio, fin, es_grupo)
TASKS = [
    ('Iteración 1 - Seguridad y gestión de usuarios', D(2026, 3, 2), D(2026, 4, 24), True),
    ('1. Modelado de negocio', D(2026, 3, 2), D(2026, 3, 13), False),
    ('2. Requerimientos', D(2026, 3, 16), D(2026, 3, 27), False),
    ('3. Análisis y diseño', D(2026, 3, 30), D(2026, 4, 10), False),
    ('4. Implementación', D(2026, 4, 13), D(2026, 4, 24), False),
    ('Iteración 2 - Entrada de materia prima y calidad', D(2026, 4, 27), D(2026, 6, 19), True),
    ('1. Requerimientos', D(2026, 4, 27), D(2026, 5, 8), False),
    ('2. Análisis y diseño', D(2026, 5, 11), D(2026, 5, 22), False),
    ('3. Implementación', D(2026, 5, 25), D(2026, 6, 5), False),
    ('4. Pruebas', D(2026, 6, 8), D(2026, 6, 19), False),
    ('Iteración 3 - Producción', D(2026, 6, 22), D(2026, 7, 31), True),
    ('1. Análisis y diseño', D(2026, 6, 22), D(2026, 7, 3), False),
    ('2. Implementación', D(2026, 7, 6), D(2026, 7, 14), False),
    ('3. Pruebas', D(2026, 7, 15), D(2026, 7, 21), False),
    ('4. Despliegue en entorno provisional', D(2026, 7, 22), D(2026, 7, 31), False),
    ('Iteración 4 - Logística y distribución', D(2026, 8, 3), D(2026, 9, 4), True),
    ('1. Análisis y diseño', D(2026, 8, 3), D(2026, 8, 11), False),
    ('2. Implementación', D(2026, 8, 12), D(2026, 8, 25), False),
    ('3. Implementación', D(2026, 8, 26), D(2026, 9, 1), False),
    ('4. Pruebas', D(2026, 9, 2), D(2026, 9, 4), False),
    ('Iteración 5 - Reportería y dashboard', D(2026, 9, 7), D(2026, 10, 9), True),
    ('1. Implementación', D(2026, 9, 7), D(2026, 9, 18), False),
    ('2. Despliegue en entorno provisional', D(2026, 9, 21), D(2026, 9, 25), False),
    ('3. Ajustes por retroalimentación', D(2026, 9, 28), D(2026, 10, 9), False),
    ('Operación en paralelo (manual y sistema)', D(2026, 8, 17), D(2026, 10, 9), True),
    ('Recepción y maduración', D(2026, 8, 17), D(2026, 8, 28), False),
    ('Producción', D(2026, 8, 31), D(2026, 9, 18), False),
    ('Logística y distribución', D(2026, 9, 21), D(2026, 10, 2), False),
    ('Reportería (cierre de septiembre)', D(2026, 10, 5), D(2026, 10, 9), False),
    ('Aseguramiento de la calidad', D(2026, 10, 12), D(2026, 10, 20), True),
    ('1. Diseño y ejecución de casos de prueba', D(2026, 10, 12), D(2026, 10, 16), False),
    ('2. Corrección de defectos y regresión', D(2026, 10, 19), D(2026, 10, 20), False),
    ('Instalación en el servidor de la empresa', D(2026, 10, 21), D(2026, 10, 23), True),
]
START, END = D(2026, 3, 1), D(2026, 11, 1)
MONTHS = ['marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre']

X_START, X_END, X_CHART = 300 * K, 375 * K, 450 * K
DAY_W = 2.4 * K
W = int(X_CHART + (END - START).days * DAY_W)
ROW_H, Y_BANNER, Y_HEAD = 20 * K, 6 * K, 54 * K
H = Y_HEAD + ROW_H * (len(TASKS) + 1)

img = Image.new('RGB', (W, H), 'white')
d = ImageDraw.Draw(img)
font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 11 * K)
font_b = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 11 * K)
font_title = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 13 * K)
GRID, HEADER, BAR, BAR_EDGE, ZEBRA, SUMMARY = (210, 210, 210), (240, 240, 240), (140, 182, 206), (70, 110, 140), (241, 241, 228), (120, 160, 185)


def s(v):
    return int(v * K)


def xd(day):
    return X_CHART + (day - START).days * DAY_W


# banda superior y cabecera de meses
d.rectangle([s(10), Y_BANNER, X_CHART, Y_HEAD - s(4)], fill=(95, 150, 150))
d.text((s(22), Y_BANNER + s(12)), 'Cronograma del proyecto – Distribuidora Yaneth', font=font_title, fill='white')
d.text((X_CHART + s(4), Y_BANNER), '2026', font=font_title, fill='black')
for i, m in enumerate(MONTHS):
    first = D(2026, 3 + i, 1)
    x = xd(first)
    d.line([x, Y_BANNER + s(22), x, H], fill=GRID)
    d.text((x + s(3), Y_BANNER + s(26)), m, font=font, fill='black')
# semanas
day = START
while day < END:
    if day.weekday() == 0:
        d.line([xd(day), Y_HEAD, xd(day), H], fill=(236, 236, 236))
    day += timedelta(days=1)
# cabecera de la tabla
d.rectangle([0, Y_HEAD, X_CHART, Y_HEAD + ROW_H], fill=HEADER)
for x0, x1, label in ((0, X_START, 'Nombre'), (X_START, X_END, 'Fecha de inicio'), (X_END, X_CHART, 'Fecha de fin')):
    d.text((x0 + (x1 - x0 - d.textlength(label, font=font)) / 2, Y_HEAD + s(3)), label, font=font, fill='black')
for x in (X_START, X_END, X_CHART):
    d.line([x, Y_HEAD, x, H], fill=GRID)
d.line([0, Y_HEAD + ROW_H, W, Y_HEAD + ROW_H], fill=GRID)

fmt = lambda v: f'{v.day}/{v.month}/26'
for r, (name, a, b, group) in enumerate(TASKS):
    y = Y_HEAD + ROW_H * (r + 1)
    if group:
        d.rectangle([0, y, X_CHART - 1, y + ROW_H], fill=ZEBRA)
    indent = s(8) if group else s(28)
    d.ellipse([indent - s(5), y + s(8), indent + s(1), y + s(14)], fill=(150, 150, 150))
    d.text((indent + s(6), y + s(3)), name, font=font_b if group else font, fill='black')
    d.text((X_START + s(8), y + s(3)), fmt(a), font=font, fill='black')
    d.text((X_END + s(8), y + s(3)), fmt(b), font=font, fill='black')
    d.line([0, y + ROW_H, W, y + ROW_H], fill=(232, 232, 232))
    x0, x1 = xd(a), xd(b + timedelta(days=1))
    if group:
        d.rectangle([x0, y + s(6), x1, y + s(11)], fill=SUMMARY)
        d.polygon([(x0, y + s(11)), (x0 + s(5), y + s(11)), (x0, y + s(15))], fill=SUMMARY)
        d.polygon([(x1, y + s(11)), (x1 - s(5), y + s(11)), (x1, y + s(15))], fill=SUMMARY)
    else:
        d.rectangle([x0, y + s(4), max(x1, x0 + s(4)), y + ROW_H - s(4)], fill=BAR, outline=BAR_EDGE, width=K)

img.save(OUT, dpi=(96 * K, 96 * K))
print('ok', img.size)
