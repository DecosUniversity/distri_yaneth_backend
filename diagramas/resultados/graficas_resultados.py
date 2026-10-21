"""Graficas del Capitulo VI (Analisis de Resultados) con los datos de Distribuidora Yaneth.
Uso: python graficas_resultados.py   (genera los PNG en esta misma carpeta)

Los valores son los tiempos y recursos estimados por el personal de la empresa durante el
periodo de operacion en paralelo (bitacora manual vs. sistema); deben coincidir con las tablas
de la seccion 6.3 de la tesis.
"""
import os

import matplotlib

matplotlib.use('Agg')
import matplotlib.pyplot as plt  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
DARK, LIGHT = '#4D4D4D', '#A6A6A6'
FUENTE = 'Fuente: elaboración propia con datos de Distribuidora Yaneth (período de operación en paralelo).'
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 11, 'axes.spines.top': False, 'axes.spines.right': False})

# (tarea, antes en minutos, despues en minutos) — por operacion
TAREAS = [
    ('Recepción y pesaje\nde un lote (≈ 40 cajas)', 45, 25),
    ('Medición de maduración\ny decisión de proceso', 15, 3),
    ('Rendimiento y mermas\nal cierre de jornada', 60, 5),
    ('Asignación de ruta\ny despacho', 30, 10),
    ('Consulta del historial\nde un lote', 120, 1),
]
REPORTE_MENSUAL = ('Consolidación del\nreporte mensual', 960, 15)


def save(fig, name):
    fig.savefig(os.path.join(HERE, name), dpi=150, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    print('ok', name)


# 1) Tiempo por tarea: antes vs despues
fig, ax = plt.subplots(figsize=(11.5, 5.4))
x = range(len(TAREAS))
w = 0.38
antes = [t[1] for t in TAREAS]
despues = [t[2] for t in TAREAS]
b1 = ax.bar([i - w / 2 for i in x], antes, w, color=LIGHT, label='Antes (registro manual)')
b2 = ax.bar([i + w / 2 for i in x], despues, w, color=DARK, label='Después (sistema)')
for bars in (b1, b2):
    for b in bars:
        ax.annotate(f'{int(b.get_height())} min', (b.get_x() + b.get_width() / 2, b.get_height()), ha='center', va='bottom',
                    fontsize=9, xytext=(0, 2), textcoords='offset points')
ax.set_xticks(list(x))
ax.set_xticklabels([t[0] for t in TAREAS], fontsize=9.5)
ax.set_ylabel('Minutos por operación')
ax.set_title('Tiempo de las tareas operativas: antes vs. después', fontsize=12)
ax.legend(frameon=False)
ax.yaxis.grid(True, color='#E6E6E6')
ax.set_axisbelow(True)
fig.text(0.5, -0.04, FUENTE, ha='center', fontsize=8.5, style='italic', color='#404040')
save(fig, 'resultados_tiempos_antes_despues.png')

# 2) Reduccion porcentual del tiempo por tarea
todas = TAREAS + [REPORTE_MENSUAL]
red = [round((a - d) / a * 100) for _, a, d in todas]
orden = sorted(range(len(todas)), key=lambda i: red[i])
fig, ax = plt.subplots(figsize=(9, 5.2))
bars = ax.barh([todas[i][0].replace('\n', ' ') for i in orden], [red[i] for i in orden], color=DARK, height=0.55)
for b, i in zip(bars, orden):
    ax.annotate(f'−{red[i]} %', (b.get_width(), b.get_y() + b.get_height() / 2), va='center', ha='left', fontsize=9,
                xytext=(4, 0), textcoords='offset points')
ax.set_xlim(0, 110)
ax.set_xlabel('Reducción del tiempo respecto al registro manual (%)')
ax.set_title('Reducción del tiempo por tarea con el sistema', fontsize=12)
ax.xaxis.grid(True, color='#E6E6E6')
ax.set_axisbelow(True)
ax.tick_params(axis='y', labelsize=9)
fig.text(0.5, -0.04, FUENTE, ha='center', fontsize=8.5, style='italic', color='#404040')
save(fig, 'resultados_reduccion_pct.png')

# 3) Recursos administrativos por mes
RECURSOS = [('Hojas de papel\nen bitácoras y reportes', 350, 40, 'hojas'),
            ('Horas de transcripción\na hojas de cálculo', 20, 0, 'h'),
            ('Personas para el\ncierre mensual', 2, 1, ('persona', 'personas'))]
fig, axes = plt.subplots(1, 3, figsize=(10, 4.4))
for ax, (name, a, d, unit) in zip(axes, RECURSOS):
    bars = ax.bar(['Antes', 'Después'], [a, d], color=[LIGHT, DARK], width=0.55)
    for b in bars:
        ax.annotate(f'{int(b.get_height())} ' + (unit if isinstance(unit, str) else unit[int(b.get_height()) != 1]), (b.get_x() + b.get_width() / 2, b.get_height()), ha='center', va='bottom',
                    fontsize=9, xytext=(0, 2), textcoords='offset points')
    ax.set_title(name, fontsize=10)
    ax.set_ylim(0, a * 1.2)
    ax.set_yticks([])
    ax.spines['left'].set_visible(False)
fig.suptitle('Recursos administrativos por mes: antes vs. después', fontsize=12, y=1.02)
fig.text(0.5, -0.04, FUENTE, ha='center', fontsize=8.5, style='italic', color='#404040')
save(fig, 'resultados_insumos_antes_despues.png')
