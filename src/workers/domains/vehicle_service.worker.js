const { pool } = require('../../config/db');
const {
  USERS_TABLE,
  SERVICE_TYPES_TABLE,
  VEHICLES_TABLE,
  VEHICLE_SERVICES_TABLE,
} = require('../shared/constants');
const { normalizeNullableText } = require('../shared/helpers');
const { AUDIT_ACTION_CREATE, AUDIT_ACTION_UPDATE, AUDIT_ACTION_DELETE, recordAudit } = require('../shared/audit');

const vehicleServiceQueries = {
  findAll: `SELECT sv.id_servicio, sv.id_vehiculo, v.placa AS vehiculo_placa, v.modelo AS vehiculo_modelo, sv.id_tipo_servicio, ts.nombre_servicio AS tipo_servicio_nombre, sv.fecha_servicio, sv.km_en_servicio, sv.costo_servicio, sv.proximo_servicio_km, sv.notas, sv.fecha_modificacion, sv.id_usuario_modificacion, u.nombre_completo AS usuario_modificacion_nombre FROM ${VEHICLE_SERVICES_TABLE} sv LEFT JOIN ${VEHICLES_TABLE} v ON v.id_vehiculo = sv.id_vehiculo LEFT JOIN ${SERVICE_TYPES_TABLE} ts ON ts.id_tipo_servicio = sv.id_tipo_servicio LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = sv.id_usuario_modificacion ORDER BY sv.fecha_servicio DESC, sv.id_servicio DESC`,
  findById: `SELECT sv.id_servicio, sv.id_vehiculo, v.placa AS vehiculo_placa, v.modelo AS vehiculo_modelo, sv.id_tipo_servicio, ts.nombre_servicio AS tipo_servicio_nombre, sv.fecha_servicio, sv.km_en_servicio, sv.costo_servicio, sv.proximo_servicio_km, sv.notas, sv.fecha_modificacion, sv.id_usuario_modificacion, u.nombre_completo AS usuario_modificacion_nombre FROM ${VEHICLE_SERVICES_TABLE} sv LEFT JOIN ${VEHICLES_TABLE} v ON v.id_vehiculo = sv.id_vehiculo LEFT JOIN ${SERVICE_TYPES_TABLE} ts ON ts.id_tipo_servicio = sv.id_tipo_servicio LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = sv.id_usuario_modificacion WHERE sv.id_servicio = ?`,
};

const handlers = {
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
    id_usuario_modificacion,
  }) => {
    const [result] = await pool.query(
      `INSERT INTO ${VEHICLE_SERVICES_TABLE} (id_vehiculo, id_tipo_servicio, fecha_servicio, km_en_servicio, costo_servicio, proximo_servicio_km, notas, id_usuario_modificacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
        id_usuario_modificacion ?? null,
      ]
    );

    const [rows] = await pool.query(vehicleServiceQueries.findById, [result.insertId]);
    const created = rows[0] || null;

    await recordAudit(pool, {
      table: VEHICLE_SERVICES_TABLE,
      recordId: result.insertId,
      action: AUDIT_ACTION_CREATE,
      before: null,
      after: created,
      userId: id_usuario_modificacion,
    });

    return created;
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
    id_usuario_modificacion,
  }) => {
    const [beforeRows] = await pool.query(vehicleServiceQueries.findById, [id]);

    const [result] = await pool.query(
      `UPDATE ${VEHICLE_SERVICES_TABLE} SET id_vehiculo = ?, id_tipo_servicio = ?, fecha_servicio = ?, km_en_servicio = ?, costo_servicio = ?, proximo_servicio_km = ?, notas = ?, id_usuario_modificacion = ? WHERE id_servicio = ?`,
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
        id_usuario_modificacion ?? null,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    const [rows] = await pool.query(vehicleServiceQueries.findById, [id]);
    const updated = rows[0] || null;

    await recordAudit(pool, {
      table: VEHICLE_SERVICES_TABLE,
      recordId: id,
      action: AUDIT_ACTION_UPDATE,
      before: beforeRows[0] || null,
      after: updated,
      userId: id_usuario_modificacion,
    });

    return updated;
  },
  'vehicleServices.remove': async ({ id }) => {
    const [beforeRows] = await pool.query(vehicleServiceQueries.findById, [id]);

    const [result] = await pool.query(`DELETE FROM ${VEHICLE_SERVICES_TABLE} WHERE id_servicio = ?`, [id]);

    if (result.affectedRows > 0) {
      await recordAudit(pool, {
        table: VEHICLE_SERVICES_TABLE,
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
