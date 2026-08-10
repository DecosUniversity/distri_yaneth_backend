# Reformulación: Recepción de Materia Prima y Control de Maduración

Esto reemplaza/extiende la sección de Iteración 2 del plan anterior. Cambia el modelo porque un solo
lote ya no madura como una unidad indivisible: partes del mismo lote pueden estar listas antes que
otras, y el plátano verde puede desviarse a un producto alterno en vez de esperar a la fritura.

## 1. Qué cambia respecto al diseño anterior

- Hoy `lotes_materia_prima` es 1 lote = 1 estado de maduración. Eso ya no alcanza: necesitas
  **fraccionar un lote en sub-lotes** cuando una parte madura más rápido que otra.
- El plátano puede llegar en tres estados (`Verde`, `Sazón`, `Maduro`) — hoy el backend siempre
  fuerza `estado_maduracion = 'Verde'` al crear el lote (`normalizeLotPayload` en
  `maturation.controller.js`). Eso hay que corregirlo: el estado inicial debe venir del pesaje/recepción.
- Si llega `Maduro`, no necesita esperar en cuarto de maduración — puede pasar directo a
  "Listo para producción".
- Nuevo proceso: **Plátano Verde en Red** — parte de un sub-lote verde se empaca directo como
  producto terminado de peso variable, sin pasar por fritura.
- Cuando un sub-lote llega a "Listo para producción", debe quedar consultable con todo lo que
  Producción (Iteración 3) necesita: peso disponible, producto, proveedor, lote de origen.

## 2. Modelo de datos actualizado

Nueva migración `sql/migrations/2026-XX-XX_add_sublotes_maduracion.sql`:

```sql
SET NAMES utf8mb4;

-- Un sub-lote es la unidad real de maduración/producción. Al crear un lote,
-- se crea automáticamente 1 sub-lote con el 100% del peso.
CREATE TABLE IF NOT EXISTS sublotes_maduracion (
  id_sublote INT AUTO_INCREMENT PRIMARY KEY,
  id_lote_mp INT NOT NULL,
  codigo_sublote VARCHAR(10) NOT NULL DEFAULT 'A',
  peso_inicial_kg DECIMAL(10,2) NOT NULL,        -- foto fija del peso al crear/fraccionar el sub-lote
  peso_kg DECIMAL(10,2) NOT NULL,                -- peso disponible actual (baja con fraccionamiento y redes)
  peso_neto_maduracion_kg DECIMAL(10,2) NULL,    -- peso real medido al cerrar maduracion (ver regla 9)
  perdida_maduracion_kg DECIMAL(10,2) NULL,      -- peso_kg (al cierre) - peso_neto_maduracion_kg
  cantidad_unidades INT NULL,
  estado_maduracion ENUM('Verde','Sazon','Maduro','Sobremaduro') NOT NULL DEFAULT 'Verde',
  estado_registro ENUM('Activo','Listo para produccion','Enviado a produccion','Derivado a red','Inactivo')
    NOT NULL DEFAULT 'Activo',
  observaciones TEXT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sublote_lote FOREIGN KEY (id_lote_mp) REFERENCES lotes_materia_prima(id_lote_mp)
) ENGINE=InnoDB;

-- control_maduracion pasa a medir el sub-lote, no el lote completo, y ahora puede
-- capturar el peso en cada muestreo (para ver la tendencia de perdida de peso, no solo el final).
ALTER TABLE control_maduracion
  ADD COLUMN id_sublote INT NULL AFTER id_lote_mp,
  ADD COLUMN peso_medido_kg DECIMAL(10,2) NULL AFTER grados_brix,
  ADD CONSTRAINT fk_control_sublote FOREIGN KEY (id_sublote) REFERENCES sublotes_maduracion(id_sublote);

-- Producto nuevo para catalogo (se inserta por la app o a mano una vez):
-- INSERT INTO productos (nombre, unidad_medida, tipo_producto, ...) VALUES ('Platano verde en red', 'kg', 'Producto Terminado', ...);

-- Detalle de cada red empacada (peso variable por unidad, igual que entrada_unidades pero de salida)
CREATE TABLE IF NOT EXISTS redes_verde_detalle (
  id_red INT AUTO_INCREMENT PRIMARY KEY,
  id_sublote INT NOT NULL,
  id_existencia INT NOT NULL,
  peso_kg DECIMAL(10,2) NOT NULL,
  id_usuario INT NOT NULL,
  fecha_empaque TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_red_sublote FOREIGN KEY (id_sublote) REFERENCES sublotes_maduracion(id_sublote),
  CONSTRAINT fk_red_existencia FOREIGN KEY (id_existencia) REFERENCES inventario_existencias(id_existencia),
  CONSTRAINT fk_red_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;
```

**Nota importante para cuando lleguemos a Iteración 3:** en el plan anterior le puse a
`procesos_produccion` una columna `id_lote_mp`. Con este cambio debe ser `id_sublote`
(referenciando `sublotes_maduracion`), porque Producción trabaja sobre la porción que ya está lista,
no sobre el lote completo. Si ya aplicaste esa parte del plan anterior, avísame y la ajustamos.

## 3. Reglas de negocio a implementar

1. **Al registrar la entrada** (pesaje por cajas, ya existe): el usuario indica el estado inicial
   (`Verde` / `Sazon` / `Maduro`), ya no queda fijo en "Verde".
2. **Al crear el lote**: se crea automáticamente 1 sub-lote "A" con el 100% del `peso_inicial_kg` y
   el mismo estado de maduración declarado.
3. **Si el estado inicial es `Maduro`**: el sub-lote pasa directo a `estado_registro = 'Listo para produccion'`,
   sin pasar por control de maduración.
4. **Fraccionamiento**: el operador puede "dividir" un sub-lote en dos — el sistema resta peso/cantidad
   del sub-lote origen y crea uno nuevo (`codigo_sublote` correlativo: A1, A2...) con su propio estado.
   Ningún sub-lote puede dividirse en un peso mayor al que le queda disponible.
5. **Control de maduración** (Grados Brix/temperatura, ya existe) ahora se registra contra
   `id_sublote`, no contra `id_lote_mp`.
6. **Cuando un sub-lote alcanza el umbral técnico**: pasa a `Listo para produccion` (esto es también
   donde se resuelve el pendiente que ya te había señalado: automatizar esa transición en
   `db.worker.js`, ahora aplicado a nivel de sub-lote).
7. **Plátano Verde en Red**: solo disponible para sub-lotes con `estado_maduracion = 'Verde'`. El
   operador registra 1 o más redes con su propio peso; cada una resta del peso disponible del
   sub-lote. Cuando el sub-lote llega a 0 kg disponibles, pasa a `estado_registro = 'Derivado a red'`.
   Cada red genera/actualiza una fila en `inventario_existencias` (producto = "Plátano verde en red")
   y un registro en `redes_verde_detalle`.
8. **Handoff a Producción**: el endpoint que liste "sub-lotes listos para producción" debe traer,
   en un solo JOIN, todo lo que Producción necesita — `id_sublote`, `peso_neto_maduracion_kg`
   (el peso real, ya con la pérdida de maduración descontada — esto es lo que Producción debe usar
   como peso de entrada, no `peso_inicial_kg`), `id_producto`, `producto_nombre`, `id_proveedor`,
   `proveedor_nombre`, `id_lote_mp` de origen.
9. **Pérdida por maduración**: el plátano pierde peso mientras madura (por deshidratación), y esa
   pérdida debe registrarse para el cálculo de rendimiento — es una categoría de pérdida aparte de
   las mermas de producción (cáscara, punta, cuaches, cocción, quemados), porque ocurre *antes* de
   que el lote toque planta. Mecánica:
   - En cada muestreo de laboratorio (`control_maduracion`) se puede capturar `peso_medido_kg`
     además de Grados Brix/temperatura — así se ve la tendencia de pérdida de peso, no solo el dato final.
   - Al **cerrar la maduración** de un sub-lote (pasar a `Listo para produccion`, manual o automático
     por umbral), el sistema toma el último `peso_medido_kg` registrado. Si no hay ninguno, debe
     pedirlo en ese momento antes de permitir el cierre.
   - Calcula `perdida_maduracion_kg = peso_kg (disponible en ese momento) - peso_medido_kg` (si da
     negativo, es un error de captura — no puede "ganar" peso — y debe rechazarse).
   - Guarda `perdida_maduracion_kg` y `peso_neto_maduracion_kg = peso_medido_kg` en el sub-lote.
     Esta pérdida no genera movimiento de inventario (el sub-lote todavía no es `inventario_existencias`,
     es materia prima en proceso) — queda como dato del sub-lote para que Reportería (Iteración 5)
     pueda mostrar el rendimiento completo: pérdida en maduración + mermas de producción, de punta a punta.

## 4. Backend — archivos a crear/modificar

- `src/models/maturation_sublot.model.js` (nuevo, mismo patrón que `maturation_lot.model.js`):
  `findAll`, `findById`, `findReadyForProduction`, `create`, `split` (fraccionar), `close` (cierre de
  maduración: recibe `peso_medido_kg`, calcula y guarda `perdida_maduracion_kg` /
  `peso_neto_maduracion_kg`, cambia estado), `update`.
- `src/models/green_net.model.js` (nuevo): `create`, `findBySublot`.
- `src/controllers/maturation.controller.js` (modificar):
  - `createLote`: ya no fija `estado_maduracion: 'Verde'` por default — lo toma de `req.body`, y crea
    el sub-lote inicial en la misma transacción/job.
  - Nuevo: `splitSublote` (fraccionar), `getSublotesListosParaProduccion`.
  - `createControl` ahora requiere `id_sublote` en vez de `id_lote_mp`.
- `src/controllers/green_net.controller.js` (nuevo): `createRed` (valida que el sub-lote sea Verde y
  tenga peso disponible, descuenta, crea/actualiza `inventario_existencias`).
- `src/routes/maturation.routes.js`: agregar
  - `GET /api/maduracion/sublotes`
  - `GET /api/maduracion/sublotes/listos-para-produccion`
  - `POST /api/maduracion/sublotes/:id/fraccionar`
  - `POST /api/maduracion/sublotes/:id/cerrar` (recibe `peso_medido_kg`, calcula la pérdida)
  - `POST /api/maduracion/redes-verdes`
- `src/workers/db.worker.js`: agregar bloque `maturationSublots.*` y `greenNets.*` (mismo estilo que
  `maturationLotQueries`), y modificar `maturationControls.create` para que, tras insertar, compare
  `grados_brix` contra el umbral configurado y actualice `sublotes_maduracion.estado_registro` cuando
  corresponda.

## 5. Frontend — archivos a crear/modificar

- `src/services/maturation.service.js`: agregar `listSublotsRequest`, `splitSublotRequest`,
  `listReadyForProductionRequest`, `createGreenNetRequest`.
- `src/features/maturation/MaturationControlModule.jsx`: ahora la tabla principal lista **sub-lotes**
  (no lotes), con acción "Fraccionar" y, si el sub-lote está Verde, botón "Empacar como red" que abre
  un formulario simple (peso por red, puede agregar varias antes de guardar).
- Nuevo componente `src/features/maturation/GreenNetForm.jsx` (o similar) para el registro de redes.

## 6. Prompt listo para pegar en Claude Code (backend, primero)

```
Voy a reformular el módulo de maduración. Lee src/controllers/maturation.controller.js,
src/models/maturation_lot.model.js y el bloque maturationLotQueries / maturationControlQueries
en src/workers/db.worker.js para entender el patron actual (enqueueDbJob + queries en el worker).

Necesito:
1. Una migracion nueva en sql/migrations que cree la tabla sublotes_maduracion (1 lote puede
   tener varios sub-lotes, cada uno con su propio peso_kg, estado_maduracion y estado_registro),
   agregue id_sublote a control_maduracion, y cree la tabla redes_verde_detalle para el nuevo
   proceso "Platano verde en red" (peso variable por unidad, referencia a inventario_existencias).
2. Al crear un lote de materia prima, ya no fijar estado_maduracion en 'Verde' por defecto: debe
   venir del payload (Verde/Sazon/Maduro), y crear automaticamente un sub-lote inicial con el
   100% del peso. Si el estado inicial es Maduro, el sub-lote nace en estado_registro
   'Listo para produccion' directamente.
3. Un endpoint para fraccionar un sub-lote (recibe peso a separar, crea un sub-lote nuevo y resta
   del origen), y otro que liste sub-lotes en estado 'Listo para produccion' con toda la
   informacion (producto, proveedor, lote de origen, y peso_neto_maduracion_kg) que va a necesitar
   el modulo de produccion.
4. Modificar el registro de control de maduracion (Grados Brix) para que apunte a id_sublote, y
   que ademas pueda capturar opcionalmente peso_medido_kg en cada muestreo. Al guardar, compara
   grados_brix contra el umbral tecnico y si lo cumple, cambia automaticamente el sub-lote a
   'Listo para produccion' (hoy esto es manual, hay que automatizarlo).
5. El plátano pierde peso mientras madura (deshidratacion) y hay que registrar esa perdida para el
   calculo de rendimiento. Al cerrar un sub-lote (endpoint /sublotes/:id/cerrar, manual o
   disparado por el punto 4), toma el ultimo peso_medido_kg capturado en control_maduracion (si no
   hay ninguno, el endpoint debe recibirlo en el body), calcula
   perdida_maduracion_kg = peso_kg_disponible - peso_medido_kg (rechaza si da negativo), y guarda
   perdida_maduracion_kg y peso_neto_maduracion_kg en el sub-lote. Esta perdida es una categoria
   separada de las mermas de produccion (cascara, punta, cuaches, coccion, quemados) que vienen en
   la siguiente iteracion — no genera movimiento de inventario, es dato del sub-lote para reportes
   de rendimiento de punta a punta.
6. Un endpoint para registrar una o varias "redes" de platano verde: valida que el sub-lote este
   en estado Verde y tenga peso disponible, resta ese peso, y crea/actualiza el inventario de
   producto terminado "Platano verde en red" con el peso de esa red especifica.

Sigue el mismo patron que ya existe (modelo -> enqueueDbJob -> query en db.worker.js -> controller
-> routes -> registro en app.js). No cambies el estilo de validacion que ya usa
maturation.controller.js (funciones validate*/normalize* + mensajes en espanol).
```

Cuando el backend esté probado (endpoints respondiendo bien con Postman/Thunder Client), abre Claude
Code en el frontend y pégale el punto 5 de este documento con el mismo tono ("sigue el patrón de
`MaturationControlModule.jsx` y `maturation.service.js`").
