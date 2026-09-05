const { pool } = require('../../config/db');
const {
  USERS_TABLE,
  VEHICLES_TABLE,
  VEHICLE_MILEAGE_REPORTS_TABLE,
  ACTIVE_STATE,
  INACTIVE_STATE,
} = require('../shared/constants');
const { AUDIT_ACTION_CREATE, AUDIT_ACTION_UPDATE, AUDIT_ACTION_DELETE, recordAudit } = require('../shared/audit');

const vehicleQueries = {
  findAll: `SELECT v.id_vehiculo, v.placa, v.modelo, v.estado, v.kilometraje_actual, v.estado_registro, v.fecha_modificacion, v.id_usuario_modificacion, u.nombre_completo AS usuario_modificacion_nombre FROM ${VEHICLES_TABLE} v LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = v.id_usuario_modificacion WHERE v.estado_registro = '${ACTIVE_STATE}'`,
  findById: `SELECT v.id_vehiculo, v.placa, v.modelo, v.estado, v.kilometraje_actual, v.estado_registro, v.fecha_modificacion, v.id_usuario_modificacion, u.nombre_completo AS usuario_modificacion_nombre FROM ${VEHICLES_TABLE} v LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = v.id_usuario_modificacion WHERE v.id_vehiculo = ? AND v.estado_registro = '${ACTIVE_STATE}'`,
};

const handlers = {
  'vehicles.findAll': async () => {
    const [rows] = await pool.query(vehicleQueries.findAll);
    return rows;
  },
  'vehicles.findById': async ({ id }) => {
    const [rows] = await pool.query(vehicleQueries.findById, [id]);
    return rows[0] || null;
  },
  'vehicles.create': async ({ placa, modelo, estado, kilometraje_actual, estado_registro, id_usuario_modificacion }) => {
    const [result] = await pool.query(
      `INSERT INTO ${VEHICLES_TABLE} (placa, modelo, estado, kilometraje_actual, estado_registro, id_usuario_modificacion) VALUES (?, ?, ?, ?, ?, ?)`,
      [placa, modelo ?? null, estado ?? 'Disponible', kilometraje_actual ?? 0, estado_registro || ACTIVE_STATE, id_usuario_modificacion ?? null]
    );

    const [rows] = await pool.query(vehicleQueries.findById, [result.insertId]);
    const created = rows[0] || null;

    await recordAudit(pool, {
      table: VEHICLES_TABLE,
      recordId: result.insertId,
      action: AUDIT_ACTION_CREATE,
      before: null,
      after: created,
      userId: id_usuario_modificacion,
    });

    return created;
  },
  'vehicles.update': async ({
    id,
    placa,
    modelo,
    estado,
    kilometraje_actual,
    estado_registro,
    id_usuario_modificador,
  }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [existingRows] = await connection.query(
        `SELECT id_vehiculo, kilometraje_actual FROM ${VEHICLES_TABLE} WHERE id_vehiculo = ? AND estado_registro = '${ACTIVE_STATE}'`,
        [id]
      );

      if (existingRows.length === 0) {
        await connection.rollback();
        return null;
      }

      const [beforeRows] = await connection.query(vehicleQueries.findById, [id]);
      const currentVehicle = existingRows[0];
      const previousMileage = Number(currentVehicle.kilometraje_actual);
      const nextMileage =
        kilometraje_actual === undefined || kilometraje_actual === null || kilometraje_actual === ''
          ? previousMileage
          : Number(kilometraje_actual);

      const [result] = await connection.query(
        `UPDATE ${VEHICLES_TABLE} SET placa = ?, modelo = ?, estado = ?, kilometraje_actual = ?, estado_registro = COALESCE(?, estado_registro), id_usuario_modificacion = ? WHERE id_vehiculo = ? AND estado_registro = '${ACTIVE_STATE}'`,
        [placa, modelo ?? null, estado ?? 'Disponible', nextMileage, estado_registro ?? null, id_usuario_modificador ?? null, id]
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        return null;
      }

      if (Number.isFinite(nextMileage) && nextMileage !== previousMileage) {
        const [mileageResult] = await connection.query(
          `INSERT INTO ${VEHICLE_MILEAGE_REPORTS_TABLE} (id_vehiculo, id_usuario_modificador, kilometraje_registrado) VALUES (?, ?, ?)`,
          [id, id_usuario_modificador, nextMileage]
        );

        await recordAudit(connection, {
          table: VEHICLE_MILEAGE_REPORTS_TABLE,
          recordId: mileageResult.insertId,
          action: AUDIT_ACTION_CREATE,
          before: null,
          after: { id_vehiculo: id, id_usuario_modificador, kilometraje_registrado: nextMileage },
          userId: id_usuario_modificador,
        });
      }

      const [rows] = await connection.query(vehicleQueries.findById, [id]);
      const updated = rows[0] || null;

      await recordAudit(connection, {
        table: VEHICLES_TABLE,
        recordId: id,
        action: AUDIT_ACTION_UPDATE,
        before: beforeRows[0] || null,
        after: updated,
        userId: id_usuario_modificador,
      });

      await connection.commit();

      return updated;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'vehicles.remove': async ({ id, id_usuario_modificacion }) => {
    const [beforeRows] = await pool.query(vehicleQueries.findById, [id]);

    const [result] = await pool.query(
      `UPDATE ${VEHICLES_TABLE} SET estado_registro = '${INACTIVE_STATE}', id_usuario_modificacion = ? WHERE id_vehiculo = ? AND estado_registro = '${ACTIVE_STATE}'`,
      [id_usuario_modificacion ?? null, id]
    );

    if (result.affectedRows > 0) {
      await recordAudit(pool, {
        table: VEHICLES_TABLE,
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
