const { pool } = require('../../config/db');
const {
  USERS_TABLE,
  PRODUCTS_TABLE,
  PRODUCTION_ORDERS_TABLE,
  ACTIVE_STATE,
  INACTIVE_STATE,
  PRODUCTION_ORDER_PENDIENTE_STATE,
  PRODUCTION_ORDER_CANCELADA_STATE,
} = require('../shared/constants');
const { normalizeNullableText } = require('../shared/helpers');
const { AUDIT_ACTION_CREATE, AUDIT_ACTION_UPDATE, recordAudit } = require('../shared/audit');

const productionOrderBaseQuery = `SELECT o.id_orden, o.id_producto, pr.nombre AS producto_nombre, pr.unidad_medida, o.cantidad_solicitada_kg, o.cantidad_producida_kg, o.fecha_solicitada, o.observaciones, o.estado, o.id_usuario_creacion, creator.nombre_completo AS usuario_creacion_nombre, o.id_usuario_modificacion, um.nombre_completo AS usuario_modificacion_nombre, o.estado_registro, o.fecha_creacion, o.fecha_modificacion FROM ${PRODUCTION_ORDERS_TABLE} o LEFT JOIN ${PRODUCTS_TABLE} pr ON pr.id_producto = o.id_producto LEFT JOIN ${USERS_TABLE} creator ON creator.id_usuario = o.id_usuario_creacion LEFT JOIN ${USERS_TABLE} um ON um.id_usuario = o.id_usuario_modificacion`;

const productionOrderQueries = {
  findAll: `${productionOrderBaseQuery} WHERE o.estado_registro = '${ACTIVE_STATE}' ORDER BY o.fecha_creacion DESC, o.id_orden DESC`,
  findById: `${productionOrderBaseQuery} WHERE o.id_orden = ? AND o.estado_registro = '${ACTIVE_STATE}'`,
  findForUpdate: `SELECT id_orden, id_producto, cantidad_solicitada_kg, cantidad_producida_kg, estado, estado_registro FROM ${PRODUCTION_ORDERS_TABLE} WHERE id_orden = ? AND estado_registro = '${ACTIVE_STATE}' FOR UPDATE`,
};

const handlers = {
  'productionOrders.findAll': async () => {
    const [rows] = await pool.query(productionOrderQueries.findAll);
    return rows;
  },
  'productionOrders.findById': async ({ id }) => {
    const [rows] = await pool.query(productionOrderQueries.findById, [id]);
    return rows[0] || null;
  },
  'productionOrders.create': async ({
    id_producto,
    cantidad_solicitada_kg,
    fecha_solicitada,
    observaciones,
    id_usuario_creacion,
  }) => {
    const [result] = await pool.query(
      `INSERT INTO ${PRODUCTION_ORDERS_TABLE} (id_producto, cantidad_solicitada_kg, fecha_solicitada, observaciones, estado, id_usuario_creacion, id_usuario_modificacion, estado_registro) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id_producto,
        Number(cantidad_solicitada_kg),
        fecha_solicitada || null,
        normalizeNullableText(observaciones),
        PRODUCTION_ORDER_PENDIENTE_STATE,
        id_usuario_creacion,
        id_usuario_creacion,
        ACTIVE_STATE,
      ]
    );

    const [rows] = await pool.query(productionOrderQueries.findById, [result.insertId]);
    const created = rows[0] || null;

    await recordAudit(pool, {
      table: PRODUCTION_ORDERS_TABLE,
      recordId: result.insertId,
      action: AUDIT_ACTION_CREATE,
      before: null,
      after: created,
      userId: id_usuario_creacion,
    });

    return created;
  },
  'productionOrders.cancel': async ({ id, id_usuario_modificacion }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [rows] = await connection.query(productionOrderQueries.findForUpdate, [id]);

      if (rows.length === 0 || rows[0].estado !== PRODUCTION_ORDER_PENDIENTE_STATE) {
        await connection.rollback();
        return null;
      }

      const [beforeRows] = await connection.query(productionOrderQueries.findById, [id]);

      await connection.query(
        `UPDATE ${PRODUCTION_ORDERS_TABLE} SET estado = ?, id_usuario_modificacion = ? WHERE id_orden = ?`,
        [PRODUCTION_ORDER_CANCELADA_STATE, id_usuario_modificacion ?? null, id]
      );

      const [updated] = await connection.query(productionOrderQueries.findById, [id]);

      await recordAudit(connection, {
        table: PRODUCTION_ORDERS_TABLE,
        recordId: id,
        action: AUDIT_ACTION_UPDATE,
        before: beforeRows[0] || null,
        after: updated[0] || null,
        userId: id_usuario_modificacion,
      });

      await connection.commit();

      return updated[0] || null;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
};

module.exports = {
  handlers,
};
