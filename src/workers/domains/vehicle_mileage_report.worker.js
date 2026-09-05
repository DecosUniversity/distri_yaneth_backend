const { pool } = require('../../config/db');
const {
  USERS_TABLE,
  VEHICLES_TABLE,
  VEHICLE_MILEAGE_REPORTS_TABLE,
} = require('../shared/constants');

const vehicleMileageReportQueries = {
  findAll: `SELECT r.id_reporte_kilometraje, r.id_vehiculo, v.placa AS vehiculo_placa, v.modelo AS vehiculo_modelo, r.id_usuario_modificador, u.nombre_completo AS usuario_nombre, u.username, r.kilometraje_registrado, r.fecha_reporte FROM ${VEHICLE_MILEAGE_REPORTS_TABLE} r LEFT JOIN ${VEHICLES_TABLE} v ON v.id_vehiculo = r.id_vehiculo LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = r.id_usuario_modificador ORDER BY r.fecha_reporte DESC, r.id_reporte_kilometraje DESC`,
};

const handlers = {
  'vehicleMileageReports.findAll': async () => {
    const [rows] = await pool.query(vehicleMileageReportQueries.findAll);
    return rows;
  },
};

module.exports = {
  handlers,
};
