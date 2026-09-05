const { pool } = require('../../config/db');
const {
  USERS_TABLE,
  SERVICE_TYPES_TABLE,
} = require('../shared/constants');
const { normalizeNullableText } = require('../shared/helpers');
const { AUDIT_ACTION_CREATE, AUDIT_ACTION_UPDATE, AUDIT_ACTION_DELETE, recordAudit } = require('../shared/audit');

const serviceTypeQueries = {
  findAll: `SELECT s.id_tipo_servicio, s.nombre_servicio, s.descripcion, s.km_frecuencia, s.fecha_modificacion, s.id_usuario_modificacion, u.nombre_completo AS usuario_modificacion_nombre FROM ${SERVICE_TYPES_TABLE} s LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = s.id_usuario_modificacion ORDER BY s.nombre_servicio ASC, s.id_tipo_servicio ASC`,
  findById: `SELECT s.id_tipo_servicio, s.nombre_servicio, s.descripcion, s.km_frecuencia, s.fecha_modificacion, s.id_usuario_modificacion, u.nombre_completo AS usuario_modificacion_nombre FROM ${SERVICE_TYPES_TABLE} s LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = s.id_usuario_modificacion WHERE s.id_tipo_servicio = ?`,
};

const handlers = {
  'serviceTypes.findAll': async () => {
    const [rows] = await pool.query(serviceTypeQueries.findAll);
    return rows;
  },
  'serviceTypes.findById': async ({ id }) => {
    const [rows] = await pool.query(serviceTypeQueries.findById, [id]);
    return rows[0] || null;
  },
  'serviceTypes.create': async ({ nombre_servicio, descripcion, km_frecuencia, id_usuario_modificacion }) => {
    const [result] = await pool.query(
      `INSERT INTO ${SERVICE_TYPES_TABLE} (nombre_servicio, descripcion, km_frecuencia, id_usuario_modificacion) VALUES (?, ?, ?, ?)`,
      [
        nombre_servicio,
        normalizeNullableText(descripcion),
        km_frecuencia === undefined || km_frecuencia === null || km_frecuencia === ''
          ? null
          : Number(km_frecuencia),
        id_usuario_modificacion ?? null,
      ]
    );

    const [rows] = await pool.query(serviceTypeQueries.findById, [result.insertId]);
    const created = rows[0] || null;

    await recordAudit(pool, {
      table: SERVICE_TYPES_TABLE,
      recordId: result.insertId,
      action: AUDIT_ACTION_CREATE,
      before: null,
      after: created,
      userId: id_usuario_modificacion,
    });

    return created;
  },
  'serviceTypes.update': async ({ id, nombre_servicio, descripcion, km_frecuencia, id_usuario_modificacion }) => {
    const [beforeRows] = await pool.query(serviceTypeQueries.findById, [id]);

    const [result] = await pool.query(
      `UPDATE ${SERVICE_TYPES_TABLE} SET nombre_servicio = ?, descripcion = ?, km_frecuencia = ?, id_usuario_modificacion = ? WHERE id_tipo_servicio = ?`,
      [
        nombre_servicio,
        normalizeNullableText(descripcion),
        km_frecuencia === undefined || km_frecuencia === null || km_frecuencia === ''
          ? null
          : Number(km_frecuencia),
        id_usuario_modificacion ?? null,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    const [rows] = await pool.query(serviceTypeQueries.findById, [id]);
    const updated = rows[0] || null;

    await recordAudit(pool, {
      table: SERVICE_TYPES_TABLE,
      recordId: id,
      action: AUDIT_ACTION_UPDATE,
      before: beforeRows[0] || null,
      after: updated,
      userId: id_usuario_modificacion,
    });

    return updated;
  },
  'serviceTypes.remove': async ({ id }) => {
    const [beforeRows] = await pool.query(serviceTypeQueries.findById, [id]);

    const [result] = await pool.query(
      `DELETE FROM ${SERVICE_TYPES_TABLE} WHERE id_tipo_servicio = ?`,
      [id]
    );

    if (result.affectedRows > 0) {
      await recordAudit(pool, {
        table: SERVICE_TYPES_TABLE,
        recordId: id,
        action: AUDIT_ACTION_DELETE,
        before: beforeRows[0] || null,
        after: null,
        userId: null,
      });
    }

    return result.affectedRows > 0;
  },
};

module.exports = {
  handlers,
};
