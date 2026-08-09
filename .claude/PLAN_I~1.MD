# Plan de Implementación — Iteraciones 3, 4 y 5

Basado en la lectura directa de `distri_yaneth_backend` y `distri_yaneth_frontend` (rama `main`).

## 1. Diagnóstico del código actual

**Ya implementado (Iteración 1 y 2):**
- Seguridad y catálogos: `usuarios`, `proveedores`, `clientes`, `productos`, roles `Administrador`, `Produccion`, `Logistica`, `Piloto` (ENUM en tabla `usuarios`).
- Entrada de materia prima: `entradas_mercancia` + `entrada_unidades` (pesaje por caja/unidad — el peso ya se captura neto por unidad, no hay resta bruto−tara explícita; si tu diagrama de actividad la requiere como campo separado, es un ajuste menor a `entrada_unidades`).
- Maduración: `lotes_materia_prima` (con `estado_maduracion`, `estado_registro`: Pendiente/Activo/Completo/Inactivo) y `control_maduracion` (Grados Brix, temperatura).
- Vehículos: `vehiculos`, `servicios_vehiculo`, `reporte_kilometraje_vehiculo`.
- Toda la persistencia pasa por el patrón `Cliente → API → enqueueDbJob (BullMQ/Redis) → db.worker.js → MySQL`, exactamente el patrón que documentaste en el Alcance de la Iteración 1. Todo lo nuevo debe seguir este mismo patrón para no romper la arquitectura.

**Gap detectado en Iteración 2 (antes de avanzar a producción):**
`maturationControls.create` en `db.worker.js` (línea ~737) solo inserta la medición; no compara `grados_brix` contra un umbral ni actualiza `estado_maduracion` a "Listo para produccion". El "Motor de Alertas Tempranas" del CU002 todavía es manual (se cambia el estado a mano vía `PUT /api/maduracion/lotes/:id`). Te recomiendo cerrar esto primero porque la Iteración 3 depende de lotes ya validados.

**No implementado:**
- Iteración 3 completa (Pelado/Corte/Fritura/Embalaje, mermas, congelado). Solo existe un stub: tabla `procesos_produccion` (`id_proceso`, `descripcion`, `estado_registro`) creada únicamente para satisfacer la FK de `inventario_existencias.id_proceso_origen`. El propio comentario del SQL dice "expande luego según tu flujo real" — es tu punto de partida.
- Iteración 4: falta todo lo de rutas/pedidos/despacho/piloto. Lo de vehículos, mantenimiento y kilometraje ya está.
- Iteración 5: no existe módulo de reportería en backend ni frontend, solo los widgets sueltos del dashboard (`UpcomingMaturationLotsWidget`, `UpcomingVehicleServicesWidget`).
- Dato útil: el frontend ya trae `jspdf` + `jspdf-autotable` instalados — puedes exportar PDF sin tocar el backend. Para Excel no hay librería instalada todavía (recomiendo `xlsx` de SheetJS en frontend, o `exceljs` en backend si prefieres generarlo server-side).

---

## 2. Iteración 3 — Producción y Rendimiento (REQ003)

### Base de datos (`sql/migrations/2026-XX-XX_add_produccion_module.sql`)

```sql
ALTER TABLE procesos_produccion
  ADD COLUMN id_lote_mp INT NULL AFTER id_proceso,
  ADD COLUMN tipo_proceso ENUM('Pelado','Corte','Fritura','Embalaje') NOT NULL AFTER id_lote_mp,
  ADD COLUMN personal_asignado INT NULL,
  ADD COLUMN fecha_inicio TIMESTAMP NULL,
  ADD COLUMN fecha_fin TIMESTAMP NULL,
  ADD CONSTRAINT fk_proceso_lote FOREIGN KEY (id_lote_mp) REFERENCES lotes_materia_prima(id_lote_mp);

CREATE TABLE IF NOT EXISTS mermas_produccion (
  id_merma INT AUTO_INCREMENT PRIMARY KEY,
  id_proceso INT NOT NULL,
  categoria ENUM('Cascara','Punta','Cuaches','Coccion','Quemados') NOT NULL,
  peso_kg DECIMAL(10,2) NOT NULL,
  fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_merma_proceso FOREIGN KEY (id_proceso) REFERENCES procesos_produccion(id_proceso)
) ENGINE=InnoDB;

ALTER TABLE lotes_materia_prima
  ADD COLUMN observaciones TEXT NULL;
-- 'En Fraccion' se puede manejar como valor adicional de estado_registro si prefieres no crear columna nueva
```

Los insumos (aceite, bolsas de empaque, bolsas de basura) **no necesitan tabla nueva**: ya existe `productos.tipo_producto = 'Insumo'` e `inventario_existencias` + `movimientos_inventario`. Descontarlos es un `INSERT` en `movimientos_inventario` con `tipo_movimiento='Salida'` y `motivo='Consumo en proceso #<id_proceso>'` — el trigger `tr_actualizar_stock_existencia` ya ajusta el stock solo. Lo mismo aplica para mermas si quieres que también descuenten inventario base: usa `tipo_movimiento='Desperdicio'` (ya existe en el ENUM, previsto desde el inicio).

El producto terminado que sale de Embalaje se registra como un nuevo `inventario_existencias` con `id_proceso_origen` apuntando al proceso de Embalaje y `id_producto` = presentación comercial.

### Backend (mismo patrón que `maturation_lot.model.js` / `maturation.controller.js`)

- `src/models/production.model.js`: `findAll`, `findById`, `iniciarProceso`, `cerrarProceso`, `registrarMerma`.
- `src/controllers/production.controller.js`: valida payloads igual que `maturation.controller.js` (reutiliza ese archivo como plantilla), calcula tiempo (`fecha_fin - fecha_inicio`) y rendimiento neto (`peso_inicial_kg - SUM(mermas.peso_kg)`).
- `src/routes/production.routes.js`:
  - `POST /api/produccion/procesos/iniciar`
  - `PUT /api/produccion/procesos/:id/cerrar`
  - `POST /api/produccion/mermas`
  - `POST /api/produccion/congelado` (crea `inventario_existencias` + `movimientos_inventario`)
- En `src/workers/db.worker.js`: agrega el bloque de queries `productionProcesses.*` y `mermas.*` siguiendo exactamente el estilo de `maturationLotQueries` / `maturationControlQueries` (mismo archivo, mismo patrón de `${TABLE}`).
- En `src/app.js`: registrar `/api/produccion` con `authenticateToken, authorizeRoles('Administrador', 'Produccion')`.

### Frontend

- `src/services/production.service.js` (copia el patrón de `maturation.service.js`).
- `src/features/production/ProductionModule.jsx` (copia estructura de `MaturationControlModule.jsx`): selector de lote en estado "Completo"/"Listo para produccion", botones iniciar/cerrar por proceso con campo de personal, formulario de mermas por categoría, formulario de congelado.
- `src/config/rolePermissions.js`: agrega `production` a `MODULE_DEFINITIONS` y a `ROLE_MODULE_PERMISSIONS.Administrador` / `.Produccion`.

---

## 3. Iteración 4 — Logística y Distribución (REQ004)

### Base de datos

```sql
CREATE TABLE IF NOT EXISTS pedidos (
  id_pedido INT AUTO_INCREMENT PRIMARY KEY,
  id_cliente INT NOT NULL,
  estado ENUM('Pendiente','Preparado','En Ruta','Entregado','Devuelto') NOT NULL DEFAULT 'Pendiente',
  motivo_devolucion VARCHAR(255) NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pedido_cliente FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rutas_entrega (
  id_ruta INT AUTO_INCREMENT PRIMARY KEY,
  id_vehiculo INT NOT NULL,
  id_piloto INT NOT NULL,
  km_salida DECIMAL(12,2) NULL,
  km_llegada DECIMAL(12,2) NULL,
  galones_combustible DECIMAL(10,2) NULL,
  estado ENUM('Preparado','En Ruta','Cerrada') NOT NULL DEFAULT 'Preparado',
  fecha_salida TIMESTAMP NULL,
  fecha_llegada TIMESTAMP NULL,
  CONSTRAINT fk_ruta_vehiculo FOREIGN KEY (id_vehiculo) REFERENCES vehiculos(id_vehiculo),
  CONSTRAINT fk_ruta_piloto FOREIGN KEY (id_piloto) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ruta_pedidos (
  id_ruta INT NOT NULL,
  id_pedido INT NOT NULL,
  PRIMARY KEY (id_ruta, id_pedido),
  CONSTRAINT fk_rp_ruta FOREIGN KEY (id_ruta) REFERENCES rutas_entrega(id_ruta),
  CONSTRAINT fk_rp_pedido FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido)
) ENGINE=InnoDB;
```

`vehiculos.estado` ya tiene los valores `Disponible / En ruta / Mantenimiento / Inactivo` — la validación de "vehículo no disponible" del CU004 es directa: al crear la ruta, verifica `estado='Disponible'` y dispara error 400 si no. Al cerrar la ruta, si `km_llegada < km_salida` responde 400 (igual que la validación que ya existe en `vehicle.controller.js` para estados).

### Backend

- `src/models/order.model.js`, `src/models/route.model.js` (patrón `enqueueDbJob`).
- `src/controllers/logistics.controller.js`: `crearRuta` (valida disponibilidad, genera manifiesto = lista de pedidos asignados, cambia pedidos a "Preparado"), `registrarSalida`, `confirmarEntrega`, `registrarDevolucion`.
- `src/routes/logistics.routes.js`: `POST /api/rutas`, `PUT /api/rutas/:id/salida`, `PUT /api/rutas/:id/entrega`, `PUT /api/pedidos/:id/devolucion`.
- Añadir queries `orders.*` y `routes.*` en `db.worker.js`.
- Registrar en `app.js` bajo `/api/rutas` y `/api/pedidos` con `authorizeRoles('Administrador', 'Logistica', 'Piloto')` (el Piloto solo necesita `registrarSalida`/`confirmarEntrega`, así que controla el detalle fino dentro del controller, no solo en la ruta).

### Frontend

- `src/features/logistics/RoutesModule.jsx` (vista Administrador: crear ruta, ver manifiesto) y una vista simplificada para Piloto (dado que ya tienes rol `Piloto` con acceso solo a `dashboard`, agrégale un módulo `myRoute` limitado a sus propias rutas activas — coincide con tu CU004 que distingue Administrador de Piloto).
- `src/services/logistics.service.js`.

---

## 4. Iteración 5 — Reportería y Dashboard (REQ005)

### Backend

No necesita tablas nuevas — son consultas agregadas sobre lo que ya existe:
- Rendimiento de producción: `procesos_produccion` + `mermas_produccion` (de la Iteración 3).
- Inventario valorizado: `inventario_existencias.cantidad_disponible * costo_unitario`.
- Eficiencia de flota: `reporte_kilometraje_vehiculo` + `servicios_vehiculo` + `rutas_entrega.galones_combustible`.

- `src/controllers/reports.controller.js`: `getIndicadores` (dashboard en tiempo real), `getInventarioValorizado`, `getEficienciaFlota`, todos con query params de filtro (`fecha_inicio`, `fecha_fin`, `id_cliente`, `categoria_merma`).
- `src/routes/reports.routes.js`: `GET /api/reportes/indicadores`, `GET /api/reportes/inventario-valorizado`, `GET /api/reportes/eficiencia-flota`.
- Igual que el resto, las consultas pesadas se encolan vía `enqueueDbJob` para no bloquear el event loop (esto es literalmente lo que ya describiste en el Alcance de la Iteración 5 sobre BullMQ evitando el timeout).

### Frontend

- `src/features/reports/ReportsModule.jsx`: filtros + tablas. Para gráficas no hay librería instalada todavía — te recomiendo `recharts` (liviana, se integra bien con React 19).
- Exportar a PDF: ya tienes `jspdf` + `jspdf-autotable`, se arma el PDF directo del `ReportsModule.jsx` con los datos ya filtrados.
- Exportar a Excel: instala `xlsx` (`npm install xlsx` en el frontend) y genera el archivo client-side con los mismos datos filtrados.
- `src/services/reports.service.js`.

---

## 5. Orden de trabajo sugerido

1. Cerrar el gap de alertas automáticas de maduración en `db.worker.js` (rápido, y desbloquea "lotes válidos" para Producción).
2. Iteración 3 (Producción): es la que más tablas nuevas necesita y de la que dependen los reportes de rendimiento.
3. Iteración 4 (Logística): en paralelo o después, no depende de Producción.
4. Iteración 5 (Reportería): al final, ya que consume datos de las tres anteriores.

En cada iteración, el orden interno es: migración SQL → queries en `db.worker.js` → model → controller → routes → registrar en `app.js` → service del frontend → módulo del frontend → agregar el módulo a `rolePermissions.js`. Es el mismo orden que ya siguieron para Maduración, así que puedes literalmente usar esos archivos como plantilla mientras programas.
