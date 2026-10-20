const { pool } = require('../../config/db');
const {
  USERS_TABLE,
  CAT_COLD_ROOM_TABLE,
  ACTIVE_STATE,
  INACTIVE_STATE,
} = require('../shared/constants');
const { normalizeNullableText } = require('../shared/helpers');
const { AUDIT_ACTION_CREATE, AUDIT_ACTION_UPDATE, AUDIT_ACTION_DELETE, recordAudit } = require('../shared/audit');

const coldRoomTypeQueries = {
  findAll: `SELECT c.id_cuarto_frio, c.nombre_cuarto, c.descripcion, c.estado_registro, c.fecha_modificacion, c.id_usuario_modificacion, um.nombre_completo AS usuario_modificacion_nombre FROM ${CAT_COLD_ROOM_TABLE} c LEFT JOIN ${USERS_TABLE} um ON um.id_usuario = c.id_usuario_modificacion WHERE c.estado_registro = '${ACTIVE_STATE}' ORDER BY c.nombre_cuarto ASC`,
  findById: `SELECT c.id_cuarto_frio, c.nombre_cuarto, c.descripcion, c.estado_registro, c.fecha_modificacion, c.id_usuario_modificacion, um.nombre_completo AS usuario_modificacion_nombre FROM ${CAT_COLD_ROOM_TABLE} c LEFT JOIN ${USERS_TABLE} um ON um.id_usuario = c.id_usuario_modificacion WHERE c.id_cuarto_frio = ?`,
};

const handlers = {
  'coldRoomTypes.findAll': async () => {
    const [rows] = await pool.query(coldRoomTypeQueries.findAll);
    return rows;
  },
  'coldRoomTypes.findById': async ({ id }) => {
    const [rows] = await pool.query(coldRoomTypeQueries.findById, [id]);
    return rows[0] || null;
  },
  'coldRoomTypes.create': async ({ nombre_cuarto, descripcion, id_usuario_modificacion }) => {
    const [result] = await pool.query(
      `INSERT INTO ${CAT_COLD_ROOM_TABLE} (nombre_cuarto, descripcion, estado_registro, id_usuario_modificacion) VALUES (?, ?, ?, ?)`,
      [nombre_cuarto, normalizeNullableText(descripcion), ACTIVE_STATE, id_usuario_modificacion ?? null]
    );

    const [rows] = await pool.query(coldRoomTypeQueries.findById, [result.insertId]);
    const created = rows[0] || null;

    await recordAudit(pool, {
      table: CAT_COLD_ROOM_TABLE,
      recordId: result.insertId,
      action: AUDIT_ACTION_CREATE,
      before: null,
      after: created,
      userId: id_usuario_modificacion,
    });

    return created;
  },
  'coldRoomTypes.update': async ({ id, nombre_cuarto, descripcion, id_usuario_modificacion }) => {
    const [beforeRows] = await pool.query(coldRoomTypeQueries.findById, [id]);

    const [result] = await pool.query(
      `UPDATE ${CAT_COLD_ROOM_TABLE} SET nombre_cuarto = ?, descripcion = ?, id_usuario_modificacion = ? WHERE id_cuarto_frio = ? AND estado_registro = '${ACTIVE_STATE}'`,
      [nombre_cuarto, normalizeNullableText(descripcion), id_usuario_modificacion ?? null, id]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    const [rows] = await pool.query(coldRoomTypeQueries.findById, [id]);
    const updated = rows[0] || null;

    await recordAudit(pool, {
      table: CAT_COLD_ROOM_TABLE,
      recordId: id,
      action: AUDIT_ACTION_UPDATE,
      before: beforeRows[0] || null,
      after: updated,
      userId: id_usuario_modificacion,
    });

    return updated;
  },
  'coldRoomTypes.remove': async ({ id, id_usuario_modificacion }) => {
    const [beforeRows] = await pool.query(coldRoomTypeQueries.findById, [id]);

    const [result] = await pool.query(
      `UPDATE ${CAT_COLD_ROOM_TABLE} SET estado_registro = '${INACTIVE_STATE}', id_usuario_modificacion = ? WHERE id_cuarto_frio = ? AND estado_registro = '${ACTIVE_STATE}'`,
      [id_usuario_modificacion ?? null, id]
    );

    if (result.affectedRows > 0) {
      await recordAudit(pool, {
        table: CAT_COLD_ROOM_TABLE,
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
