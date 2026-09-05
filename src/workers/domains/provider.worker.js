const { pool } = require('../../config/db');
const {
  USERS_TABLE,
  PROVIDERS_TABLE,
  ACTIVE_STATE,
  INACTIVE_STATE,
} = require('../shared/constants');
const { AUDIT_ACTION_CREATE, AUDIT_ACTION_UPDATE, AUDIT_ACTION_DELETE, recordAudit } = require('../shared/audit');

const providerQueries = {
  findAll: `SELECT p.id_proveedor, p.nombre_empresa, p.nit, p.contacto_nombre, p.telefono, p.estado_registro, p.fecha_modificacion, p.id_usuario_modificacion, u.nombre_completo AS usuario_modificacion_nombre FROM ${PROVIDERS_TABLE} p LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = p.id_usuario_modificacion WHERE p.estado_registro = '${ACTIVE_STATE}'`,
  findById: `SELECT p.id_proveedor, p.nombre_empresa, p.nit, p.contacto_nombre, p.telefono, p.estado_registro, p.fecha_modificacion, p.id_usuario_modificacion, u.nombre_completo AS usuario_modificacion_nombre FROM ${PROVIDERS_TABLE} p LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = p.id_usuario_modificacion WHERE p.id_proveedor = ? AND p.estado_registro = '${ACTIVE_STATE}'`,
};

const handlers = {
  'providers.findAll': async () => {
    const [rows] = await pool.query(providerQueries.findAll);
    return rows;
  },
  'providers.findById': async ({ id }) => {
    const [rows] = await pool.query(providerQueries.findById, [id]);
    return rows[0] || null;
  },
  'providers.create': async ({ nombre_empresa, nit, contacto_nombre, telefono, estado_registro, id_usuario_modificacion }) => {
    const [result] = await pool.query(
      `INSERT INTO ${PROVIDERS_TABLE} (nombre_empresa, nit, contacto_nombre, telefono, estado_registro, id_usuario_modificacion) VALUES (?, ?, ?, ?, ?, ?)`,
      [nombre_empresa, nit ?? null, contacto_nombre ?? null, telefono ?? null, estado_registro || ACTIVE_STATE, id_usuario_modificacion ?? null]
    );

    const [rows] = await pool.query(providerQueries.findById, [result.insertId]);
    const created = rows[0] || null;

    await recordAudit(pool, {
      table: PROVIDERS_TABLE,
      recordId: result.insertId,
      action: AUDIT_ACTION_CREATE,
      before: null,
      after: created,
      userId: id_usuario_modificacion,
    });

    return created;
  },
  'providers.update': async ({ id, nombre_empresa, nit, contacto_nombre, telefono, estado_registro, id_usuario_modificacion }) => {
    const [beforeRows] = await pool.query(providerQueries.findById, [id]);

    const [result] = await pool.query(
      `UPDATE ${PROVIDERS_TABLE} SET nombre_empresa = ?, nit = ?, contacto_nombre = ?, telefono = ?, estado_registro = COALESCE(?, estado_registro), id_usuario_modificacion = ? WHERE id_proveedor = ? AND estado_registro = '${ACTIVE_STATE}'`,
      [nombre_empresa, nit ?? null, contacto_nombre ?? null, telefono ?? null, estado_registro ?? null, id_usuario_modificacion ?? null, id]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    const [rows] = await pool.query(providerQueries.findById, [id]);
    const updated = rows[0] || null;

    await recordAudit(pool, {
      table: PROVIDERS_TABLE,
      recordId: id,
      action: AUDIT_ACTION_UPDATE,
      before: beforeRows[0] || null,
      after: updated,
      userId: id_usuario_modificacion,
    });

    return updated;
  },
  'providers.remove': async ({ id, id_usuario_modificacion }) => {
    const [beforeRows] = await pool.query(providerQueries.findById, [id]);

    const [result] = await pool.query(
      `UPDATE ${PROVIDERS_TABLE} SET estado_registro = '${INACTIVE_STATE}', id_usuario_modificacion = ? WHERE id_proveedor = ? AND estado_registro = '${ACTIVE_STATE}'`,
      [id_usuario_modificacion ?? null, id]
    );

    if (result.affectedRows > 0) {
      await recordAudit(pool, {
        table: PROVIDERS_TABLE,
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
