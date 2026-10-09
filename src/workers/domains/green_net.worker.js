const { pool } = require('../../config/db');
const {
  USERS_TABLE,
  INVENTORY_TABLE,
  PRODUCTS_TABLE,
  ENTRIES_TABLE,
  RAW_MATERIAL_LOTS_TABLE,
  MATURATION_SUBLOT_TABLE,
  GREEN_NET_TABLE,
} = require('../shared/constants');

const greenNetBaseQuery = `SELECT r.id_red, r.id_sublote, s.codigo_sublote, s.id_lote_mp, r.id_existencia, r.peso_kg, r.cantidad_redes, r.id_usuario, u.nombre_completo AS usuario_nombre, r.fecha_empaque, pr.id_producto, pr.nombre AS producto_nombre, l.id_proveedor AS id_proveedor_origen, l.id_entrada_origen AS id_entrada_origen, ent.codigo_lote FROM ${GREEN_NET_TABLE} r LEFT JOIN ${MATURATION_SUBLOT_TABLE} s ON s.id_sublote = r.id_sublote LEFT JOIN ${RAW_MATERIAL_LOTS_TABLE} l ON l.id_lote_mp = s.id_lote_mp LEFT JOIN ${ENTRIES_TABLE} ent ON ent.id_entrada = l.id_entrada_origen LEFT JOIN ${INVENTORY_TABLE} ie ON ie.id_existencia = r.id_existencia LEFT JOIN ${PRODUCTS_TABLE} pr ON pr.id_producto = ie.id_producto LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = r.id_usuario`;

const greenNetQueries = {
  findAll: `${greenNetBaseQuery} ORDER BY r.fecha_empaque DESC, r.id_red DESC`,
  findBySublot: `${greenNetBaseQuery} WHERE r.id_sublote = ? ORDER BY r.fecha_empaque DESC, r.id_red DESC`,
};

// El empaque de redes se estandarizo dentro de Produccion ("+ Empacar red", que reutiliza
// productionProcesses.create/addStage con un desglose de `cajas` en produccion_etapas): estos
// handlers solo sirven para consultar el historico de cajas registradas antes de ese cambio.
const handlers = {
  'greenNets.findAll': async () => {
    const [rows] = await pool.query(greenNetQueries.findAll);
    return rows;
  },
  'greenNets.findBySublot': async ({ id_sublote }) => {
    const [rows] = await pool.query(greenNetQueries.findBySublot, [id_sublote]);
    return rows;
  },
};

module.exports = {
  handlers,
};
