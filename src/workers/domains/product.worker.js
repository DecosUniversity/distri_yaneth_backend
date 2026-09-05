const { pool } = require('../../config/db');
const {
  USERS_TABLE,
  PRODUCTS_TABLE,
  ACTIVE_STATE,
  INACTIVE_STATE,
} = require('../shared/constants');
const { AUDIT_ACTION_CREATE, AUDIT_ACTION_UPDATE, AUDIT_ACTION_DELETE, recordAudit } = require('../shared/audit');

const productQueries = {
  findAll: `SELECT p.id_producto, p.nombre, p.descripcion, p.unidad_medida, p.tipo_producto, p.stock_minimo, p.precio_venta_sugerido, p.estado_registro, p.fecha_modificacion, p.id_usuario_modificacion, u.nombre_completo AS usuario_modificacion_nombre FROM ${PRODUCTS_TABLE} p LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = p.id_usuario_modificacion WHERE p.estado_registro = '${ACTIVE_STATE}'`,
  findById: `SELECT p.id_producto, p.nombre, p.descripcion, p.unidad_medida, p.tipo_producto, p.stock_minimo, p.precio_venta_sugerido, p.estado_registro, p.fecha_modificacion, p.id_usuario_modificacion, u.nombre_completo AS usuario_modificacion_nombre FROM ${PRODUCTS_TABLE} p LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = p.id_usuario_modificacion WHERE p.id_producto = ? AND p.estado_registro = '${ACTIVE_STATE}'`,
};

const handlers = {
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
    id_usuario_modificacion,
  }) => {
    const [result] = await pool.query(
      `INSERT INTO ${PRODUCTS_TABLE} (nombre, descripcion, unidad_medida, tipo_producto, stock_minimo, precio_venta_sugerido, estado_registro, id_usuario_modificacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre,
        descripcion ?? null,
        unidad_medida ?? null,
        tipo_producto,
        stock_minimo ?? 10,
        precio_venta_sugerido ?? 0,
        estado_registro || ACTIVE_STATE,
        id_usuario_modificacion ?? null,
      ]
    );

    const [rows] = await pool.query(productQueries.findById, [result.insertId]);
    const created = rows[0] || null;

    await recordAudit(pool, {
      table: PRODUCTS_TABLE,
      recordId: result.insertId,
      action: AUDIT_ACTION_CREATE,
      before: null,
      after: created,
      userId: id_usuario_modificacion,
    });

    return created;
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
    id_usuario_modificacion,
  }) => {
    const [beforeRows] = await pool.query(productQueries.findById, [id]);

    const [result] = await pool.query(
      `UPDATE ${PRODUCTS_TABLE} SET nombre = ?, descripcion = ?, unidad_medida = ?, tipo_producto = ?, stock_minimo = ?, precio_venta_sugerido = ?, estado_registro = COALESCE(?, estado_registro), id_usuario_modificacion = ? WHERE id_producto = ? AND estado_registro = '${ACTIVE_STATE}'`,
      [
        nombre,
        descripcion ?? null,
        unidad_medida ?? null,
        tipo_producto,
        stock_minimo ?? 10,
        precio_venta_sugerido ?? 0,
        estado_registro ?? null,
        id_usuario_modificacion ?? null,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    const [rows] = await pool.query(productQueries.findById, [id]);
    const updated = rows[0] || null;

    await recordAudit(pool, {
      table: PRODUCTS_TABLE,
      recordId: id,
      action: AUDIT_ACTION_UPDATE,
      before: beforeRows[0] || null,
      after: updated,
      userId: id_usuario_modificacion,
    });

    return updated;
  },
  'products.remove': async ({ id, id_usuario_modificacion }) => {
    const [beforeRows] = await pool.query(productQueries.findById, [id]);

    const [result] = await pool.query(
      `UPDATE ${PRODUCTS_TABLE} SET estado_registro = '${INACTIVE_STATE}', id_usuario_modificacion = ? WHERE id_producto = ? AND estado_registro = '${ACTIVE_STATE}'`,
      [id_usuario_modificacion ?? null, id]
    );

    if (result.affectedRows > 0) {
      await recordAudit(pool, {
        table: PRODUCTS_TABLE,
        recordId: id,
        action: AUDIT_ACTION_DELETE,
        before: beforeRows[0] || null,
        after: null,
        userId: id_usuario_modificacion,
      });
    }

    return result.affectedRows > 0;
  },
};

module.exports = {
  handlers,
};
