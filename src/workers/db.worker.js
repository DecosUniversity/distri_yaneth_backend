const { Worker } = require('bullmq');

const { pool } = require('../config/db');
const { redisConnection } = require('../config/redis');
const { DB_QUEUE_NAME } = require('../queues/db.queue');

const USERS_TABLE = process.env.DB_USERS_TABLE || 'usuarios';
const PROVIDERS_TABLE = process.env.DB_PROVIDERS_TABLE || 'proveedores';
const CLIENTS_TABLE = process.env.DB_CLIENTS_TABLE || 'clientes';
const ENTRIES_TABLE = process.env.DB_ENTRIES_TABLE || 'entradas_mercancia';
const ENTRADA_UNIDADES_TABLE = process.env.DB_ENTRADA_UNIDADES_TABLE || 'entrada_unidades';
const INVENTORY_TABLE = process.env.DB_INVENTORY_TABLE || 'inventario_existencias';
const MOVEMENTS_TABLE = process.env.DB_MOVEMENTS_TABLE || 'movimientos_inventario';
const PRODUCTS_TABLE = process.env.DB_PRODUCTS_TABLE || 'productos';
const SERVICE_TYPES_TABLE = process.env.DB_SERVICE_TYPES_TABLE || 'tipos_servicio';
const RAW_MATERIAL_LOTS_TABLE = process.env.DB_RAW_MATERIAL_LOTS_TABLE || 'lotes_materia_prima';
const MATURATION_SUBLOT_TABLE = process.env.DB_MATURATION_SUBLOT_TABLE || 'sublotes_maduracion';
const MATURATION_CONTROL_TABLE = process.env.DB_MATURATION_CONTROL_TABLE || 'control_maduracion';
const GREEN_NET_TABLE = process.env.DB_GREEN_NET_TABLE || 'redes_verde_detalle';
const CAT_MERMA_TABLE = process.env.DB_CAT_MERMA_TABLE || 'cat_tipos_merma';
const PRODUCTION_TABLE = process.env.DB_PRODUCTION_TABLE || 'procesos_produccion';
const PRODUCTION_STAGE_TABLE = process.env.DB_PRODUCTION_STAGE_TABLE || 'produccion_etapas';
const PRODUCTION_MERMA_TABLE = process.env.DB_PRODUCTION_MERMA_TABLE || 'produccion_mermas';
const PRODUCTION_INSUMO_TABLE = process.env.DB_PRODUCTION_INSUMO_TABLE || 'produccion_insumos';
const PRODUCTION_COLD_ROOM_TABLE =
  process.env.DB_PRODUCTION_COLD_ROOM_TABLE || 'produccion_cuartos_frio';
const VEHICLES_TABLE = process.env.DB_VEHICLES_TABLE || 'vehiculos';
const VEHICLE_SERVICES_TABLE = process.env.DB_VEHICLE_SERVICES_TABLE || 'servicios_vehiculo';
const VEHICLE_MILEAGE_REPORTS_TABLE =
  process.env.DB_VEHICLE_MILEAGE_REPORTS_TABLE || 'reporte_kilometraje_vehiculo';
const ACTIVE_STATE = 'Activo';
const INACTIVE_STATE = 'Inactivo';
const PENDING_STATE = 'Pendiente';
const COMPLETE_STATE = 'Completo';
const PRODUCTION_ACTIVE_STATE = 'En proceso';
const PRODUCTION_FINISHED_STATE = 'Finalizado';
const RAW_MATERIAL_PRODUCT_TYPE = 'Materia Prima';
const SUBLOT_ACTIVE_STATE = 'Activo';
const SUBLOT_READY_STATE = 'Listo para produccion';
const SUBLOT_SENT_STATE = 'Enviado a produccion';
const SUBLOT_GREEN_NET_STATE = 'Derivado a red';
const MATURE_RIPENESS_STATE = 'Maduro';
const MATURATION_BRIX_THRESHOLD = Number(process.env.MATURATION_BRIX_THRESHOLD) || 22;
const normalizeNullableText = (value) => (value === undefined || value === null || value === '' ? null : value);

const userQueries = {
  findAll: `SELECT id_usuario, nombre_completo, username, password_hash, rol, estado_registro, fecha_modificacion FROM ${USERS_TABLE} WHERE estado_registro = '${ACTIVE_STATE}'`,
  findById: `SELECT id_usuario, nombre_completo, username, password_hash, rol, estado_registro, fecha_modificacion FROM ${USERS_TABLE} WHERE id_usuario = ? AND estado_registro = '${ACTIVE_STATE}'`,
  findByUsername: `SELECT id_usuario, nombre_completo, username, password_hash, rol, estado_registro, fecha_modificacion FROM ${USERS_TABLE} WHERE username = ? AND estado_registro = '${ACTIVE_STATE}' LIMIT 1`,
};

const providerQueries = {
  findAll: `SELECT id_proveedor, nombre_empresa, nit, contacto_nombre, telefono, estado_registro, fecha_modificacion FROM ${PROVIDERS_TABLE} WHERE estado_registro = '${ACTIVE_STATE}'`,
  findById: `SELECT id_proveedor, nombre_empresa, nit, contacto_nombre, telefono, estado_registro, fecha_modificacion FROM ${PROVIDERS_TABLE} WHERE id_proveedor = ? AND estado_registro = '${ACTIVE_STATE}'`,
};

const clientQueries = {
  findAll: `SELECT id_cliente, nombre_comercial, direccion_entrega, telefono, nit_facturacion, estado_registro, fecha_modificacion FROM ${CLIENTS_TABLE} WHERE estado_registro = '${ACTIVE_STATE}'`,
  findById: `SELECT id_cliente, nombre_comercial, direccion_entrega, telefono, nit_facturacion, estado_registro, fecha_modificacion FROM ${CLIENTS_TABLE} WHERE id_cliente = ? AND estado_registro = '${ACTIVE_STATE}'`,
};

const entryQueries = {
  findAll: `SELECT e.id_entrada, e.id_proveedor, p.nombre_empresa, e.fecha_recepcion, e.documento_referencia, e.costo_unitario, e.costo_total, e.id_usuario_receptor, u.nombre_completo AS receptor_nombre, e.estado_registro, e.fecha_modificacion, ie.id_existencia, ie.id_producto, pr.nombre AS producto_nombre, ie.fecha_vencimiento, m.cantidad AS cantidad_disponible FROM ${ENTRIES_TABLE} e LEFT JOIN ${PROVIDERS_TABLE} p ON p.id_proveedor = e.id_proveedor AND p.estado_registro = '${ACTIVE_STATE}' LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = e.id_usuario_receptor AND u.estado_registro = '${ACTIVE_STATE}' LEFT JOIN (SELECT mm.id_movimiento, mm.id_existencia, mm.cantidad, mm.motivo FROM ${MOVEMENTS_TABLE} mm INNER JOIN (SELECT motivo, MAX(id_movimiento) AS id_movimiento FROM ${MOVEMENTS_TABLE} WHERE tipo_movimiento = 'Entrada' AND estado_registro = '${ACTIVE_STATE}' GROUP BY motivo) latest ON latest.id_movimiento = mm.id_movimiento WHERE mm.estado_registro = '${ACTIVE_STATE}') m ON m.motivo = CONCAT('Entrada de mercancia #', e.id_entrada) LEFT JOIN ${INVENTORY_TABLE} ie ON ie.id_existencia = m.id_existencia AND ie.estado_registro = '${ACTIVE_STATE}' LEFT JOIN ${PRODUCTS_TABLE} pr ON pr.id_producto = ie.id_producto AND pr.estado_registro = '${ACTIVE_STATE}' WHERE e.estado_registro IN ('${PENDING_STATE}', '${ACTIVE_STATE}') ORDER BY e.fecha_recepcion DESC, e.id_entrada DESC`,
  findById: `SELECT e.id_entrada, e.id_proveedor, p.nombre_empresa, e.fecha_recepcion, e.documento_referencia, e.costo_unitario, e.costo_total, e.id_usuario_receptor, u.nombre_completo AS receptor_nombre, e.estado_registro, e.fecha_modificacion, ie.id_existencia, ie.id_producto, pr.nombre AS producto_nombre, ie.fecha_vencimiento, m.cantidad AS cantidad_disponible FROM ${ENTRIES_TABLE} e LEFT JOIN ${PROVIDERS_TABLE} p ON p.id_proveedor = e.id_proveedor AND p.estado_registro = '${ACTIVE_STATE}' LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = e.id_usuario_receptor AND u.estado_registro = '${ACTIVE_STATE}' LEFT JOIN (SELECT mm.id_movimiento, mm.id_existencia, mm.cantidad, mm.motivo FROM ${MOVEMENTS_TABLE} mm INNER JOIN (SELECT motivo, MAX(id_movimiento) AS id_movimiento FROM ${MOVEMENTS_TABLE} WHERE tipo_movimiento = 'Entrada' AND estado_registro = '${ACTIVE_STATE}' GROUP BY motivo) latest ON latest.id_movimiento = mm.id_movimiento WHERE mm.estado_registro = '${ACTIVE_STATE}') m ON m.motivo = CONCAT('Entrada de mercancia #', e.id_entrada) LEFT JOIN ${INVENTORY_TABLE} ie ON ie.id_existencia = m.id_existencia AND ie.estado_registro = '${ACTIVE_STATE}' LEFT JOIN ${PRODUCTS_TABLE} pr ON pr.id_producto = ie.id_producto AND pr.estado_registro = '${ACTIVE_STATE}' WHERE e.id_entrada = ? AND e.estado_registro IN ('${PENDING_STATE}', '${ACTIVE_STATE}')`,
};

const inventoryQueries = {
  findAll: `SELECT base.id_existencia, base.id_producto, base.producto_nombre, base.tipo_producto, base.id_proveedor, base.nombre_empresa, base.id_proceso_origen, base.id_entrada_origen, base.fecha_entrada, base.fecha_vencimiento, base.cantidad_disponible, base.costo_unitario, base.estado_registro, base.fecha_modificacion, base.id_lote_mp, base.peso_inicial_kg FROM (SELECT ie.id_existencia, ie.id_producto, pr.nombre AS producto_nombre, pr.tipo_producto AS tipo_producto, ie.id_proveedor, p.nombre_empresa, ie.id_proceso_origen, ie.id_entrada_origen, ie.fecha_entrada, ie.fecha_vencimiento, COALESCE(stock.cantidad_disponible, ie.cantidad_disponible, 0) AS cantidad_disponible, ie.costo_unitario, ie.estado_registro, ie.fecha_modificacion, NULL AS id_lote_mp, NULL AS peso_inicial_kg FROM ${INVENTORY_TABLE} ie LEFT JOIN ${PRODUCTS_TABLE} pr ON pr.id_producto = ie.id_producto AND pr.estado_registro = '${ACTIVE_STATE}' LEFT JOIN ${PROVIDERS_TABLE} p ON p.id_proveedor = ie.id_proveedor AND p.estado_registro = '${ACTIVE_STATE}' LEFT JOIN (SELECT id_existencia, SUM(CASE WHEN tipo_movimiento = 'Entrada' THEN cantidad WHEN tipo_movimiento IN ('Salida', 'Ajuste', 'Desperdicio') THEN -cantidad ELSE 0 END) AS cantidad_disponible FROM ${MOVEMENTS_TABLE} WHERE estado_registro = '${ACTIVE_STATE}' GROUP BY id_existencia) stock ON stock.id_existencia = ie.id_existencia WHERE ie.estado_registro = '${ACTIVE_STATE}' UNION ALL SELECT NULL AS id_existencia, l.id_producto, pr.nombre AS producto_nombre, 'Fruta para produccion' AS tipo_producto, NULL AS id_proveedor, NULL AS nombre_empresa, NULL AS id_proceso_origen, l.id_entrada_origen, l.fecha_recepcion AS fecha_entrada, NULL AS fecha_vencimiento, COALESCE(sub.peso_disponible, 0) AS cantidad_disponible, NULL AS costo_unitario, '${COMPLETE_STATE}' AS estado_registro, sub.fecha_modificacion, l.id_lote_mp, l.peso_inicial_kg FROM ${RAW_MATERIAL_LOTS_TABLE} l INNER JOIN (SELECT id_lote_mp, SUM(peso_kg) AS peso_disponible, MAX(fecha_modificacion) AS fecha_modificacion FROM ${MATURATION_SUBLOT_TABLE} GROUP BY id_lote_mp) sub ON sub.id_lote_mp = l.id_lote_mp LEFT JOIN ${PRODUCTS_TABLE} pr ON pr.id_producto = l.id_producto AND pr.estado_registro = '${ACTIVE_STATE}') base ORDER BY base.fecha_entrada DESC, base.id_existencia DESC, base.id_entrada_origen DESC`,
};

const movementQueries = {
  findAll: `SELECT m.id_movimiento, m.id_existencia, m.tipo_movimiento, m.cantidad, m.motivo, m.fecha_movimiento, m.id_usuario, u.nombre_completo AS usuario_nombre, m.estado_registro, m.fecha_modificacion FROM ${MOVEMENTS_TABLE} m LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = m.id_usuario AND u.estado_registro = '${ACTIVE_STATE}' WHERE m.estado_registro = '${ACTIVE_STATE}' ORDER BY m.fecha_movimiento DESC, m.id_movimiento DESC`,
};

const productQueries = {
  findAll: `SELECT id_producto, nombre, descripcion, unidad_medida, tipo_producto, stock_minimo, precio_venta_sugerido, estado_registro, fecha_modificacion FROM ${PRODUCTS_TABLE} WHERE estado_registro = '${ACTIVE_STATE}'`,
  findById: `SELECT id_producto, nombre, descripcion, unidad_medida, tipo_producto, stock_minimo, precio_venta_sugerido, estado_registro, fecha_modificacion FROM ${PRODUCTS_TABLE} WHERE id_producto = ? AND estado_registro = '${ACTIVE_STATE}'`,
};

const serviceTypeQueries = {
  findAll: `SELECT id_tipo_servicio, nombre_servicio, descripcion, km_frecuencia FROM ${SERVICE_TYPES_TABLE} ORDER BY nombre_servicio ASC, id_tipo_servicio ASC`,
  findById: `SELECT id_tipo_servicio, nombre_servicio, descripcion, km_frecuencia FROM ${SERVICE_TYPES_TABLE} WHERE id_tipo_servicio = ?`,
};

const mermaTypeQueries = {
  findAll: `SELECT id_tipo_merma, nombre_merma, descripcion, estado_registro FROM ${CAT_MERMA_TABLE} WHERE estado_registro = '${ACTIVE_STATE}' ORDER BY nombre_merma ASC`,
};

const maturationLotQueries = {
  findAll: `SELECT l.id_lote_mp, l.id_producto, p.nombre AS producto_nombre, l.id_proveedor, pr.nombre_empresa AS proveedor_nombre, l.id_entrada_origen, l.fecha_recepcion, l.cantidad_unidades, l.peso_inicial_kg, COALESCE(sub.peso_disponible_kg, 0) AS peso_disponible_kg, l.estado_maduracion, l.estado_registro FROM ${RAW_MATERIAL_LOTS_TABLE} l LEFT JOIN ${PRODUCTS_TABLE} p ON p.id_producto = l.id_producto LEFT JOIN ${PROVIDERS_TABLE} pr ON pr.id_proveedor = l.id_proveedor LEFT JOIN (SELECT id_lote_mp, SUM(peso_kg) AS peso_disponible_kg FROM ${MATURATION_SUBLOT_TABLE} GROUP BY id_lote_mp) sub ON sub.id_lote_mp = l.id_lote_mp WHERE l.estado_registro <> '${INACTIVE_STATE}' ORDER BY l.fecha_recepcion DESC, l.id_lote_mp DESC`,
  findById: `SELECT l.id_lote_mp, l.id_producto, p.nombre AS producto_nombre, l.id_proveedor, pr.nombre_empresa AS proveedor_nombre, l.id_entrada_origen, l.fecha_recepcion, l.cantidad_unidades, l.peso_inicial_kg, COALESCE(sub.peso_disponible_kg, 0) AS peso_disponible_kg, l.estado_maduracion, l.estado_registro FROM ${RAW_MATERIAL_LOTS_TABLE} l LEFT JOIN ${PRODUCTS_TABLE} p ON p.id_producto = l.id_producto LEFT JOIN ${PROVIDERS_TABLE} pr ON pr.id_proveedor = l.id_proveedor LEFT JOIN (SELECT id_lote_mp, SUM(peso_kg) AS peso_disponible_kg FROM ${MATURATION_SUBLOT_TABLE} GROUP BY id_lote_mp) sub ON sub.id_lote_mp = l.id_lote_mp WHERE l.id_lote_mp = ? AND l.estado_registro <> '${INACTIVE_STATE}'`,
  findForUpdate: `SELECT id_lote_mp, id_producto, id_proveedor, peso_inicial_kg, cantidad_unidades, estado_maduracion, estado_registro FROM ${RAW_MATERIAL_LOTS_TABLE} WHERE id_lote_mp = ? AND estado_registro <> '${INACTIVE_STATE}' FOR UPDATE`,
};

const maturationSublotBaseQuery = `SELECT s.id_sublote, s.id_lote_mp, s.codigo_sublote, s.peso_inicial_kg, s.peso_kg, s.peso_neto_maduracion_kg, s.perdida_maduracion_kg, s.cantidad_unidades, s.estado_maduracion, s.estado_registro, s.observaciones, s.fecha_creacion, s.fecha_modificacion, l.id_producto, p.nombre AS producto_nombre, l.id_proveedor, pr.nombre_empresa AS proveedor_nombre FROM ${MATURATION_SUBLOT_TABLE} s LEFT JOIN ${RAW_MATERIAL_LOTS_TABLE} l ON l.id_lote_mp = s.id_lote_mp LEFT JOIN ${PRODUCTS_TABLE} p ON p.id_producto = l.id_producto LEFT JOIN ${PROVIDERS_TABLE} pr ON pr.id_proveedor = l.id_proveedor`;

const maturationSublotQueries = {
  findAll: `${maturationSublotBaseQuery} WHERE s.estado_registro <> '${INACTIVE_STATE}' ORDER BY s.fecha_creacion DESC, s.id_sublote DESC`,
  findById: `${maturationSublotBaseQuery} WHERE s.id_sublote = ?`,
  findByLot: `${maturationSublotBaseQuery} WHERE s.id_lote_mp = ? ORDER BY s.codigo_sublote ASC`,
  findReadyForProduction: `${maturationSublotBaseQuery} WHERE s.estado_registro = '${SUBLOT_READY_STATE}' ORDER BY s.fecha_modificacion ASC`,
  findForUpdate: `SELECT id_sublote, id_lote_mp, codigo_sublote, peso_inicial_kg, peso_kg, peso_neto_maduracion_kg, perdida_maduracion_kg, cantidad_unidades, estado_maduracion, estado_registro FROM ${MATURATION_SUBLOT_TABLE} WHERE id_sublote = ? FOR UPDATE`,
  countByLot: `SELECT COUNT(*) AS total FROM ${MATURATION_SUBLOT_TABLE} WHERE id_lote_mp = ?`,
  latestMeasuredWeight: `SELECT peso_medido_kg FROM ${MATURATION_CONTROL_TABLE} WHERE id_sublote = ? AND peso_medido_kg IS NOT NULL ORDER BY fecha_medicion DESC, id_control DESC LIMIT 1`,
};

const maturationControlBaseQuery = `SELECT c.id_control, c.id_sublote, c.fecha_medicion, c.grados_brix, c.peso_medido_kg, c.porcentaje_materia_seca, c.temperatura_cuarto, c.observaciones, s.codigo_sublote, s.id_lote_mp, s.estado_maduracion, s.estado_registro AS sublote_estado_registro, l.id_producto, p.nombre AS producto_nombre, l.id_proveedor, pr.nombre_empresa AS proveedor_nombre FROM ${MATURATION_CONTROL_TABLE} c LEFT JOIN ${MATURATION_SUBLOT_TABLE} s ON s.id_sublote = c.id_sublote LEFT JOIN ${RAW_MATERIAL_LOTS_TABLE} l ON l.id_lote_mp = s.id_lote_mp LEFT JOIN ${PRODUCTS_TABLE} p ON p.id_producto = l.id_producto LEFT JOIN ${PROVIDERS_TABLE} pr ON pr.id_proveedor = l.id_proveedor`;

const maturationControlQueries = {
  findAll: `${maturationControlBaseQuery} ORDER BY c.fecha_medicion DESC, c.id_control DESC`,
  findById: `${maturationControlBaseQuery} WHERE c.id_control = ?`,
  findBySublot: `${maturationControlBaseQuery} WHERE c.id_sublote = ? ORDER BY c.fecha_medicion DESC, c.id_control DESC`,
};

const greenNetQueries = {
  findBySublot: `SELECT r.id_red, r.id_sublote, r.id_existencia, r.peso_kg, r.id_usuario, u.nombre_completo AS usuario_nombre, r.fecha_empaque FROM ${GREEN_NET_TABLE} r LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = r.id_usuario WHERE r.id_sublote = ? ORDER BY r.fecha_empaque DESC, r.id_red DESC`,
};

const productionProcessBaseQuery = `SELECT p.id_proceso, p.id_sublote, p.id_producto_resultado, p.cantidad_ingresada_kg, p.cantidad_producida_kg, p.rendimiento_porcentaje, p.estado_proceso, p.fecha_inicio, p.fecha_fin, p.cuarto_congelado, p.ubicacion_cuarto_congelado, p.observaciones, p.id_usuario_registro, u.nombre_completo AS usuario_nombre, s.codigo_sublote, s.peso_kg AS sublote_peso_disponible, s.peso_neto_maduracion_kg, s.estado_maduracion, l.id_lote_mp, l.id_proveedor AS id_proveedor_origen, l.id_producto AS id_producto_origen, lp.nombre AS lote_producto_nombre, pr.nombre AS producto_resultado_nombre, pr.unidad_medida AS producto_resultado_unidad FROM ${PRODUCTION_TABLE} p LEFT JOIN ${MATURATION_SUBLOT_TABLE} s ON s.id_sublote = p.id_sublote LEFT JOIN ${RAW_MATERIAL_LOTS_TABLE} l ON l.id_lote_mp = s.id_lote_mp LEFT JOIN ${PRODUCTS_TABLE} lp ON lp.id_producto = l.id_producto LEFT JOIN ${PRODUCTS_TABLE} pr ON pr.id_producto = p.id_producto_resultado LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = p.id_usuario_registro WHERE p.estado_registro <> '${INACTIVE_STATE}'`;

const productionProcessListQuery = `SELECT base.*, COALESCE(etapas.total_etapas, 0) AS total_etapas, COALESCE(etapas.etapa_actual, '-') AS etapa_actual, COALESCE(mermas.total_merma_kg, 0) AS total_merma_kg, COALESCE(insumos.total_insumos, 0) AS total_insumos, COALESCE(cuartos.total_cuartos, 0) AS total_cuartos FROM (${productionProcessBaseQuery}) base LEFT JOIN (SELECT id_proceso, COUNT(*) AS total_etapas, MAX(nombre_etapa) AS etapa_actual FROM ${PRODUCTION_STAGE_TABLE} WHERE estado_registro = '${ACTIVE_STATE}' GROUP BY id_proceso) etapas ON etapas.id_proceso = base.id_proceso LEFT JOIN (SELECT id_proceso, SUM(cantidad_kg) AS total_merma_kg FROM ${PRODUCTION_MERMA_TABLE} WHERE estado_registro = '${ACTIVE_STATE}' GROUP BY id_proceso) mermas ON mermas.id_proceso = base.id_proceso LEFT JOIN (SELECT id_proceso, COUNT(*) AS total_insumos FROM ${PRODUCTION_INSUMO_TABLE} WHERE estado_registro = '${ACTIVE_STATE}' GROUP BY id_proceso) insumos ON insumos.id_proceso = base.id_proceso LEFT JOIN (SELECT id_proceso, COUNT(*) AS total_cuartos FROM ${PRODUCTION_COLD_ROOM_TABLE} WHERE estado_registro = '${ACTIVE_STATE}' GROUP BY id_proceso) cuartos ON cuartos.id_proceso = base.id_proceso ORDER BY base.fecha_inicio DESC, base.id_proceso DESC`;

const productionStageQueries = {
  findByProcess: `SELECT id_etapa, id_proceso, nombre_etapa, fecha_inicio, fecha_fin, personal_asignado, cantidad_entrada_kg, cantidad_salida_kg, merma_kg, observaciones, estado_registro, fecha_creacion, fecha_modificacion FROM ${PRODUCTION_STAGE_TABLE} WHERE id_proceso = ? AND estado_registro = '${ACTIVE_STATE}' ORDER BY fecha_inicio ASC, id_etapa ASC`,
  findById: `SELECT id_etapa, id_proceso, nombre_etapa, fecha_inicio, fecha_fin, personal_asignado, cantidad_entrada_kg, cantidad_salida_kg, merma_kg, observaciones, estado_registro, fecha_creacion, fecha_modificacion FROM ${PRODUCTION_STAGE_TABLE} WHERE id_etapa = ?`,
};

const productionMermaQueries = {
  findByProcess: `SELECT m.id_merma, m.id_proceso, m.id_etapa, m.id_tipo_merma, ctm.nombre_merma, m.cantidad_kg, m.observaciones, m.fecha_registro, m.estado_registro, m.fecha_creacion, m.fecha_modificacion FROM ${PRODUCTION_MERMA_TABLE} m LEFT JOIN ${CAT_MERMA_TABLE} ctm ON ctm.id_tipo_merma = m.id_tipo_merma WHERE m.id_proceso = ? AND m.estado_registro = '${ACTIVE_STATE}' ORDER BY m.fecha_registro DESC, m.id_merma DESC`,
  findById: `SELECT m.id_merma, m.id_proceso, m.id_etapa, m.id_tipo_merma, ctm.nombre_merma, m.cantidad_kg, m.observaciones, m.fecha_registro, m.estado_registro, m.fecha_creacion, m.fecha_modificacion FROM ${PRODUCTION_MERMA_TABLE} m LEFT JOIN ${CAT_MERMA_TABLE} ctm ON ctm.id_tipo_merma = m.id_tipo_merma WHERE m.id_merma = ?`,
};

const productionInsumoQueries = {
  findByProcess: `SELECT i.id_consumo, i.id_proceso, i.id_etapa, i.id_producto, prd.nombre AS producto_nombre, i.cantidad, i.unidad_medida, i.observaciones, i.fecha_registro, i.estado_registro, i.fecha_creacion, i.fecha_modificacion FROM ${PRODUCTION_INSUMO_TABLE} i LEFT JOIN ${PRODUCTS_TABLE} prd ON prd.id_producto = i.id_producto WHERE i.id_proceso = ? AND i.estado_registro = '${ACTIVE_STATE}' ORDER BY i.fecha_registro DESC, i.id_consumo DESC`,
  findById: `SELECT i.id_consumo, i.id_proceso, i.id_etapa, i.id_producto, prd.nombre AS producto_nombre, i.cantidad, i.unidad_medida, i.observaciones, i.fecha_registro, i.estado_registro, i.fecha_creacion, i.fecha_modificacion FROM ${PRODUCTION_INSUMO_TABLE} i LEFT JOIN ${PRODUCTS_TABLE} prd ON prd.id_producto = i.id_producto WHERE i.id_consumo = ?`,
};

const productionColdRoomQueries = {
  findByProcess: `SELECT id_ingreso_cuarto, id_proceso, fecha_ingreso, ubicacion_cuarto, cantidad_kg, observaciones, estado_registro, fecha_creacion, fecha_modificacion FROM ${PRODUCTION_COLD_ROOM_TABLE} WHERE id_proceso = ? AND estado_registro = '${ACTIVE_STATE}' ORDER BY fecha_ingreso DESC, id_ingreso_cuarto DESC`,
  findById: `SELECT id_ingreso_cuarto, id_proceso, fecha_ingreso, ubicacion_cuarto, cantidad_kg, observaciones, estado_registro, fecha_creacion, fecha_modificacion FROM ${PRODUCTION_COLD_ROOM_TABLE} WHERE id_ingreso_cuarto = ?`,
};

const productionProcessQueries = {
  findById: `SELECT id_proceso, id_sublote, id_producto_resultado, cantidad_ingresada_kg, cantidad_producida_kg, rendimiento_porcentaje, estado_proceso, fecha_inicio, fecha_fin, cuarto_congelado, ubicacion_cuarto_congelado, observaciones, id_usuario_registro, estado_registro FROM ${PRODUCTION_TABLE} WHERE id_proceso = ? AND estado_registro <> '${INACTIVE_STATE}'`,
  findSublotForUpdate: `SELECT id_sublote, id_lote_mp, peso_kg, peso_neto_maduracion_kg, estado_registro, estado_maduracion FROM ${MATURATION_SUBLOT_TABLE} WHERE id_sublote = ? FOR UPDATE`,
  findInsumoExistencia: `SELECT ie.id_existencia, COALESCE(stock.cantidad_disponible, 0) AS cantidad_disponible FROM ${INVENTORY_TABLE} ie LEFT JOIN (SELECT id_existencia, SUM(CASE WHEN tipo_movimiento = 'Entrada' THEN cantidad WHEN tipo_movimiento IN ('Salida', 'Ajuste', 'Desperdicio') THEN -cantidad ELSE 0 END) AS cantidad_disponible FROM ${MOVEMENTS_TABLE} WHERE estado_registro = '${ACTIVE_STATE}' GROUP BY id_existencia) stock ON stock.id_existencia = ie.id_existencia WHERE ie.id_producto = ? AND ie.estado_registro = '${ACTIVE_STATE}' ORDER BY ie.fecha_vencimiento ASC, ie.id_existencia ASC FOR UPDATE`,
};

const closeSublote = async (connection, id, explicitPesoMedido, { silent = false } = {}) => {
  const [sublotRows] = await connection.query(maturationSublotQueries.findForUpdate, [id]);

  if (sublotRows.length === 0 || sublotRows[0].estado_registro !== SUBLOT_ACTIVE_STATE) {
    if (silent) {
      return null;
    }
    throw new Error('El sub-lote no esta disponible para cerrar maduracion');
  }

  const sublot = sublotRows[0];
  let pesoMedido =
    explicitPesoMedido === undefined || explicitPesoMedido === null || explicitPesoMedido === ''
      ? null
      : Number(explicitPesoMedido);

  if (pesoMedido === null) {
    const [latestRows] = await connection.query(maturationSublotQueries.latestMeasuredWeight, [id]);
    pesoMedido =
      latestRows[0]?.peso_medido_kg !== undefined && latestRows[0]?.peso_medido_kg !== null
        ? Number(latestRows[0].peso_medido_kg)
        : null;
  }

  if (pesoMedido === null || Number.isNaN(pesoMedido)) {
    if (silent) {
      return null;
    }
    throw new Error('Se requiere peso_medido_kg para cerrar la maduracion; no hay mediciones previas con peso capturado');
  }

  const perdida = Number(sublot.peso_kg) - pesoMedido;

  if (perdida < 0) {
    if (silent) {
      return null;
    }
    throw new Error('El peso medido no puede ser mayor al peso disponible del sub-lote');
  }

  await connection.query(
    `UPDATE ${MATURATION_SUBLOT_TABLE} SET peso_neto_maduracion_kg = ?, perdida_maduracion_kg = ?, estado_registro = '${SUBLOT_READY_STATE}' WHERE id_sublote = ?`,
    [pesoMedido, perdida, id]
  );

  const [rows] = await connection.query(`${maturationSublotBaseQuery} WHERE s.id_sublote = ?`, [id]);
  return rows[0] || null;
};

const loadProductionProcessDetail = async (connection, id) => {
  const [processRows] = await connection.query(productionProcessBaseQuery + ' AND p.id_proceso = ? LIMIT 1', [id]);

  if (processRows.length === 0) {
    return null;
  }

  const [etapas] = await connection.query(productionStageQueries.findByProcess, [id]);
  const [mermas] = await connection.query(productionMermaQueries.findByProcess, [id]);
  const [insumos] = await connection.query(productionInsumoQueries.findByProcess, [id]);
  const [cuartosFrio] = await connection.query(productionColdRoomQueries.findByProcess, [id]);

  const process = processRows[0];
  const totalMermaKg = mermas.reduce((sum, item) => sum + (Number(item.cantidad_kg) || 0), 0);
  const totalInsumos = insumos.reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0);

  return {
    ...process,
    total_merma_kg: totalMermaKg,
    total_insumos: totalInsumos,
    etapas,
    mermas,
    insumos,
    cuartos_frio: cuartosFrio,
  };
};

const vehicleQueries = {
  findAll: `SELECT id_vehiculo, placa, modelo, estado, kilometraje_actual, estado_registro, fecha_modificacion FROM ${VEHICLES_TABLE} WHERE estado_registro = '${ACTIVE_STATE}'`,
  findById: `SELECT id_vehiculo, placa, modelo, estado, kilometraje_actual, estado_registro, fecha_modificacion FROM ${VEHICLES_TABLE} WHERE id_vehiculo = ? AND estado_registro = '${ACTIVE_STATE}'`,
};

const vehicleServiceQueries = {
  findAll: `SELECT sv.id_servicio, sv.id_vehiculo, v.placa AS vehiculo_placa, v.modelo AS vehiculo_modelo, sv.id_tipo_servicio, ts.nombre_servicio AS tipo_servicio_nombre, sv.fecha_servicio, sv.km_en_servicio, sv.costo_servicio, sv.proximo_servicio_km, sv.notas FROM ${VEHICLE_SERVICES_TABLE} sv LEFT JOIN ${VEHICLES_TABLE} v ON v.id_vehiculo = sv.id_vehiculo LEFT JOIN ${SERVICE_TYPES_TABLE} ts ON ts.id_tipo_servicio = sv.id_tipo_servicio ORDER BY sv.fecha_servicio DESC, sv.id_servicio DESC`,
  findById: `SELECT sv.id_servicio, sv.id_vehiculo, v.placa AS vehiculo_placa, v.modelo AS vehiculo_modelo, sv.id_tipo_servicio, ts.nombre_servicio AS tipo_servicio_nombre, sv.fecha_servicio, sv.km_en_servicio, sv.costo_servicio, sv.proximo_servicio_km, sv.notas FROM ${VEHICLE_SERVICES_TABLE} sv LEFT JOIN ${VEHICLES_TABLE} v ON v.id_vehiculo = sv.id_vehiculo LEFT JOIN ${SERVICE_TYPES_TABLE} ts ON ts.id_tipo_servicio = sv.id_tipo_servicio WHERE sv.id_servicio = ?`,
};

const vehicleMileageReportQueries = {
  findAll: `SELECT r.id_reporte_kilometraje, r.id_vehiculo, v.placa AS vehiculo_placa, v.modelo AS vehiculo_modelo, r.id_usuario_modificador, u.nombre_completo AS usuario_nombre, u.username, r.kilometraje_registrado, r.fecha_reporte FROM ${VEHICLE_MILEAGE_REPORTS_TABLE} r LEFT JOIN ${VEHICLES_TABLE} v ON v.id_vehiculo = r.id_vehiculo LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = r.id_usuario_modificador ORDER BY r.fecha_reporte DESC, r.id_reporte_kilometraje DESC`,
};

const handlers = {
  'users.findAll': async () => {
    const [rows] = await pool.query(userQueries.findAll);
    return rows;
  },
  'users.findById': async ({ id }) => {
    const [rows] = await pool.query(userQueries.findById, [id]);
    return rows[0] || null;
  },
  'users.findByUsername': async ({ username }) => {
    const [rows] = await pool.query(userQueries.findByUsername, [username]);
    return rows[0] || null;
  },
  'users.create': async ({ nombre_completo, username, password_hash, rol, estado_registro }) => {
    const [result] = await pool.query(
      `INSERT INTO ${USERS_TABLE} (nombre_completo, username, password_hash, rol, estado_registro) VALUES (?, ?, ?, ?, ?)`,
      [nombre_completo, username, password_hash, rol, estado_registro || ACTIVE_STATE]
    );
    const [rows] = await pool.query(userQueries.findById, [result.insertId]);
    return rows[0] || null;
  },
  'users.update': async ({ id, nombre_completo, username, password_hash, rol, estado_registro }) => {
    const [result] = await pool.query(
      `UPDATE ${USERS_TABLE} SET nombre_completo = ?, username = ?, password_hash = ?, rol = ?, estado_registro = COALESCE(?, estado_registro) WHERE id_usuario = ? AND estado_registro = '${ACTIVE_STATE}'`,
      [nombre_completo, username, password_hash, rol, estado_registro ?? null, id]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    const [rows] = await pool.query(userQueries.findById, [id]);
    return rows[0] || null;
  },
  'users.resetPassword': async ({ id, password_hash }) => {
    const [result] = await pool.query(
      `UPDATE ${USERS_TABLE} SET password_hash = ? WHERE id_usuario = ? AND estado_registro = '${ACTIVE_STATE}'`,
      [password_hash, id]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    const [rows] = await pool.query(userQueries.findById, [id]);
    return rows[0] || null;
  },
  'users.remove': async ({ id }) => {
    const [result] = await pool.query(
      `UPDATE ${USERS_TABLE} SET estado_registro = '${INACTIVE_STATE}' WHERE id_usuario = ? AND estado_registro = '${ACTIVE_STATE}'`,
      [id]
    );
    return result.affectedRows > 0;
  },
  'providers.findAll': async () => {
    const [rows] = await pool.query(providerQueries.findAll);
    return rows;
  },
  'providers.findById': async ({ id }) => {
    const [rows] = await pool.query(providerQueries.findById, [id]);
    return rows[0] || null;
  },
  'providers.create': async ({ nombre_empresa, nit, contacto_nombre, telefono, estado_registro }) => {
    const [result] = await pool.query(
      `INSERT INTO ${PROVIDERS_TABLE} (nombre_empresa, nit, contacto_nombre, telefono, estado_registro) VALUES (?, ?, ?, ?, ?)`,
      [nombre_empresa, nit ?? null, contacto_nombre ?? null, telefono ?? null, estado_registro || ACTIVE_STATE]
    );

    const [rows] = await pool.query(providerQueries.findById, [result.insertId]);
    return rows[0] || null;
  },
  'providers.update': async ({ id, nombre_empresa, nit, contacto_nombre, telefono, estado_registro }) => {
    const [result] = await pool.query(
      `UPDATE ${PROVIDERS_TABLE} SET nombre_empresa = ?, nit = ?, contacto_nombre = ?, telefono = ?, estado_registro = COALESCE(?, estado_registro) WHERE id_proveedor = ? AND estado_registro = '${ACTIVE_STATE}'`,
      [nombre_empresa, nit ?? null, contacto_nombre ?? null, telefono ?? null, estado_registro ?? null, id]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    const [rows] = await pool.query(providerQueries.findById, [id]);
    return rows[0] || null;
  },
  'providers.remove': async ({ id }) => {
    const [result] = await pool.query(
      `UPDATE ${PROVIDERS_TABLE} SET estado_registro = '${INACTIVE_STATE}' WHERE id_proveedor = ? AND estado_registro = '${ACTIVE_STATE}'`,
      [id]
    );
    return result.affectedRows > 0;
  },
  'clients.findAll': async () => {
    const [rows] = await pool.query(clientQueries.findAll);
    return rows;
  },
  'clients.findById': async ({ id }) => {
    const [rows] = await pool.query(clientQueries.findById, [id]);
    return rows[0] || null;
  },
  'clients.create': async ({
    nombre_comercial,
    direccion_entrega,
    telefono,
    nit_facturacion,
    estado_registro,
  }) => {
    const [result] = await pool.query(
      `INSERT INTO ${CLIENTS_TABLE} (nombre_comercial, direccion_entrega, telefono, nit_facturacion, estado_registro) VALUES (?, ?, ?, ?, ?)`,
      [
        nombre_comercial,
        normalizeNullableText(direccion_entrega),
        normalizeNullableText(telefono),
        normalizeNullableText(nit_facturacion),
        estado_registro || ACTIVE_STATE,
      ]
    );

    const [rows] = await pool.query(clientQueries.findById, [result.insertId]);
    return rows[0] || null;
  },
  'clients.update': async ({
    id,
    nombre_comercial,
    direccion_entrega,
    telefono,
    nit_facturacion,
    estado_registro,
  }) => {
    const [result] = await pool.query(
      `UPDATE ${CLIENTS_TABLE} SET nombre_comercial = ?, direccion_entrega = ?, telefono = ?, nit_facturacion = ?, estado_registro = COALESCE(?, estado_registro) WHERE id_cliente = ? AND estado_registro = '${ACTIVE_STATE}'`,
      [
        nombre_comercial,
        normalizeNullableText(direccion_entrega),
        normalizeNullableText(telefono),
        normalizeNullableText(nit_facturacion),
        estado_registro ?? null,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    const [rows] = await pool.query(clientQueries.findById, [id]);
    return rows[0] || null;
  },
  'clients.remove': async ({ id }) => {
    const [result] = await pool.query(
      `UPDATE ${CLIENTS_TABLE} SET estado_registro = '${INACTIVE_STATE}' WHERE id_cliente = ? AND estado_registro = '${ACTIVE_STATE}'`,
      [id]
    );
    return result.affectedRows > 0;
  },
  'entries.findAll': async () => {
    const [rows] = await pool.query(entryQueries.findAll);
    return rows;
  },
  'entries.findById': async ({ id }) => {
    const [rows] = await pool.query(entryQueries.findById, [id]);
    return rows[0] || null;
  },
  'entries.create': async ({
    id_proveedor,
    id_producto,
    fecha_vencimiento,
    cantidad_disponible,
    costo_unitario,
    documento_referencia,
    id_usuario_receptor,
    unidades,
  }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [entryResult] = await connection.query(
        `INSERT INTO ${ENTRIES_TABLE} (id_proveedor, documento_referencia, costo_unitario, costo_total, id_usuario_receptor, estado_registro) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id_proveedor,
          normalizeNullableText(documento_referencia),
          normalizeNullableText(costo_unitario),
          normalizeNullableText(costo_unitario) === null ? null : Number(costo_unitario) * Number(cantidad_disponible),
          id_usuario_receptor,
          ACTIVE_STATE,
        ]
      );

      const [existingExistencias] = await connection.query(
        `SELECT id_existencia, cantidad_disponible, costo_unitario FROM ${INVENTORY_TABLE} WHERE id_producto = ? AND id_proveedor = ? AND estado_registro = '${ACTIVE_STATE}' ORDER BY id_existencia ASC LIMIT 1`,
        [id_producto, id_proveedor]
      );

      let existenciaId;

      if (existingExistencias.length > 0) {
        existenciaId = existingExistencias[0].id_existencia;

        await connection.query(
          `UPDATE ${INVENTORY_TABLE} SET id_proveedor = ?, fecha_vencimiento = ? WHERE id_existencia = ?`,
          [
            id_proveedor,
            fecha_vencimiento,
            existenciaId,
          ]
        );
      } else {
        const [existenceResult] = await connection.query(
          `INSERT INTO ${INVENTORY_TABLE} (id_producto, id_proveedor, id_proceso_origen, id_entrada_origen, fecha_vencimiento, cantidad_disponible, costo_unitario, estado_registro) VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`,
          [
            id_producto,
            id_proveedor,
            entryResult.insertId,
            fecha_vencimiento,
            0,
            normalizeNullableText(costo_unitario),
            ACTIVE_STATE,
          ]
        );

        existenciaId = existenceResult.insertId;
      }

      await connection.query(
        `INSERT INTO ${MOVEMENTS_TABLE} (id_existencia, tipo_movimiento, cantidad, motivo, id_usuario, estado_registro) VALUES (?, 'Entrada', ?, ?, ?, ?)`,
        [
          existenciaId,
          cantidad_disponible,
          `Entrada de mercancia #${entryResult.insertId}`,
          id_usuario_receptor,
          ACTIVE_STATE,
        ]
      );

      const [avgCostRows] = await connection.query(
        `SELECT SUM(e.costo_unitario * m.cantidad) / NULLIF(SUM(m.cantidad), 0) AS avg_cost FROM ${ENTRIES_TABLE} e INNER JOIN ${MOVEMENTS_TABLE} m ON m.motivo = CONCAT('Entrada de mercancia #', e.id_entrada) AND m.id_existencia = ? AND m.tipo_movimiento = 'Entrada' AND m.estado_registro = '${ACTIVE_STATE}' WHERE e.estado_registro = '${ACTIVE_STATE}' AND e.costo_unitario IS NOT NULL`,
        [existenciaId]
      );

      const avgCost = avgCostRows[0]?.avg_cost ?? null;
      await connection.query(
        `UPDATE ${INVENTORY_TABLE} SET costo_unitario = ? WHERE id_existencia = ?`,
        [avgCost, existenciaId]
      );

      const [productRows] = await connection.query(
        `SELECT tipo_producto FROM ${PRODUCTS_TABLE} WHERE id_producto = ? AND estado_registro = '${ACTIVE_STATE}' LIMIT 1`,
        [id_producto]
      );

      if (productRows.length > 0 && productRows[0].tipo_producto === RAW_MATERIAL_PRODUCT_TYPE) {
        // Si se proporcionaron unidades pequeñas, insertar los datos asociados y usar la sumatoria de pesos
        let cantidadUnidades = null;
        let pesoInicialKg = Number(cantidad_disponible);

        if (Array.isArray(unidades) && unidades.length > 0) {
          cantidadUnidades = unidades.length;
          const totalPeso = unidades.reduce((sum, u) => sum + (u && u.peso ? Number(u.peso) : 0), 0);
          pesoInicialKg = totalPeso;
        }

        const [lotResult] = await connection.query(
          `INSERT INTO ${RAW_MATERIAL_LOTS_TABLE} (id_producto, id_proveedor, id_entrada_origen, fecha_recepcion, cantidad_unidades, peso_inicial_kg, estado_maduracion, estado_registro) VALUES (?, ?, ?, CURRENT_DATE, ?, ?, ?, ?)`,
          [
            id_producto,
            id_proveedor,
            entryResult.insertId,
            cantidadUnidades,
            pesoInicialKg,
            'Verde',
            PENDING_STATE,
          ]
        );

        // Si hay unidades, insertarlas en entrada_unidades vinculadas a la entrada creada
        if (Array.isArray(unidades) && unidades.length > 0) {
          const insertUnitQuery = `INSERT INTO ${ENTRADA_UNIDADES_TABLE} (id_entrada, unidad_codigo, peso, creado_por, fecha_pesos, created_at) VALUES (?, ?, ?, ?, COALESCE(?, NOW()), NOW())`;
          for (let i = 0; i < unidades.length; i++) {
            const u = unidades[i];
            const seq = i + 1;
            const generatedCode = `${entryResult.insertId}-${seq}`;
            await connection.query(insertUnitQuery, [
              entryResult.insertId,
              generatedCode,
              Number(u.peso) || 0,
              u.creado_por || id_usuario_receptor,
              u.fecha_pesos ?? null,
            ]);
          }
        }
      }

      await connection.commit();

      const [rows] = await pool.query(entryQueries.findById, [entryResult.insertId]);
      return rows[0] || null;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'entries.createUnit': async ({ id_entrada, unidad_codigo, peso, creado_por, fecha_pesos }) => {
    // generate sequential unidad_codigo based on existing units for this entrada
    const [countRows] = await pool.query(`SELECT COUNT(*) AS cnt FROM ${ENTRADA_UNIDADES_TABLE} WHERE id_entrada = ?`, [id_entrada]);
    const seq = (countRows && countRows[0] && Number(countRows[0].cnt)) ? Number(countRows[0].cnt) + 1 : 1;
    const generatedCode = `${id_entrada}-${seq}`;

    const [result] = await pool.query(
      `INSERT INTO ${ENTRADA_UNIDADES_TABLE} (id_entrada, unidad_codigo, peso, creado_por, fecha_pesos, created_at) VALUES (?, ?, ?, ?, COALESCE(?, NOW()), NOW())`,
      [id_entrada, generatedCode, Number(peso) || 0, creado_por, fecha_pesos ?? null]
    );

    const [rows] = await pool.query(`SELECT id, id_entrada, unidad_codigo, peso, creado_por, fecha_pesos, created_at FROM ${ENTRADA_UNIDADES_TABLE} WHERE id = ?`, [result.insertId]);
    return rows[0] || null;
  },
  'entries.findUnitsByEntrada': async ({ id_entrada }) => {
    const [rows] = await pool.query(
      `SELECT id, id_entrada, unidad_codigo, peso, creado_por, fecha_pesos, created_at FROM ${ENTRADA_UNIDADES_TABLE} WHERE id_entrada = ? ORDER BY id ASC`,
      [id_entrada]
    );
    return rows;
  },
  'entries.removeUnit': async ({ id }) => {
    const [result] = await pool.query(`DELETE FROM ${ENTRADA_UNIDADES_TABLE} WHERE id = ?`, [id]);
    return result.affectedRows > 0;
  },
  'entries.remove': async ({ id }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [entryMovements] = await connection.query(
        `SELECT id_existencia, cantidad FROM ${MOVEMENTS_TABLE} WHERE tipo_movimiento = 'Entrada' AND motivo = ? AND estado_registro = '${ACTIVE_STATE}'`,
        [`Entrada de mercancia #${id}`]
      );

      for (const movement of entryMovements) {
        await connection.query(
          `INSERT INTO ${MOVEMENTS_TABLE} (id_existencia, tipo_movimiento, cantidad, motivo, id_usuario, estado_registro) VALUES (?, 'Ajuste', ?, ?, NULL, ?)`,
          [movement.id_existencia, movement.cantidad, `Reversion entrada #${id}`, ACTIVE_STATE]
        );
      }

      const affectedExistencias = [...new Set(entryMovements.map((movement) => movement.id_existencia))];

      for (const existenceId of affectedExistencias) {
        const [stockRows] = await connection.query(
          `SELECT COALESCE(SUM(CASE WHEN tipo_movimiento = 'Entrada' THEN cantidad WHEN tipo_movimiento IN ('Salida', 'Ajuste', 'Desperdicio') THEN -cantidad ELSE 0 END), 0) AS cantidad_neta FROM ${MOVEMENTS_TABLE} WHERE id_existencia = ? AND estado_registro = '${ACTIVE_STATE}'`,
          [existenceId]
        );

        const netQuantity = Number(stockRows[0]?.cantidad_neta || 0);

        const [avgCostRows] = await connection.query(
          `SELECT SUM(e.costo_unitario * m.cantidad) / NULLIF(SUM(m.cantidad), 0) AS avg_cost FROM ${ENTRIES_TABLE} e INNER JOIN ${MOVEMENTS_TABLE} m ON m.motivo = CONCAT('Entrada de mercancia #', e.id_entrada) AND m.id_existencia = ? AND m.tipo_movimiento = 'Entrada' AND m.estado_registro = '${ACTIVE_STATE}' WHERE e.estado_registro = '${ACTIVE_STATE}' AND e.costo_unitario IS NOT NULL`,
          [existenceId]
        );

        const avgCost = avgCostRows[0]?.avg_cost ?? null;

        await connection.query(
          `UPDATE ${INVENTORY_TABLE} SET cantidad_disponible = ?, costo_unitario = ?, estado_registro = CASE WHEN ? > 0 THEN '${ACTIVE_STATE}' ELSE '${INACTIVE_STATE}' END, id_entrada_origen = NULL WHERE id_existencia = ?`,
          [netQuantity, avgCost, netQuantity, existenceId]
        );
      }

      // If any active inventory row still references this entry as origin, release FK before marking inactive.
      await connection.query(
        `UPDATE ${INVENTORY_TABLE} SET id_entrada_origen = NULL WHERE id_entrada_origen = ? AND estado_registro = '${ACTIVE_STATE}'`,
        [id]
      );

      await connection.query(
        `UPDATE ${RAW_MATERIAL_LOTS_TABLE} SET estado_registro = '${INACTIVE_STATE}' WHERE id_entrada_origen = ? AND estado_registro <> '${INACTIVE_STATE}'`,
        [id]
      );

      const [result] = await connection.query(
        `UPDATE ${ENTRIES_TABLE} SET estado_registro = '${INACTIVE_STATE}' WHERE id_entrada = ? AND estado_registro = '${ACTIVE_STATE}'`,
        [id]
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        return false;
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'entries.remove.legacy': async ({ id }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [existencias] = await connection.query(
        `SELECT id_existencia FROM ${INVENTORY_TABLE} WHERE id_entrada_origen = ?`,
        [id]
      );

      if (existencias.length > 0) {
        const existenciaIds = existencias.map((item) => item.id_existencia);
        await connection.query(`DELETE FROM ${MOVEMENTS_TABLE} WHERE id_existencia IN (?)`, [existenciaIds]);
      }

      await connection.query(`DELETE FROM ${INVENTORY_TABLE} WHERE id_entrada_origen = ?`, [id]);
      const [result] = await connection.query(`DELETE FROM ${ENTRIES_TABLE} WHERE id_entrada = ?`, [id]);

      await connection.commit();
      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'inventory.findAll': async () => {
    const [rows] = await pool.query(inventoryQueries.findAll);
    return rows;
  },
  'movements.findAll': async () => {
    const [rows] = await pool.query(movementQueries.findAll);
    return rows;
  },
  'products.findAll': async () => {
    const [rows] = await pool.query(productQueries.findAll);
    return rows;
  },
  'products.findById': async ({ id }) => {
    const [rows] = await pool.query(productQueries.findById, [id]);
    return rows[0] || null;
  },
  'products.create': async ({
    nombre,
    descripcion,
    unidad_medida,
    tipo_producto,
    stock_minimo,
    precio_venta_sugerido,
    estado_registro,
  }) => {
    const [result] = await pool.query(
      `INSERT INTO ${PRODUCTS_TABLE} (nombre, descripcion, unidad_medida, tipo_producto, stock_minimo, precio_venta_sugerido, estado_registro) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre,
        descripcion ?? null,
        unidad_medida ?? null,
        tipo_producto,
        stock_minimo ?? 10,
        precio_venta_sugerido ?? 0,
        estado_registro || ACTIVE_STATE,
      ]
    );

    const [rows] = await pool.query(productQueries.findById, [result.insertId]);
    return rows[0] || null;
  },
  'products.update': async ({
    id,
    nombre,
    descripcion,
    unidad_medida,
    tipo_producto,
    stock_minimo,
    precio_venta_sugerido,
    estado_registro,
  }) => {
    const [result] = await pool.query(
      `UPDATE ${PRODUCTS_TABLE} SET nombre = ?, descripcion = ?, unidad_medida = ?, tipo_producto = ?, stock_minimo = ?, precio_venta_sugerido = ?, estado_registro = COALESCE(?, estado_registro) WHERE id_producto = ? AND estado_registro = '${ACTIVE_STATE}'`,
      [
        nombre,
        descripcion ?? null,
        unidad_medida ?? null,
        tipo_producto,
        stock_minimo ?? 10,
        precio_venta_sugerido ?? 0,
        estado_registro ?? null,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    const [rows] = await pool.query(productQueries.findById, [id]);
    return rows[0] || null;
  },
  'products.remove': async ({ id }) => {
    const [result] = await pool.query(
      `UPDATE ${PRODUCTS_TABLE} SET estado_registro = '${INACTIVE_STATE}' WHERE id_producto = ? AND estado_registro = '${ACTIVE_STATE}'`,
      [id]
    );
    return result.affectedRows > 0;
  },
  'serviceTypes.findAll': async () => {
    const [rows] = await pool.query(serviceTypeQueries.findAll);
    return rows;
  },
  'mermaTypes.findAll': async () => {
    const [rows] = await pool.query(mermaTypeQueries.findAll);
    return rows;
  },
  'serviceTypes.findById': async ({ id }) => {
    const [rows] = await pool.query(serviceTypeQueries.findById, [id]);
    return rows[0] || null;
  },
  'serviceTypes.create': async ({ nombre_servicio, descripcion, km_frecuencia }) => {
    const [result] = await pool.query(
      `INSERT INTO ${SERVICE_TYPES_TABLE} (nombre_servicio, descripcion, km_frecuencia) VALUES (?, ?, ?)`,
      [
        nombre_servicio,
        normalizeNullableText(descripcion),
        km_frecuencia === undefined || km_frecuencia === null || km_frecuencia === ''
          ? null
          : Number(km_frecuencia),
      ]
    );

    const [rows] = await pool.query(serviceTypeQueries.findById, [result.insertId]);
    return rows[0] || null;
  },
  'serviceTypes.update': async ({ id, nombre_servicio, descripcion, km_frecuencia }) => {
    const [result] = await pool.query(
      `UPDATE ${SERVICE_TYPES_TABLE} SET nombre_servicio = ?, descripcion = ?, km_frecuencia = ? WHERE id_tipo_servicio = ?`,
      [
        nombre_servicio,
        normalizeNullableText(descripcion),
        km_frecuencia === undefined || km_frecuencia === null || km_frecuencia === ''
          ? null
          : Number(km_frecuencia),
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    const [rows] = await pool.query(serviceTypeQueries.findById, [id]);
    return rows[0] || null;
  },
  'serviceTypes.remove': async ({ id }) => {
    const [result] = await pool.query(
      `DELETE FROM ${SERVICE_TYPES_TABLE} WHERE id_tipo_servicio = ?`,
      [id]
    );
    return result.affectedRows > 0;
  },
  'maturationLots.findAll': async () => {
    const [rows] = await pool.query(maturationLotQueries.findAll);
    return rows;
  },
  'maturationLots.findById': async ({ id }) => {
    const [rows] = await pool.query(maturationLotQueries.findById, [id]);
    return rows[0] || null;
  },
  'maturationLots.create': async ({
    id_producto,
    id_proveedor,
    id_entrada_origen,
    fecha_recepcion,
    cantidad_unidades,
    peso_inicial_kg,
    estado_maduracion,
    estado_registro,
  }) => {
    const [result] = await pool.query(
      `INSERT INTO ${RAW_MATERIAL_LOTS_TABLE} (id_producto, id_proveedor, id_entrada_origen, fecha_recepcion, cantidad_unidades, peso_inicial_kg, estado_maduracion, estado_registro) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id_producto,
        id_proveedor,
        id_entrada_origen,
        fecha_recepcion,
        cantidad_unidades === undefined || cantidad_unidades === null || cantidad_unidades === ''
          ? null
          : Number.parseInt(cantidad_unidades, 10),
        Number(peso_inicial_kg),
        normalizeNullableText(estado_maduracion) || 'Verde',
        normalizeNullableText(estado_registro) || PENDING_STATE,
      ]
    );

    const [rows] = await pool.query(maturationLotQueries.findById, [result.insertId]);
    return rows[0] || null;
  },
  'maturationLots.update': async ({
    id,
    id_producto,
    id_proveedor,
    id_entrada_origen,
    fecha_recepcion,
    cantidad_unidades,
    peso_inicial_kg,
    estado_maduracion,
    estado_registro,
  }) => {
    const [result] = await pool.query(
      `UPDATE ${RAW_MATERIAL_LOTS_TABLE} SET id_producto = ?, id_proveedor = ?, id_entrada_origen = ?, fecha_recepcion = ?, cantidad_unidades = ?, peso_inicial_kg = ?, estado_maduracion = ?, estado_registro = COALESCE(?, estado_registro) WHERE id_lote_mp = ? AND estado_registro <> '${INACTIVE_STATE}'`,
      [
        id_producto,
        id_proveedor,
        id_entrada_origen,
        fecha_recepcion,
        cantidad_unidades === undefined || cantidad_unidades === null || cantidad_unidades === ''
          ? null
          : Number.parseInt(cantidad_unidades, 10),
        Number(peso_inicial_kg),
        normalizeNullableText(estado_maduracion) || 'Verde',
        normalizeNullableText(estado_registro),
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    const [rows] = await pool.query(maturationLotQueries.findById, [id]);
    return rows[0] || null;
  },
  'maturationLots.remove': async ({ id }) => {
    const [result] = await pool.query(
      `UPDATE ${RAW_MATERIAL_LOTS_TABLE} SET estado_registro = '${INACTIVE_STATE}' WHERE id_lote_mp = ? AND estado_registro <> '${INACTIVE_STATE}'`,
      [id]
    );
    return result.affectedRows > 0;
  },
  'maturationLots.accept': async ({ id, estado_maduracion }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [lotRows] = await connection.query(maturationLotQueries.findForUpdate, [id]);

      if (lotRows.length === 0 || lotRows[0].estado_registro !== PENDING_STATE) {
        await connection.rollback();
        return null;
      }

      const lot = lotRows[0];

      await connection.query(
        `UPDATE ${RAW_MATERIAL_LOTS_TABLE} SET estado_maduracion = ?, estado_registro = '${ACTIVE_STATE}' WHERE id_lote_mp = ?`,
        [estado_maduracion, id]
      );

      const isMature = estado_maduracion === MATURE_RIPENESS_STATE;
      const pesoInicial = Number(lot.peso_inicial_kg);

      const [result] = await connection.query(
        `INSERT INTO ${MATURATION_SUBLOT_TABLE} (id_lote_mp, codigo_sublote, peso_inicial_kg, peso_kg, peso_neto_maduracion_kg, perdida_maduracion_kg, cantidad_unidades, estado_maduracion, estado_registro) VALUES (?, 'A', ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          pesoInicial,
          pesoInicial,
          isMature ? pesoInicial : null,
          isMature ? 0 : null,
          lot.cantidad_unidades,
          estado_maduracion,
          isMature ? SUBLOT_READY_STATE : SUBLOT_ACTIVE_STATE,
        ]
      );

      // El peso aceptado queda comprometido al sub-lote: se descuenta del stock general
      // de Materia Prima para no contarlo dos veces (ahi + en Fruta para produccion).
      const [existenciaRows] = await connection.query(
        `SELECT ie.id_existencia, COALESCE(stock.cantidad_disponible, 0) AS cantidad_disponible
         FROM ${INVENTORY_TABLE} ie
         LEFT JOIN (
           SELECT id_existencia, SUM(CASE WHEN tipo_movimiento = 'Entrada' THEN cantidad WHEN tipo_movimiento IN ('Salida', 'Ajuste', 'Desperdicio') THEN -cantidad ELSE 0 END) AS cantidad_disponible
           FROM ${MOVEMENTS_TABLE} WHERE estado_registro = '${ACTIVE_STATE}' GROUP BY id_existencia
         ) stock ON stock.id_existencia = ie.id_existencia
         WHERE ie.id_producto = ? AND ie.id_proveedor = ? AND ie.estado_registro = '${ACTIVE_STATE}'
         ORDER BY ie.fecha_vencimiento ASC, ie.id_existencia ASC
         FOR UPDATE`,
        [lot.id_producto, lot.id_proveedor]
      );
      const existencia = existenciaRows.find((row) => Number(row.cantidad_disponible) >= pesoInicial);

      if (existencia) {
        await connection.query(
          `INSERT INTO ${MOVEMENTS_TABLE} (id_existencia, tipo_movimiento, cantidad, motivo, id_usuario, estado_registro) VALUES (?, 'Salida', ?, ?, NULL, ?)`,
          [existencia.id_existencia, pesoInicial, `Aceptado a maduracion - lote #${id}`, ACTIVE_STATE]
        );
      }

      await connection.commit();

      const [rows] = await pool.query(`${maturationSublotBaseQuery} WHERE s.id_sublote = ?`, [result.insertId]);
      return rows[0] || null;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'maturationSublots.findAll': async () => {
    const [rows] = await pool.query(maturationSublotQueries.findAll);
    return rows;
  },
  'maturationSublots.findById': async ({ id }) => {
    const [rows] = await pool.query(maturationSublotQueries.findById, [id]);
    return rows[0] || null;
  },
  'maturationSublots.findByLot': async ({ id_lote_mp }) => {
    const [rows] = await pool.query(maturationSublotQueries.findByLot, [id_lote_mp]);
    return rows;
  },
  'maturationSublots.findReadyForProduction': async () => {
    const [rows] = await pool.query(maturationSublotQueries.findReadyForProduction);
    return rows;
  },
  'maturationSublots.split': async ({ id, peso_kg, observaciones }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [originRows] = await connection.query(maturationSublotQueries.findForUpdate, [id]);

      if (originRows.length === 0 || originRows[0].estado_registro !== SUBLOT_ACTIVE_STATE) {
        await connection.rollback();
        return null;
      }

      const origin = originRows[0];
      const splitWeight = Number(peso_kg);
      const availableWeight = Number(origin.peso_kg);

      if (!Number.isFinite(splitWeight) || splitWeight <= 0 || splitWeight > availableWeight) {
        await connection.rollback();
        throw new Error('El peso a fraccionar supera el peso disponible del sub-lote');
      }

      let splitUnits = null;
      let remainingUnits = origin.cantidad_unidades;

      if (origin.cantidad_unidades !== null && origin.cantidad_unidades !== undefined && availableWeight > 0) {
        splitUnits = Math.min(
          Number(origin.cantidad_unidades),
          Math.round(Number(origin.cantidad_unidades) * (splitWeight / availableWeight))
        );
        remainingUnits = Number(origin.cantidad_unidades) - splitUnits;
      }

      await connection.query(
        `UPDATE ${MATURATION_SUBLOT_TABLE} SET peso_kg = peso_kg - ?, cantidad_unidades = ? WHERE id_sublote = ?`,
        [splitWeight, remainingUnits, id]
      );

      const [countRows] = await connection.query(maturationSublotQueries.countByLot, [origin.id_lote_mp]);
      const nextCode = `A${Number(countRows[0].total) + 1}`;

      const [result] = await connection.query(
        `INSERT INTO ${MATURATION_SUBLOT_TABLE} (id_lote_mp, codigo_sublote, peso_inicial_kg, peso_kg, cantidad_unidades, estado_maduracion, estado_registro, observaciones) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          origin.id_lote_mp,
          nextCode,
          splitWeight,
          splitWeight,
          splitUnits,
          origin.estado_maduracion,
          SUBLOT_ACTIVE_STATE,
          normalizeNullableText(observaciones),
        ]
      );

      await connection.commit();

      const [rows] = await pool.query(
        `${maturationSublotBaseQuery} WHERE s.id_sublote IN (?, ?) ORDER BY s.id_sublote ASC`,
        [id, result.insertId]
      );

      return {
        origen: rows.find((row) => row.id_sublote === id),
        nuevo: rows.find((row) => row.id_sublote === result.insertId),
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'maturationSublots.close': async ({ id, peso_medido_kg }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const result = await closeSublote(connection, id, peso_medido_kg, { silent: false });
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'maturationControls.findAll': async () => {
    const [rows] = await pool.query(maturationControlQueries.findAll);
    return rows;
  },
  'maturationControls.findBySublot': async ({ id_sublote }) => {
    const [rows] = await pool.query(maturationControlQueries.findBySublot, [id_sublote]);
    return rows;
  },
  'maturationControls.create': async ({
    id_sublote,
    grados_brix,
    peso_medido_kg,
    porcentaje_materia_seca,
    temperatura_cuarto,
    observaciones,
  }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        `INSERT INTO ${MATURATION_CONTROL_TABLE} (id_sublote, grados_brix, peso_medido_kg, porcentaje_materia_seca, temperatura_cuarto, observaciones) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id_sublote,
          Number(grados_brix),
          peso_medido_kg === undefined || peso_medido_kg === null || peso_medido_kg === ''
            ? null
            : Number(peso_medido_kg),
          porcentaje_materia_seca === undefined || porcentaje_materia_seca === null || porcentaje_materia_seca === ''
            ? null
            : Number(porcentaje_materia_seca),
          temperatura_cuarto === undefined || temperatura_cuarto === null || temperatura_cuarto === ''
            ? null
            : Number(temperatura_cuarto),
          normalizeNullableText(observaciones),
        ]
      );

      let subloteWasPromoted = false;

      if (Number(grados_brix) >= MATURATION_BRIX_THRESHOLD) {
        const promoted = await closeSublote(connection, id_sublote, peso_medido_kg, { silent: true });
        subloteWasPromoted = Boolean(promoted);
      }

      await connection.commit();

      const [rows] = await pool.query(maturationControlQueries.findById, [result.insertId]);
      return { ...(rows[0] || {}), sublote_promovido: subloteWasPromoted };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'maturationControls.remove': async ({ id }) => {
    const [result] = await pool.query(
      `DELETE FROM ${MATURATION_CONTROL_TABLE} WHERE id_control = ?`,
      [id]
    );
    return result.affectedRows > 0;
  },
  'greenNets.findBySublot': async ({ id_sublote }) => {
    const [rows] = await pool.query(greenNetQueries.findBySublot, [id_sublote]);
    return rows;
  },
  'greenNets.create': async ({ id_sublote, id_producto, peso_kg, fecha_vencimiento, costo_unitario, id_usuario }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [sublotRows] = await connection.query(maturationSublotQueries.findForUpdate, [id_sublote]);

      if (sublotRows.length === 0) {
        await connection.rollback();
        return null;
      }

      const sublot = sublotRows[0];

      if (sublot.estado_maduracion !== 'Verde' || sublot.estado_registro !== SUBLOT_ACTIVE_STATE) {
        await connection.rollback();
        throw new Error('El sub-lote debe estar Verde y activo para empacar como red');
      }

      const requestedKg = Number(peso_kg);
      const availableKg = Number(sublot.peso_kg);

      if (!Number.isFinite(requestedKg) || requestedKg <= 0 || requestedKg > availableKg) {
        await connection.rollback();
        throw new Error('El peso de la red supera el peso disponible del sub-lote');
      }

      const nextWeight = availableKg - requestedKg;
      const nextState = nextWeight <= 0 ? SUBLOT_GREEN_NET_STATE : SUBLOT_ACTIVE_STATE;

      await connection.query(
        `UPDATE ${MATURATION_SUBLOT_TABLE} SET peso_kg = ?, estado_registro = ? WHERE id_sublote = ?`,
        [nextWeight, nextState, id_sublote]
      );

      const [lotRows] = await connection.query(
        `SELECT id_proveedor FROM ${RAW_MATERIAL_LOTS_TABLE} WHERE id_lote_mp = ? LIMIT 1`,
        [sublot.id_lote_mp]
      );
      const supplierId = lotRows[0]?.id_proveedor ?? null;

      const [existingInventoryRows] = await connection.query(
        `SELECT id_existencia FROM ${INVENTORY_TABLE} WHERE id_producto = ? AND id_proveedor <=> ? AND estado_registro = '${ACTIVE_STATE}' LIMIT 1`,
        [id_producto, supplierId]
      );

      let existenceId;

      if (existingInventoryRows.length > 0) {
        existenceId = existingInventoryRows[0].id_existencia;
        await connection.query(
          `UPDATE ${INVENTORY_TABLE} SET fecha_vencimiento = ?, costo_unitario = COALESCE(?, costo_unitario) WHERE id_existencia = ?`,
          [fecha_vencimiento, costo_unitario ?? null, existenceId]
        );
      } else {
        const [existenceResult] = await connection.query(
          `INSERT INTO ${INVENTORY_TABLE} (id_producto, id_proveedor, id_proceso_origen, id_entrada_origen, fecha_vencimiento, cantidad_disponible, costo_unitario, estado_registro) VALUES (?, ?, NULL, NULL, ?, ?, ?, ?)`,
          [id_producto, supplierId, fecha_vencimiento, 0, costo_unitario ?? null, ACTIVE_STATE]
        );
        existenceId = existenceResult.insertId;
      }

      await connection.query(
        `INSERT INTO ${MOVEMENTS_TABLE} (id_existencia, tipo_movimiento, cantidad, motivo, id_usuario, estado_registro) VALUES (?, 'Entrada', ?, ?, ?, ?)`,
        [existenceId, requestedKg, `Red platano verde - sublote #${id_sublote}`, id_usuario ?? null, ACTIVE_STATE]
      );

      const [redResult] = await connection.query(
        `INSERT INTO ${GREEN_NET_TABLE} (id_sublote, id_existencia, peso_kg, id_usuario) VALUES (?, ?, ?, ?)`,
        [id_sublote, existenceId, requestedKg, id_usuario]
      );

      await connection.commit();

      const [rows] = await pool.query(
        `SELECT r.id_red, r.id_sublote, r.id_existencia, r.peso_kg, r.id_usuario, r.fecha_empaque FROM ${GREEN_NET_TABLE} r WHERE r.id_red = ?`,
        [redResult.insertId]
      );

      return rows[0] || null;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'productionProcesses.findAll': async () => {
    const [rows] = await pool.query(productionProcessListQuery);
    return rows;
  },
  'productionProcesses.findById': async ({ id }) => {
    return loadProductionProcessDetail(pool, id);
  },
  'productionProcesses.create': async ({
    id_sublote,
    id_producto_resultado,
    cantidad_ingresada_kg,
    fecha_inicio,
    cuarto_congelado,
    ubicacion_cuarto_congelado,
    observaciones,
    id_usuario_registro,
  }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [sublotRows] = await connection.query(productionProcessQueries.findSublotForUpdate, [id_sublote]);
      if (sublotRows.length === 0 || sublotRows[0].estado_registro !== SUBLOT_READY_STATE) {
        await connection.rollback();
        return null;
      }

      const sublot = sublotRows[0];
      const availableKg = Number(sublot.peso_kg);
      const requestedKg = Number(cantidad_ingresada_kg);

      if (!Number.isFinite(requestedKg) || requestedKg <= 0 || requestedKg > availableKg) {
        await connection.rollback();
        throw new Error('La cantidad ingresada supera el peso disponible del sub-lote');
      }

      const nextWeight = availableKg - requestedKg;
      const nextState = nextWeight <= 0 ? SUBLOT_SENT_STATE : SUBLOT_READY_STATE;

      await connection.query(
        `UPDATE ${MATURATION_SUBLOT_TABLE} SET peso_kg = ?, estado_registro = ? WHERE id_sublote = ?`,
        [nextWeight, nextState, id_sublote]
      );

      const [result] = await connection.query(
        `INSERT INTO ${PRODUCTION_TABLE} (id_sublote, id_producto_resultado, cantidad_ingresada_kg, estado_proceso, fecha_inicio, cuarto_congelado, ubicacion_cuarto_congelado, observaciones, id_usuario_registro, estado_registro) VALUES (?, ?, ?, ?, COALESCE(?, NOW()), ?, ?, ?, ?, ?)`,
        [
          id_sublote,
          id_producto_resultado,
          requestedKg,
          PRODUCTION_ACTIVE_STATE,
          fecha_inicio ?? null,
          normalizeNullableText(cuarto_congelado),
          normalizeNullableText(ubicacion_cuarto_congelado),
          normalizeNullableText(observaciones),
          id_usuario_registro ?? null,
          ACTIVE_STATE,
        ]
      );

      await connection.commit();
      return loadProductionProcessDetail(connection, result.insertId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'productionProcesses.addStage': async ({
    id,
    nombre_etapa,
    fecha_inicio,
    fecha_fin,
    personal_asignado,
    cantidad_entrada_kg,
    cantidad_salida_kg,
    merma_kg,
    observaciones,
  }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [processRows] = await connection.query(productionProcessQueries.findById, [id]);
      if (processRows.length === 0 || processRows[0].estado_proceso === PRODUCTION_FINISHED_STATE) {
        await connection.rollback();
        return null;
      }

      const [result] = await connection.query(
        `INSERT INTO ${PRODUCTION_STAGE_TABLE} (id_proceso, nombre_etapa, fecha_inicio, fecha_fin, personal_asignado, cantidad_entrada_kg, cantidad_salida_kg, merma_kg, observaciones, estado_registro) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          nombre_etapa,
          fecha_inicio,
          fecha_fin ?? null,
          personal_asignado,
          cantidad_entrada_kg ?? null,
          cantidad_salida_kg ?? null,
          merma_kg ?? null,
          normalizeNullableText(observaciones),
          ACTIVE_STATE,
        ]
      );

      await connection.commit();
      const [rows] = await connection.query(productionStageQueries.findById, [result.insertId]);
      return rows[0] || null;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'productionProcesses.addMerma': async ({ id, id_etapa, id_tipo_merma, cantidad_kg, observaciones }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [processRows] = await connection.query(productionProcessQueries.findById, [id]);
      if (processRows.length === 0 || processRows[0].estado_proceso === PRODUCTION_FINISHED_STATE) {
        await connection.rollback();
        return null;
      }

      const [result] = await connection.query(
        `INSERT INTO ${PRODUCTION_MERMA_TABLE} (id_proceso, id_etapa, id_tipo_merma, cantidad_kg, observaciones, estado_registro) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, id_etapa ?? null, id_tipo_merma, cantidad_kg, normalizeNullableText(observaciones), ACTIVE_STATE]
      );

      await connection.commit();
      const [rows] = await connection.query(productionMermaQueries.findById, [result.insertId]);
      return rows[0] || null;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'productionProcesses.addInsumo': async ({ id, id_etapa, id_producto, cantidad, unidad_medida, observaciones }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [processRows] = await connection.query(productionProcessQueries.findById, [id]);
      if (processRows.length === 0 || processRows[0].estado_proceso === PRODUCTION_FINISHED_STATE) {
        await connection.rollback();
        return null;
      }

      const requestedQty = Number(cantidad);
      const [existenciaRows] = await connection.query(productionProcessQueries.findInsumoExistencia, [id_producto]);
      const existencia = existenciaRows.find((row) => Number(row.cantidad_disponible) >= requestedQty);

      if (!existencia) {
        await connection.rollback();
        throw new Error('No hay suficiente inventario disponible para el insumo seleccionado');
      }

      await connection.query(
        `INSERT INTO ${MOVEMENTS_TABLE} (id_existencia, tipo_movimiento, cantidad, motivo, id_usuario, estado_registro) VALUES (?, 'Salida', ?, ?, NULL, ?)`,
        [existencia.id_existencia, requestedQty, `Consumo en produccion #${id}`, ACTIVE_STATE]
      );

      const [result] = await connection.query(
        `INSERT INTO ${PRODUCTION_INSUMO_TABLE} (id_proceso, id_etapa, id_producto, cantidad, unidad_medida, observaciones, estado_registro) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, id_etapa ?? null, id_producto, requestedQty, unidad_medida, normalizeNullableText(observaciones), ACTIVE_STATE]
      );

      await connection.commit();
      const [rows] = await connection.query(productionInsumoQueries.findById, [result.insertId]);
      return rows[0] || null;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'productionProcesses.addColdRoomEntry': async ({ id, fecha_ingreso, ubicacion_cuarto, cantidad_kg, observaciones }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [processRows] = await connection.query(productionProcessQueries.findById, [id]);
      if (processRows.length === 0 || processRows[0].estado_proceso === PRODUCTION_FINISHED_STATE) {
        await connection.rollback();
        return null;
      }

      const [result] = await connection.query(
        `INSERT INTO ${PRODUCTION_COLD_ROOM_TABLE} (id_proceso, fecha_ingreso, ubicacion_cuarto, cantidad_kg, observaciones, estado_registro) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, fecha_ingreso, ubicacion_cuarto, cantidad_kg, normalizeNullableText(observaciones), ACTIVE_STATE]
      );

      await connection.query(
        `UPDATE ${PRODUCTION_TABLE} SET cuarto_congelado = COALESCE(?, cuarto_congelado), ubicacion_cuarto_congelado = COALESCE(?, ubicacion_cuarto_congelado) WHERE id_proceso = ?`,
        [ubicacion_cuarto, ubicacion_cuarto, id]
      );

      await connection.commit();
      const [rows] = await connection.query(productionColdRoomQueries.findById, [result.insertId]);
      return rows[0] || null;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'productionProcesses.finalize': async ({
    id,
    cantidad_producida_kg,
    fecha_fin,
    fecha_vencimiento,
    cuarto_congelado,
    ubicacion_cuarto_congelado,
    observaciones,
    costo_unitario,
  }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [processRows] = await connection.query(productionProcessQueries.findById, [id]);
      if (processRows.length === 0) {
        await connection.rollback();
        return null;
      }

      const process = processRows[0];

      if (process.estado_proceso === PRODUCTION_FINISHED_STATE) {
        await connection.rollback();
        throw new Error('El proceso ya fue finalizado');
      }

      const inputKg = Number(process.cantidad_ingresada_kg || 0);
      const outputKg = Number(cantidad_producida_kg || 0);

      if (!Number.isFinite(outputKg) || outputKg < 0) {
        await connection.rollback();
        throw new Error('La cantidad producida no es valida');
      }

      if (outputKg > inputKg) {
        await connection.rollback();
        throw new Error('La cantidad producida no puede superar la cantidad ingresada');
      }

      const rendimiento = inputKg > 0 ? (outputKg / inputKg) * 100 : 0;

      await connection.query(
        `UPDATE ${PRODUCTION_TABLE} SET cantidad_producida_kg = ?, rendimiento_porcentaje = ?, estado_proceso = '${PRODUCTION_FINISHED_STATE}', fecha_fin = ?, cuarto_congelado = COALESCE(?, cuarto_congelado), ubicacion_cuarto_congelado = COALESCE(?, ubicacion_cuarto_congelado), observaciones = COALESCE(?, observaciones) WHERE id_proceso = ?`,
        [
          outputKg,
          rendimiento,
          fecha_fin,
          normalizeNullableText(cuarto_congelado),
          normalizeNullableText(ubicacion_cuarto_congelado),
          normalizeNullableText(observaciones),
          id,
        ]
      );

      if (outputKg > 0) {
        const [lotRows] = await connection.query(
          `SELECT l.id_proveedor FROM ${MATURATION_SUBLOT_TABLE} s LEFT JOIN ${RAW_MATERIAL_LOTS_TABLE} l ON l.id_lote_mp = s.id_lote_mp WHERE s.id_sublote = ? LIMIT 1`,
          [process.id_sublote]
        );
        const supplierId = lotRows[0]?.id_proveedor ?? null;

        const [existingInventoryRows] = await connection.query(
          `SELECT id_existencia FROM ${INVENTORY_TABLE} WHERE id_proceso_origen = ? AND id_producto = ? AND estado_registro = '${ACTIVE_STATE}' LIMIT 1`,
          [id, process.id_producto_resultado]
        );

        let existenceId;

        if (existingInventoryRows.length > 0) {
          existenceId = existingInventoryRows[0].id_existencia;
          await connection.query(
            `UPDATE ${INVENTORY_TABLE} SET id_proveedor = ?, fecha_vencimiento = ?, costo_unitario = COALESCE(?, costo_unitario), estado_registro = '${ACTIVE_STATE}' WHERE id_existencia = ?`,
            [supplierId, fecha_vencimiento, costo_unitario ?? null, existenceId]
          );
        } else {
          const [existenceResult] = await connection.query(
            `INSERT INTO ${INVENTORY_TABLE} (id_producto, id_proveedor, id_proceso_origen, id_entrada_origen, fecha_vencimiento, cantidad_disponible, costo_unitario, estado_registro) VALUES (?, ?, ?, NULL, ?, ?, ?, ?)`,
            [process.id_producto_resultado, supplierId, id, fecha_vencimiento, 0, costo_unitario ?? null, ACTIVE_STATE]
          );
          existenceId = existenceResult.insertId;
        }

        await connection.query(
          `INSERT INTO ${MOVEMENTS_TABLE} (id_existencia, tipo_movimiento, cantidad, motivo, id_usuario, estado_registro) VALUES (?, 'Entrada', ?, ?, ?, ?)`,
          [existenceId, outputKg, `Produccion finalizada #${id}`, process.id_usuario_registro ?? null, ACTIVE_STATE]
        );
      }

      await connection.commit();
      return loadProductionProcessDetail(connection, id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'productionProcesses.remove': async ({ id }) => {
    const [result] = await pool.query(
      `UPDATE ${PRODUCTION_TABLE} SET estado_registro = '${INACTIVE_STATE}' WHERE id_proceso = ? AND estado_registro <> '${INACTIVE_STATE}'`,
      [id]
    );
    return result.affectedRows > 0;
  },
  'vehicles.findAll': async () => {
    const [rows] = await pool.query(vehicleQueries.findAll);
    return rows;
  },
  'vehicles.findById': async ({ id }) => {
    const [rows] = await pool.query(vehicleQueries.findById, [id]);
    return rows[0] || null;
  },
  'vehicles.create': async ({ placa, modelo, estado, kilometraje_actual, estado_registro }) => {
    const [result] = await pool.query(
      `INSERT INTO ${VEHICLES_TABLE} (placa, modelo, estado, kilometraje_actual, estado_registro) VALUES (?, ?, ?, ?, ?)`,
      [placa, modelo ?? null, estado ?? 'Disponible', kilometraje_actual ?? 0, estado_registro || ACTIVE_STATE]
    );

    const [rows] = await pool.query(vehicleQueries.findById, [result.insertId]);
    return rows[0] || null;
  },
  'vehicles.update': async ({
    id,
    placa,
    modelo,
    estado,
    kilometraje_actual,
    estado_registro,
    id_usuario_modificador,
  }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [existingRows] = await connection.query(
        `SELECT id_vehiculo, kilometraje_actual FROM ${VEHICLES_TABLE} WHERE id_vehiculo = ? AND estado_registro = '${ACTIVE_STATE}'`,
        [id]
      );

      if (existingRows.length === 0) {
        await connection.rollback();
        return null;
      }

      const currentVehicle = existingRows[0];
      const previousMileage = Number(currentVehicle.kilometraje_actual);
      const nextMileage =
        kilometraje_actual === undefined || kilometraje_actual === null || kilometraje_actual === ''
          ? previousMileage
          : Number(kilometraje_actual);

      const [result] = await connection.query(
        `UPDATE ${VEHICLES_TABLE} SET placa = ?, modelo = ?, estado = ?, kilometraje_actual = ?, estado_registro = COALESCE(?, estado_registro) WHERE id_vehiculo = ? AND estado_registro = '${ACTIVE_STATE}'`,
        [placa, modelo ?? null, estado ?? 'Disponible', nextMileage, estado_registro ?? null, id]
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        return null;
      }

      if (Number.isFinite(nextMileage) && nextMileage !== previousMileage) {
        await connection.query(
          `INSERT INTO ${VEHICLE_MILEAGE_REPORTS_TABLE} (id_vehiculo, id_usuario_modificador, kilometraje_registrado) VALUES (?, ?, ?)`,
          [id, id_usuario_modificador, nextMileage]
        );
      }

      await connection.commit();

      const [rows] = await connection.query(vehicleQueries.findById, [id]);
      return rows[0] || null;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'vehicles.remove': async ({ id }) => {
    const [result] = await pool.query(
      `UPDATE ${VEHICLES_TABLE} SET estado_registro = '${INACTIVE_STATE}' WHERE id_vehiculo = ? AND estado_registro = '${ACTIVE_STATE}'`,
      [id]
    );
    return result.affectedRows > 0;
  },
  'vehicleMileageReports.findAll': async () => {
    const [rows] = await pool.query(vehicleMileageReportQueries.findAll);
    return rows;
  },
  'vehicles.remove': async ({ id }) => {
    const [result] = await pool.query(
      `UPDATE ${VEHICLES_TABLE} SET estado_registro = '${INACTIVE_STATE}' WHERE id_vehiculo = ? AND estado_registro = '${ACTIVE_STATE}'`,
      [id]
    );
    return result.affectedRows > 0;
  },
  'vehicleServices.findAll': async () => {
    const [rows] = await pool.query(vehicleServiceQueries.findAll);
    return rows;
  },
  'vehicleServices.findById': async ({ id }) => {
    const [rows] = await pool.query(vehicleServiceQueries.findById, [id]);
    return rows[0] || null;
  },
  'vehicleServices.create': async ({
    id_vehiculo,
    id_tipo_servicio,
    fecha_servicio,
    km_en_servicio,
    costo_servicio,
    proximo_servicio_km,
    notas,
  }) => {
    const [result] = await pool.query(
      `INSERT INTO ${VEHICLE_SERVICES_TABLE} (id_vehiculo, id_tipo_servicio, fecha_servicio, km_en_servicio, costo_servicio, proximo_servicio_km, notas) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id_vehiculo,
        id_tipo_servicio,
        fecha_servicio,
        Number(km_en_servicio),
        costo_servicio === undefined || costo_servicio === null || costo_servicio === ''
          ? null
          : Number(costo_servicio),
        proximo_servicio_km === undefined ||
        proximo_servicio_km === null ||
        proximo_servicio_km === ''
          ? null
          : Number(proximo_servicio_km),
        normalizeNullableText(notas),
      ]
    );

    const [rows] = await pool.query(vehicleServiceQueries.findById, [result.insertId]);
    return rows[0] || null;
  },
  'vehicleServices.update': async ({
    id,
    id_vehiculo,
    id_tipo_servicio,
    fecha_servicio,
    km_en_servicio,
    costo_servicio,
    proximo_servicio_km,
    notas,
  }) => {
    const [result] = await pool.query(
      `UPDATE ${VEHICLE_SERVICES_TABLE} SET id_vehiculo = ?, id_tipo_servicio = ?, fecha_servicio = ?, km_en_servicio = ?, costo_servicio = ?, proximo_servicio_km = ?, notas = ? WHERE id_servicio = ?`,
      [
        id_vehiculo,
        id_tipo_servicio,
        fecha_servicio,
        Number(km_en_servicio),
        costo_servicio === undefined || costo_servicio === null || costo_servicio === ''
          ? null
          : Number(costo_servicio),
        proximo_servicio_km === undefined ||
        proximo_servicio_km === null ||
        proximo_servicio_km === ''
          ? null
          : Number(proximo_servicio_km),
        normalizeNullableText(notas),
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    const [rows] = await pool.query(vehicleServiceQueries.findById, [id]);
    return rows[0] || null;
  },
  'vehicleServices.remove': async ({ id }) => {
    const [result] = await pool.query(`DELETE FROM ${VEHICLE_SERVICES_TABLE} WHERE id_servicio = ?`, [id]);
    return result.affectedRows > 0;
  },
};

let dbWorker;

const startDbWorker = async () => {
  if (dbWorker) {
    return dbWorker;
  }

  dbWorker = new Worker(
    DB_QUEUE_NAME,
    async (job) => {
      const handler = handlers[job.name];

      if (!handler) {
        throw new Error(`No existe handler para el job: ${job.name}`);
      }

      return handler(job.data || {});
    },
    {
      connection: redisConnection,
      concurrency: Number(process.env.DB_QUEUE_CONCURRENCY) || 5,
    }
  );

  dbWorker.on('failed', (job, err) => {
    const jobId = job ? job.id : 'sin-id';
    console.error(`Job fallido (${jobId}):`, err.message);
  });

  await dbWorker.waitUntilReady();
  console.log(`Worker de cola listo: ${DB_QUEUE_NAME}`);

  return dbWorker;
};

module.exports = {
  startDbWorker,
};
