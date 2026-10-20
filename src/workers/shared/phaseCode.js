// Codigo legible por fase: PREFIJO-NNNNNN (ej. SUB-000009). Resuelve la ambiguedad de buscar
// "9" (que coincide con la entrada #9, el lote #9, el sub-lote #9...).
//
// Se GUARDA en la columna codigo_trazabilidad de cada tabla (ver PHASE_CODE_COLUMNS). MariaDB
// 10.4 no permite una columna generada a partir del AUTO_INCREMENT, asi que cada INSERT de esas
// tablas debe llamar a assignPhaseCode() con el insertId, en la misma conexion/transaccion.
// Los registros historicos se rellenaron en la migracion
// 2026-10-09_add_codigo_trazabilidad.sql. El espejo en el frontend es
// Frontend/src/utils/phaseCode.js: si se agrega un prefijo aqui, agregarlo tambien alla.
//
// La entrada no tiene esta columna: ya guarda su codigo_lote (ej. AGU-261008-002), el impreso
// en etiquetas; ENT-NNNNNN es solo un alias calculado para buscarla por ID.
const {
  RAW_MATERIAL_LOTS_TABLE,
  MATURATION_SUBLOT_TABLE,
  PRODUCTION_TABLE,
  GREEN_NET_TABLE,
  INVENTORY_TABLE,
  ORDERS_TABLE,
} = require('./constants');

const PHASE_CODE_COLUMN = 'codigo_trazabilidad';

const PHASE_CODE_COLUMNS = {
  lote: { table: RAW_MATERIAL_LOTS_TABLE, idColumn: 'id_lote_mp' },
  sublote: { table: MATURATION_SUBLOT_TABLE, idColumn: 'id_sublote' },
  proceso: { table: PRODUCTION_TABLE, idColumn: 'id_proceso' },
  red: { table: GREEN_NET_TABLE, idColumn: 'id_red' },
  existencia: { table: INVENTORY_TABLE, idColumn: 'id_existencia' },
  pedido: { table: ORDERS_TABLE, idColumn: 'id_pedido' },
};
const PHASE_CODE_PREFIXES = {
  entrada: 'ENT',
  lote: 'LMP',
  sublote: 'SUB',
  proceso: 'PRO',
  red: 'RED',
  existencia: 'EXI',
  pedido: 'PED',
};

const PHASE_CODE_DIGITS = 6;

const TYPE_BY_PREFIX = Object.fromEntries(Object.entries(PHASE_CODE_PREFIXES).map(([tipo, prefix]) => [prefix, tipo]));

// Acepta SUB-000009, SUB-9, sub9 o "SUB 9". No choca con codigo_lote (AGU-261008-002), que
// tiene dos guiones.
const PHASE_CODE_PATTERN = new RegExp(`^(${Object.values(PHASE_CODE_PREFIXES).join('|')})[-\\s]?(\\d+)$`, 'i');

const formatPhaseCode = (tipo, id) => {
  const prefix = PHASE_CODE_PREFIXES[tipo];

  if (!prefix || id === null || id === undefined) {
    return null;
  }

  return `${prefix}-${String(id).padStart(PHASE_CODE_DIGITS, '0')}`;
};

const parsePhaseCode = (value) => {
  const match = PHASE_CODE_PATTERN.exec(String(value || '').trim());

  if (!match) {
    return null;
  }

  const id = Number.parseInt(match[2], 10);
  return id > 0 ? { tipo: TYPE_BY_PREFIX[match[1].toUpperCase()], id } : null;
};

// Guarda el codigo recien generado. `db` es la misma conexion (o pool) que hizo el INSERT, para
// que quede dentro de la misma transaccion y un rollback tambien lo deshaga.
const assignPhaseCode = async (db, tipo, id) => {
  const target = PHASE_CODE_COLUMNS[tipo];
  const code = formatPhaseCode(tipo, id);

  if (!target || !code) {
    throw new Error(`No se puede asignar codigo de trazabilidad a ${tipo} #${id}`);
  }

  await db.query(`UPDATE ${target.table} SET ${PHASE_CODE_COLUMN} = ? WHERE ${target.idColumn} = ?`, [code, id]);
  return code;
};

// Busca el ID del registro que tiene guardado ese codigo (ya normalizado con formatPhaseCode).
const findIdByPhaseCode = async (db, tipo, code) => {
  const target = PHASE_CODE_COLUMNS[tipo];

  if (!target) {
    return null;
  }

  const [rows] = await db.query(`SELECT ${target.idColumn} AS id FROM ${target.table} WHERE ${PHASE_CODE_COLUMN} = ?`, [code]);
  return rows[0]?.id ?? null;
};

module.exports = {
  PHASE_CODE_PREFIXES,
  PHASE_CODE_COLUMN,
  PHASE_CODE_COLUMNS,
  formatPhaseCode,
  parsePhaseCode,
  assignPhaseCode,
  findIdByPhaseCode,
};
