const { pool } = require('../../config/db');
const { USERS_TABLE } = require('../shared/constants');

const AUDIT_TABLE = 'auditoria_cambios';

const auditBaseQuery = `SELECT a.id_auditoria, a.tabla_afectada, a.id_registro_afectado, a.accion, a.valores_anteriores, a.valores_nuevos, a.id_usuario, u.nombre_completo AS usuario_nombre, a.fecha_accion FROM ${AUDIT_TABLE} a LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = a.id_usuario`;

const auditQueries = {
  findAll: `${auditBaseQuery} ORDER BY a.fecha_accion DESC, a.id_auditoria DESC LIMIT 500`,
  findByTable: `${auditBaseQuery} WHERE a.tabla_afectada = ? ORDER BY a.fecha_accion DESC, a.id_auditoria DESC LIMIT 500`,
  findByRecord: `${auditBaseQuery} WHERE a.tabla_afectada = ? AND a.id_registro_afectado = ? ORDER BY a.fecha_accion DESC, a.id_auditoria DESC`,
  findTables: `SELECT DISTINCT tabla_afectada FROM ${AUDIT_TABLE} ORDER BY tabla_afectada ASC`,
};

const parseJsonColumn = (row) => ({
  ...row,
  valores_anteriores: typeof row.valores_anteriores === 'string' ? JSON.parse(row.valores_anteriores) : row.valores_anteriores,
  valores_nuevos: typeof row.valores_nuevos === 'string' ? JSON.parse(row.valores_nuevos) : row.valores_nuevos,
});

const handlers = {
  'audit.findAll': async () => {
    const [rows] = await pool.query(auditQueries.findAll);
    return rows.map(parseJsonColumn);
  },
  'audit.findByTable': async ({ tabla }) => {
    const [rows] = await pool.query(auditQueries.findByTable, [tabla]);
    return rows.map(parseJsonColumn);
  },
  'audit.findByRecord': async ({ tabla, id }) => {
    const [rows] = await pool.query(auditQueries.findByRecord, [tabla, String(id)]);
    return rows.map(parseJsonColumn);
  },
  'audit.findTables': async () => {
    const [rows] = await pool.query(auditQueries.findTables);
    return rows.map((row) => row.tabla_afectada);
  },
};

module.exports = {
  handlers,
};
