const { pool } = require('../../config/db');
const {
  USERS_TABLE,
  CLIENTS_TABLE,
  ACTIVE_STATE,
  INACTIVE_STATE,
} = require('../shared/constants');
const { normalizeNullableText } = require('../shared/helpers');
const { AUDIT_ACTION_CREATE, AUDIT_ACTION_UPDATE, AUDIT_ACTION_DELETE, recordAudit } = require('../shared/audit');

const clientQueries = {
  findAll: `SELECT c.id_cliente, c.nombre_comercial, c.departamento, c.municipio, c.zona, c.direccion_entrega, c.telefono, c.nit_facturacion, c.estado_registro, c.fecha_modificacion, c.id_usuario_modificacion, u.nombre_completo AS usuario_modificacion_nombre FROM ${CLIENTS_TABLE} c LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = c.id_usuario_modificacion WHERE c.estado_registro = '${ACTIVE_STATE}'`,
  findById: `SELECT c.id_cliente, c.nombre_comercial, c.departamento, c.municipio, c.zona, c.direccion_entrega, c.telefono, c.nit_facturacion, c.estado_registro, c.fecha_modificacion, c.id_usuario_modificacion, u.nombre_completo AS usuario_modificacion_nombre FROM ${CLIENTS_TABLE} c LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = c.id_usuario_modificacion WHERE c.id_cliente = ? AND c.estado_registro = '${ACTIVE_STATE}'`,
};

const handlers = {
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
    departamento,
    municipio,
    zona,
    direccion_entrega,
    telefono,
    nit_facturacion,
    estado_registro,
    id_usuario_modificacion,
  }) => {
    const [result] = await pool.query(
      `INSERT INTO ${CLIENTS_TABLE} (nombre_comercial, departamento, municipio, zona, direccion_entrega, telefono, nit_facturacion, estado_registro, id_usuario_modificacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre_comercial,
        normalizeNullableText(departamento),
        normalizeNullableText(municipio),
        normalizeNullableText(zona),
        normalizeNullableText(direccion_entrega),
        normalizeNullableText(telefono),
        normalizeNullableText(nit_facturacion),
        estado_registro || ACTIVE_STATE,
        id_usuario_modificacion ?? null,
      ]
    );

    const [rows] = await pool.query(clientQueries.findById, [result.insertId]);
    const created = rows[0] || null;

    await recordAudit(pool, {
      table: CLIENTS_TABLE,
      recordId: result.insertId,
      action: AUDIT_ACTION_CREATE,
      before: null,
      after: created,
      userId: id_usuario_modificacion,
    });

    return created;
  },
  'clients.update': async ({
    id,
    nombre_comercial,
    departamento,
    municipio,
    zona,
    direccion_entrega,
    telefono,
    nit_facturacion,
    estado_registro,
    id_usuario_modificacion,
  }) => {
    const [beforeRows] = await pool.query(clientQueries.findById, [id]);

    const [result] = await pool.query(
      `UPDATE ${CLIENTS_TABLE} SET nombre_comercial = ?, departamento = ?, municipio = ?, zona = ?, direccion_entrega = ?, telefono = ?, nit_facturacion = ?, estado_registro = COALESCE(?, estado_registro), id_usuario_modificacion = ? WHERE id_cliente = ? AND estado_registro = '${ACTIVE_STATE}'`,
      [
        nombre_comercial,
        normalizeNullableText(departamento),
        normalizeNullableText(municipio),
        normalizeNullableText(zona),
        normalizeNullableText(direccion_entrega),
        normalizeNullableText(telefono),
        normalizeNullableText(nit_facturacion),
        estado_registro ?? null,
        id_usuario_modificacion ?? null,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    const [rows] = await pool.query(clientQueries.findById, [id]);
    const updated = rows[0] || null;

    await recordAudit(pool, {
      table: CLIENTS_TABLE,
      recordId: id,
      action: AUDIT_ACTION_UPDATE,
      before: beforeRows[0] || null,
      after: updated,
      userId: id_usuario_modificacion,
    });

    return updated;
  },
  'clients.remove': async ({ id, id_usuario_modificacion }) => {
    const [beforeRows] = await pool.query(clientQueries.findById, [id]);

    const [result] = await pool.query(
      `UPDATE ${CLIENTS_TABLE} SET estado_registro = '${INACTIVE_STATE}', id_usuario_modificacion = ? WHERE id_cliente = ? AND estado_registro = '${ACTIVE_STATE}'`,
      [id_usuario_modificacion ?? null, id]
    );

    if (result.affectedRows > 0) {
      await recordAudit(pool, {
        table: CLIENTS_TABLE,
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
