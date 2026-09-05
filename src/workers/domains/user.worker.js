const { pool } = require('../../config/db');
const {
  USERS_TABLE,
  ACTIVE_STATE,
  INACTIVE_STATE,
} = require('../shared/constants');
const { AUDIT_ACTION_CREATE, AUDIT_ACTION_UPDATE, AUDIT_ACTION_DELETE, recordAudit } = require('../shared/audit');

const userQueries = {
  findAll: `SELECT u.id_usuario, u.nombre_completo, u.username, u.password_hash, u.rol, u.estado_registro, u.fecha_modificacion, u.id_usuario_modificacion, um.nombre_completo AS usuario_modificacion_nombre FROM ${USERS_TABLE} u LEFT JOIN ${USERS_TABLE} um ON um.id_usuario = u.id_usuario_modificacion WHERE u.estado_registro = '${ACTIVE_STATE}'`,
  findById: `SELECT u.id_usuario, u.nombre_completo, u.username, u.password_hash, u.rol, u.estado_registro, u.fecha_modificacion, u.id_usuario_modificacion, um.nombre_completo AS usuario_modificacion_nombre FROM ${USERS_TABLE} u LEFT JOIN ${USERS_TABLE} um ON um.id_usuario = u.id_usuario_modificacion WHERE u.id_usuario = ? AND u.estado_registro = '${ACTIVE_STATE}'`,
  findByUsername: `SELECT id_usuario, nombre_completo, username, password_hash, rol, estado_registro, fecha_modificacion FROM ${USERS_TABLE} WHERE username = ? AND estado_registro = '${ACTIVE_STATE}' LIMIT 1`,
};

// La contrasena (aunque ya viene hasheada) nunca se guarda en el historial de auditoria.
const sanitizeUserForAudit = (row) => {
  if (!row) {
    return row;
  }

  const { password_hash, ...safeRow } = row;
  return safeRow;
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
  'users.create': async ({ nombre_completo, username, password_hash, rol, estado_registro, id_usuario_modificacion }) => {
    const [result] = await pool.query(
      `INSERT INTO ${USERS_TABLE} (nombre_completo, username, password_hash, rol, estado_registro, id_usuario_modificacion) VALUES (?, ?, ?, ?, ?, ?)`,
      [nombre_completo, username, password_hash, rol, estado_registro || ACTIVE_STATE, id_usuario_modificacion ?? null]
    );
    const [rows] = await pool.query(userQueries.findById, [result.insertId]);
    const created = rows[0] || null;

    await recordAudit(pool, {
      table: USERS_TABLE,
      recordId: result.insertId,
      action: AUDIT_ACTION_CREATE,
      before: null,
      after: sanitizeUserForAudit(created),
      userId: id_usuario_modificacion,
    });

    return created;
  },
  'users.update': async ({ id, nombre_completo, username, password_hash, rol, estado_registro, id_usuario_modificacion }) => {
    const [beforeRows] = await pool.query(userQueries.findById, [id]);

    const [result] = await pool.query(
      `UPDATE ${USERS_TABLE} SET nombre_completo = ?, username = ?, password_hash = ?, rol = ?, estado_registro = COALESCE(?, estado_registro), id_usuario_modificacion = ? WHERE id_usuario = ? AND estado_registro = '${ACTIVE_STATE}'`,
      [nombre_completo, username, password_hash, rol, estado_registro ?? null, id_usuario_modificacion ?? null, id]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    const [rows] = await pool.query(userQueries.findById, [id]);
    const updated = rows[0] || null;

    await recordAudit(pool, {
      table: USERS_TABLE,
      recordId: id,
      action: AUDIT_ACTION_UPDATE,
      before: sanitizeUserForAudit(beforeRows[0] || null),
      after: sanitizeUserForAudit(updated),
      userId: id_usuario_modificacion,
    });

    return updated;
  },
  'users.resetPassword': async ({ id, password_hash, id_usuario_modificacion }) => {
    const [result] = await pool.query(
      `UPDATE ${USERS_TABLE} SET password_hash = ?, id_usuario_modificacion = ? WHERE id_usuario = ? AND estado_registro = '${ACTIVE_STATE}'`,
      [password_hash, id_usuario_modificacion ?? null, id]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    const [rows] = await pool.query(userQueries.findById, [id]);
    const updated = rows[0] || null;

    // No se registran hashes de contrasena en el historial, solo que el evento ocurrio.
    await recordAudit(pool, {
      table: USERS_TABLE,
      recordId: id,
      action: AUDIT_ACTION_UPDATE,
      before: { evento: 'Restablecimiento de contrasena' },
      after: { evento: 'Restablecimiento de contrasena' },
      userId: id_usuario_modificacion,
    });

    return updated;
  },
  'users.remove': async ({ id, id_usuario_modificacion }) => {
    const [beforeRows] = await pool.query(userQueries.findById, [id]);

    const [result] = await pool.query(
      `UPDATE ${USERS_TABLE} SET estado_registro = '${INACTIVE_STATE}', id_usuario_modificacion = ? WHERE id_usuario = ? AND estado_registro = '${ACTIVE_STATE}'`,
      [id_usuario_modificacion ?? null, id]
    );

    if (result.affectedRows > 0) {
      await recordAudit(pool, {
        table: USERS_TABLE,
        recordId: id,
        action: AUDIT_ACTION_DELETE,
        before: sanitizeUserForAudit(beforeRows[0] || null),
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
