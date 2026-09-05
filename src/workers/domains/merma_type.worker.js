const { pool } = require('../../config/db');
const {
  USERS_TABLE,
  CAT_MERMA_TABLE,
  ACTIVE_STATE,
  INACTIVE_STATE,
} = require('../shared/constants');
const { normalizeNullableText } = require('../shared/helpers');
const { AUDIT_ACTION_CREATE, AUDIT_ACTION_UPDATE, AUDIT_ACTION_DELETE, recordAudit } = require('../shared/audit');

const mermaTypeQueries = {
  findAll: `SELECT c.id_tipo_merma, c.nombre_merma, c.descripcion, c.estado_registro, c.fecha_modificacion, c.id_usuario_modificacion, um.nombre_completo AS usuario_modificacion_nombre FROM ${CAT_MERMA_TABLE} c LEFT JOIN ${USERS_TABLE} um ON um.id_usuario = c.id_usuario_modificacion WHERE c.estado_registro = '${ACTIVE_STATE}' ORDER BY c.nombre_merma ASC`,
  findById: `SELECT c.id_tipo_merma, c.nombre_merma, c.descripcion, c.estado_registro, c.fecha_modificacion, c.id_usuario_modificacion, um.nombre_completo AS usuario_modificacion_nombre FROM ${CAT_MERMA_TABLE} c LEFT JOIN ${USERS_TABLE} um ON um.id_usuario = c.id_usuario_modificacion WHERE c.id_tipo_merma = ?`,
};

const handlers = {
  'mermaTypes.findAll': async () => {
    const [rows] = await pool.query(mermaTypeQueries.findAll);
    return rows;
  },
  'mermaTypes.findById': async ({ id }) => {
    const [rows] = await pool.query(mermaTypeQueries.findById, [id]);
    return rows[0] || null;
  },
  'mermaTypes.create': async ({ nombre_merma, descripcion, id_usuario_modificacion }) => {
    const [result] = await pool.query(
      `INSERT INTO ${CAT_MERMA_TABLE} (nombre_merma, descripcion, estado_registro, id_usuario_modificacion) VALUES (?, ?, ?, ?)`,
      [nombre_merma, normalizeNullableText(descripcion), ACTIVE_STATE, id_usuario_modificacion ?? null]
    );

    const [rows] = await pool.query(mermaTypeQueries.findById, [result.insertId]);
    const created = rows[0] || null;

    await recordAudit(pool, {
      table: CAT_MERMA_TABLE,
      recordId: result.insertId,
      action: AUDIT_ACTION_CREATE,
      before: null,
      after: created,
      userId: id_usuario_modificacion,
    });

    return created;
  },
  'mermaTypes.update': async ({ id, nombre_merma, descripcion, id_usuario_modificacion }) => {
    const [beforeRows] = await pool.query(mermaTypeQueries.findById, [id]);

    const [result] = await pool.query(
      `UPDATE ${CAT_MERMA_TABLE} SET nombre_merma = ?, descripcion = ?, id_usuario_modificacion = ? WHERE id_tipo_merma = ? AND estado_registro = '${ACTIVE_STATE}'`,
      [nombre_merma, normalizeNullableText(descripcion), id_usuario_modificacion ?? null, id]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    const [rows] = await pool.query(mermaTypeQueries.findById, [id]);
    const updated = rows[0] || null;

    await recordAudit(pool, {
      table: CAT_MERMA_TABLE,
      recordId: id,
      action: AUDIT_ACTION_UPDATE,
      before: beforeRows[0] || null,
      after: updated,
      userId: id_usuario_modificacion,
    });

    return updated;
  },
  'mermaTypes.remove': async ({ id, id_usuario_modificacion }) => {
    const [beforeRows] = await pool.query(mermaTypeQueries.findById, [id]);

    const [result] = await pool.query(
      `UPDATE ${CAT_MERMA_TABLE} SET estado_registro = '${INACTIVE_STATE}', id_usuario_modificacion = ? WHERE id_tipo_merma = ? AND estado_registro = '${ACTIVE_STATE}'`,
      [id_usuario_modificacion ?? null, id]
    );

    if (result.affectedRows > 0) {
      await recordAudit(pool, {
        table: CAT_MERMA_TABLE,
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
