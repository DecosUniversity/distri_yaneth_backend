const { pool } = require('../../config/db');
const {
  USERS_TABLE,
  PROVIDERS_TABLE,
  INVENTORY_TABLE,
  MOVEMENTS_TABLE,
  PRODUCTS_TABLE,
  RAW_MATERIAL_LOTS_TABLE,
  MATURATION_SUBLOT_TABLE,
  ACTIVE_STATE,
  COMPLETE_STATE,
} = require('../shared/constants');

const inventoryQueries = {
  findAll: `SELECT base.id_existencia, base.id_producto, base.producto_nombre, base.tipo_producto, base.id_proveedor, base.nombre_empresa, base.id_proceso_origen, base.id_entrada_origen, base.fecha_entrada, base.fecha_vencimiento, base.cantidad_disponible, base.costo_unitario, base.estado_registro, base.fecha_modificacion, base.id_lote_mp, base.peso_inicial_kg, base.id_usuario_modificacion, um.nombre_completo AS usuario_modificacion_nombre FROM (SELECT ie.id_existencia, ie.id_producto, pr.nombre AS producto_nombre, pr.tipo_producto AS tipo_producto, ie.id_proveedor, p.nombre_empresa, ie.id_proceso_origen, ie.id_entrada_origen, ie.fecha_entrada, ie.fecha_vencimiento, COALESCE(stock.cantidad_disponible, ie.cantidad_disponible, 0) AS cantidad_disponible, ie.costo_unitario, ie.estado_registro, ie.fecha_modificacion, NULL AS id_lote_mp, NULL AS peso_inicial_kg, ie.id_usuario_modificacion FROM ${INVENTORY_TABLE} ie LEFT JOIN ${PRODUCTS_TABLE} pr ON pr.id_producto = ie.id_producto AND pr.estado_registro = '${ACTIVE_STATE}' LEFT JOIN ${PROVIDERS_TABLE} p ON p.id_proveedor = ie.id_proveedor AND p.estado_registro = '${ACTIVE_STATE}' LEFT JOIN (SELECT id_existencia, SUM(CASE WHEN tipo_movimiento = 'Entrada' THEN cantidad WHEN tipo_movimiento IN ('Salida', 'Ajuste', 'Desperdicio') THEN -cantidad ELSE 0 END) AS cantidad_disponible FROM ${MOVEMENTS_TABLE} WHERE estado_registro = '${ACTIVE_STATE}' GROUP BY id_existencia) stock ON stock.id_existencia = ie.id_existencia WHERE ie.estado_registro = '${ACTIVE_STATE}' UNION ALL SELECT NULL AS id_existencia, l.id_producto, pr.nombre AS producto_nombre, 'Fruta para produccion' AS tipo_producto, NULL AS id_proveedor, NULL AS nombre_empresa, NULL AS id_proceso_origen, l.id_entrada_origen, l.fecha_recepcion AS fecha_entrada, NULL AS fecha_vencimiento, COALESCE(sub.peso_disponible, 0) AS cantidad_disponible, NULL AS costo_unitario, '${COMPLETE_STATE}' AS estado_registro, sub.fecha_modificacion, l.id_lote_mp, l.peso_inicial_kg, l.id_usuario_modificacion FROM ${RAW_MATERIAL_LOTS_TABLE} l INNER JOIN (SELECT id_lote_mp, SUM(peso_kg) AS peso_disponible, MAX(fecha_modificacion) AS fecha_modificacion FROM ${MATURATION_SUBLOT_TABLE} GROUP BY id_lote_mp) sub ON sub.id_lote_mp = l.id_lote_mp LEFT JOIN ${PRODUCTS_TABLE} pr ON pr.id_producto = l.id_producto AND pr.estado_registro = '${ACTIVE_STATE}') base LEFT JOIN ${USERS_TABLE} um ON um.id_usuario = base.id_usuario_modificacion ORDER BY base.fecha_entrada DESC, base.id_existencia DESC, base.id_entrada_origen DESC`,
  // Lotes (existencias) de un producto con stock disponible, FIFO por vencimiento; usado
  // por el modulo de pedidos para sugerir/seleccionar de que lote se descuenta la venta.
  findByProduct: `SELECT ie.id_existencia, ie.fecha_vencimiento, ie.id_proveedor, prov.nombre_empresa, COALESCE(stock.cantidad_disponible, 0) AS cantidad_disponible FROM ${INVENTORY_TABLE} ie LEFT JOIN ${PROVIDERS_TABLE} prov ON prov.id_proveedor = ie.id_proveedor LEFT JOIN (SELECT id_existencia, SUM(CASE WHEN tipo_movimiento = 'Entrada' THEN cantidad WHEN tipo_movimiento IN ('Salida', 'Ajuste', 'Desperdicio') THEN -cantidad ELSE 0 END) AS cantidad_disponible FROM ${MOVEMENTS_TABLE} WHERE estado_registro = '${ACTIVE_STATE}' GROUP BY id_existencia) stock ON stock.id_existencia = ie.id_existencia WHERE ie.id_producto = ? AND ie.estado_registro = '${ACTIVE_STATE}' HAVING cantidad_disponible > 0 ORDER BY ie.fecha_vencimiento ASC, ie.id_existencia ASC`,
};

const handlers = {
  'inventory.findAll': async () => {
    const [rows] = await pool.query(inventoryQueries.findAll);
    return rows;
  },
  'inventory.findByProduct': async ({ id_producto }) => {
    const [rows] = await pool.query(inventoryQueries.findByProduct, [id_producto]);
    return rows;
  },
};

module.exports = {
  handlers,
};
