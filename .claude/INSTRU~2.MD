# Iteración 4 — Módulo de Distribución (Pedidos, Rutas y Devoluciones)

Este documento reemplaza la sección "Iteración 4" del plan general anterior (esa versión asumía un
diseño genérico; este ya incorpora tus respuestas: gestión de pedidos sin facturación, vínculo
vehículo–piloto–pedido, asignación del piloto más óptimo, y recepción/revisión de devoluciones).

Confirmado leyendo el repo actual: `vehiculos.estado` ya tiene `Disponible / En ruta / Mantenimiento /
Inactivo`, y existe `reporte_kilometraje_vehiculo` con endpoint de lectura pero **nada que le escriba
todavía** — es el punto de enganche natural para que la ruta registre kilometraje ahí.

## 1. Alcance de esta iteración

- Módulo de **pedidos** (varios productos por pedido, sin facturación/ventas — es solo la lista de
  qué hay que despachar a qué cliente).
- Módulo de **rutas**: agrupa varios pedidos en un solo viaje (manifiesto), asignando vehículo y
  piloto. Al crear la ruta se sugiere el piloto más óptimo.
- Registro de kilometraje y combustible por viaje, alimentando `reporte_kilometraje_vehiculo`.
- Seguimiento de estado del pedido y la ruta durante el ciclo de vida.
- **Recepción de devoluciones**: cuando un cliente rechaza la entrega, se registra la devolución
  físicamente recibida, y en un paso aparte (revisión) se decide si vuelve a inventario o se da de
  baja como pérdida.

## 2. Modelo de datos

Nueva migración `sql/migrations/2026-XX-XX_add_modulo_distribucion.sql`:

```sql
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS pedidos (
  id_pedido INT AUTO_INCREMENT PRIMARY KEY,
  id_cliente INT NOT NULL,
  estado ENUM('Pendiente','Preparado','En Ruta','Entregado','Con Devolucion','Cancelado')
    NOT NULL DEFAULT 'Pendiente',
  observaciones TEXT NULL,
  id_usuario_creacion INT NOT NULL,
  estado_registro ENUM('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pedido_cliente FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente),
  CONSTRAINT fk_pedido_usuario FOREIGN KEY (id_usuario_creacion) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;

-- Varios productos por pedido
CREATE TABLE IF NOT EXISTS pedido_detalle (
  id_detalle INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido INT NOT NULL,
  id_producto INT NOT NULL,
  cantidad DECIMAL(10,2) NOT NULL,
  estado_entrega ENUM('Pendiente','Entregado','Devuelto') NOT NULL DEFAULT 'Pendiente',
  CONSTRAINT fk_detalle_pedido FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido),
  CONSTRAINT fk_detalle_producto FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rutas_entrega (
  id_ruta INT AUTO_INCREMENT PRIMARY KEY,
  id_vehiculo INT NOT NULL,
  id_piloto INT NOT NULL,
  estado ENUM('Preparado','En Ruta','Cerrada') NOT NULL DEFAULT 'Preparado',
  km_salida DECIMAL(12,2) NULL,
  km_llegada DECIMAL(12,2) NULL,
  galones_combustible DECIMAL(10,2) NULL,
  fecha_salida DATETIME NULL,
  fecha_llegada DATETIME NULL,
  id_usuario_creacion INT NOT NULL,
  estado_registro ENUM('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ruta_vehiculo FOREIGN KEY (id_vehiculo) REFERENCES vehiculos(id_vehiculo),
  CONSTRAINT fk_ruta_piloto FOREIGN KEY (id_piloto) REFERENCES usuarios(id_usuario),
  CONSTRAINT fk_ruta_usuario FOREIGN KEY (id_usuario_creacion) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;

-- Manifiesto: varios pedidos por ruta
CREATE TABLE IF NOT EXISTS ruta_pedidos (
  id_ruta INT NOT NULL,
  id_pedido INT NOT NULL,
  orden_entrega INT NULL,
  PRIMARY KEY (id_ruta, id_pedido),
  CONSTRAINT fk_rp_ruta FOREIGN KEY (id_ruta) REFERENCES rutas_entrega(id_ruta),
  CONSTRAINT fk_rp_pedido FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido)
) ENGINE=InnoDB;

-- Recepcion de devoluciones: primero se registra que el producto volvio fisicamente,
-- despues (puede ser otro momento/usuario) se resuelve que pasa con el.
CREATE TABLE IF NOT EXISTS devoluciones_pedido (
  id_devolucion INT AUTO_INCREMENT PRIMARY KEY,
  id_detalle INT NOT NULL,
  cantidad_devuelta DECIMAL(10,2) NOT NULL,
  motivo TEXT NULL,
  resolucion ENUM('Pendiente de revision','Reingresado a inventario','Perdida')
    NOT NULL DEFAULT 'Pendiente de revision',
  id_usuario_recepcion INT NOT NULL,
  id_usuario_resolucion INT NULL,
  fecha_recepcion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_resolucion DATETIME NULL,
  CONSTRAINT fk_devolucion_detalle FOREIGN KEY (id_detalle) REFERENCES pedido_detalle(id_detalle),
  CONSTRAINT fk_devolucion_recepcion FOREIGN KEY (id_usuario_recepcion) REFERENCES usuarios(id_usuario),
  CONSTRAINT fk_devolucion_resolucion FOREIGN KEY (id_usuario_resolucion) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;
```

No hace falta tabla de facturación ni de "ventas" — `pedidos` + `pedido_detalle` son solo la lista de
despacho, tal como pediste.

## 3. Reglas de negocio

1. **Crear pedido**: Administrador/Logística elige cliente y agrega líneas (producto + cantidad).
   Queda en `Pendiente`. Solo se pueden pedir productos con `tipo_producto = 'Producto Terminado'`
   y con existencia disponible en `inventario_existencias` (no bloqueante, pero se muestra el stock
   disponible al armar el pedido).
2. **Crear ruta**: se seleccionan uno o más pedidos en `Pendiente` del mismo día/zona, un vehículo
   con `estado = 'Disponible'` y un piloto. Al confirmar:
   - Los pedidos pasan a `Preparado`.
   - El vehículo pasa a `estado = 'En ruta'`.
   - Se crea el registro en `ruta_pedidos` (el manifiesto).
3. **Sugerencia de piloto óptimo** (`GET /api/rutas/pilotos-disponibles`): devuelve usuarios con
   `rol = 'Piloto'` que **no tengan ninguna ruta activa** (`estado IN ('Preparado','En Ruta')`),
   ordenados por menor cantidad de rutas ya asignadas en el día — es decir, prioriza a quien tiene
   menos carga de trabajo hoy. Es un criterio simple (no hay GPS/ubicación en el alcance del
   proyecto); si más adelante quieres afinarlo por zona geográfica del cliente, se puede agregar
   después sin romper el diseño.
4. **Salida a ruta**: el piloto (o el admin por él) registra `km_salida` y `galones_combustible`.
   La ruta pasa a `En Ruta`; los pedidos asociados pasan a `En Ruta`.
5. **Confirmar entrega por pedido**: por cada pedido del manifiesto, se marca qué líneas
   (`pedido_detalle`) se entregaron y cuáles no. Las entregadas pasan a `estado_entrega = 'Entregado'`;
   las no entregadas quedan para el paso de devolución.
6. **Cierre de ruta**: se registra `km_llegada` (debe ser mayor a `km_salida`, si no, error). Al
   cerrar:
   - Actualiza `vehiculos.kilometraje_actual = km_llegada` y `estado = 'Disponible'`.
   - Inserta una fila en `reporte_kilometraje_vehiculo` (hoy esa tabla no tiene nada que le escriba —
     esta es su fuente).
   - Cada pedido del manifiesto pasa a `Entregado` (si todas sus líneas se entregaron) o
     `Con Devolucion` (si alguna línea quedó pendiente/no entregada).
7. **Recepción de devolución**: por cada línea no entregada, se crea un registro en
   `devoluciones_pedido` con `resolucion = 'Pendiente de revision'` — esto es lo que "recibe
   físicamente" el producto de vuelta.
8. **Revisión de devolución** (paso aparte, como pediste): Administrador/Logística decide:
   - `Reingresado a inventario`: crea un movimiento `Entrada` en `movimientos_inventario` sobre la
     existencia correspondiente (el trigger `tr_actualizar_stock_existencia` ya suma el stock solo).
   - `Perdida`: no se necesita movimiento adicional (el producto ya se había restado del inventario
     al despachar la ruta); el registro de la devolución con `resolucion = 'Perdida'` es en sí mismo
     el dato que va a alimentar Reportería (Iteración 5) como pérdida logística.

## 4. Backend — archivos a crear

- `src/models/order.model.js`, `src/models/route.model.js`, `src/models/order_return.model.js`
  (patrón `enqueueDbJob`, igual que `production.model.js`).
- `src/controllers/order.controller.js`: crear/listar pedidos con sus líneas.
- `src/controllers/route.controller.js`: crear ruta (valida disponibilidad, arma manifiesto),
  pilotos disponibles, registrar salida, confirmar entregas, cerrar ruta.
- `src/controllers/order_return.controller.js`: registrar recepción, resolver devolución.
- `src/routes/order.routes.js`, `src/routes/route.routes.js`, `src/routes/order_return.routes.js`.
- Endpoints sugeridos:
  - `POST /api/pedidos`, `GET /api/pedidos`, `GET /api/pedidos/:id`
  - `GET /api/rutas/pilotos-disponibles`
  - `POST /api/rutas` (crea con manifiesto)
  - `PUT /api/rutas/:id/salida`
  - `PUT /api/rutas/:id/entregas` (marca líneas entregadas/no entregadas)
  - `PUT /api/rutas/:id/cerrar`
  - `POST /api/devoluciones` (recepción)
  - `PUT /api/devoluciones/:id/resolver`
- Bloques de queries nuevos en `src/workers/db.worker.js`: `orders.*`, `routes.*`, `orderReturns.*`,
  siguiendo el mismo estilo que ya usaron para `productionQueries`/`maturationSublotQueries`.
- Registrar en `app.js`: `/api/pedidos` y `/api/rutas` con
  `authorizeRoles('Administrador', 'Logistica', 'Piloto')` (controla en el controller qué puede
  hacer cada rol — el Piloto normalmente solo `salida`, `entregas` y ver sus propias rutas);
  `/api/devoluciones` con `authorizeRoles('Administrador', 'Logistica')`.

## 5. Frontend — archivos a crear

- `src/services/order.service.js`, `src/services/route.service.js`, `src/services/order_return.service.js`.
- `src/features/orders/OrdersModule.jsx`: crear pedido (cliente + líneas de producto/cantidad),
  listado con estado.
- `src/features/routes/RoutesModule.jsx` (vista Administrador/Logística): armar ruta seleccionando
  pedidos pendientes, ver sugerencia de piloto óptimo, cerrar ruta, marcar entregas.
- Vista simplificada para el rol `Piloto` (ya existe el rol, hoy solo ve `dashboard`): sus rutas
  activas, botón de registrar salida/llegada — puede ser una vista dentro del mismo
  `RoutesModule.jsx` condicionada por rol, o un componente aparte más simple para pantalla móvil.
- `src/features/returns/ReturnsModule.jsx`: lista de devoluciones pendientes de revisión con botón
  para resolver (reingresar / marcar como pérdida).
- `src/config/rolePermissions.js`: agregar `orders`, `routes`, `returns` a `MODULE_DEFINITIONS` y a
  `ROLE_MODULE_PERMISSIONS` (Administrador: todo; Logistica: todo; Piloto: solo su vista de rutas).

## 6. Prompt listo para pegar en Claude Code (backend, primero)

```
Voy a construir el modulo de Distribucion (pedidos + rutas + devoluciones). Antes de escribir
codigo, lee src/controllers/production.controller.js, src/models/production.model.js y el bloque
de queries de produccion en src/workers/db.worker.js para seguir exactamente el mismo patron
(enqueueDbJob + queries centralizadas en el worker + validate*/normalize* en el controller).
Tambien revisa src/controllers/vehicle.controller.js (estados del vehiculo) y la tabla
reporte_kilometraje_vehiculo (hoy solo tiene un GET, nada le escribe).

Necesito:
1. Migracion nueva en sql/migrations con las tablas pedidos, pedido_detalle (varios productos por
   pedido, no hay facturacion/ventas), rutas_entrega, ruta_pedidos (varios pedidos por ruta, es un
   manifiesto), y devoluciones_pedido (con resolucion Pendiente de revision / Reingresado a
   inventario / Perdida).
2. Endpoints para crear un pedido con sus lineas, y listarlos.
3. Un endpoint que sugiera el piloto mas optimo: usuarios con rol Piloto, sin ninguna ruta activa
   (estado Preparado o En Ruta), ordenados por menor cantidad de rutas asignadas en el dia actual.
4. Crear ruta: recibe varios id_pedido, un vehiculo (debe estar en estado Disponible) y un piloto;
   crea el manifiesto en ruta_pedidos, pasa los pedidos a Preparado y el vehiculo a En ruta.
5. Registrar salida (km_salida, galones_combustible, pasa ruta y pedidos a En Ruta), confirmar
   entregas por linea de pedido (pedido_detalle.estado_entrega), y cerrar ruta: recibe km_llegada
   (debe ser mayor a km_salida o rechaza), actualiza vehiculos.kilometraje_actual y estado
   Disponible, inserta una fila en reporte_kilometraje_vehiculo, y cambia cada pedido a Entregado
   o Con Devolucion segun si todas sus lineas se entregaron.
6. Endpoint para recepcionar una devolucion (por linea de pedido no entregada, queda en Pendiente
   de revision), y otro para resolverla: si es Reingresado a inventario, inserta un movimiento
   Entrada en movimientos_inventario sobre la existencia del producto (el trigger ya actualiza el
   stock); si es Perdida, no hace falta movimiento adicional.

Sigue el mismo patron de validacion y estructura de carpetas que ya existe. No toques el modulo de
produccion ni el de maduracion.
```
