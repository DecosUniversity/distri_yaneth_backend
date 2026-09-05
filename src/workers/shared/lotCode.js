// Codigo de trazabilidad legible: ABREVIATURA_PRODUCTO-YYMMDD-### (secuencia diaria por producto).
// Reemplaza el viejo esquema P{proveedor}-E{entrada}-L{lote}-PT{producto} basado en IDs internos.

const ACCENT_MAP = {
  A: 'AÁÀÄÂ',
  E: 'EÉÈËÊ',
  I: 'IÍÌÏÎ',
  O: 'OÓÒÖÔ',
  U: 'UÚÙÜÛ',
  N: 'NÑ',
};

const stripAccents = (text) => {
  let result = text;

  Object.entries(ACCENT_MAP).forEach(([plain, variants]) => {
    for (const accented of variants.slice(1)) {
      result = result.split(accented).join(plain);
    }
  });

  return result;
};

const buildProductAbbreviation = (nombre) => {
  const clean = stripAccents(String(nombre || 'PRODUCTO').toUpperCase())
    .replace(/[^A-Z\s]/g, '')
    .trim();

  const words = clean.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return 'PRD';
  }

  if (words.length === 1) {
    return words[0].slice(0, 3).padEnd(3, 'X');
  }

  return (words[0].slice(0, 2) + words[1].slice(0, 1)).padEnd(3, 'X');
};

const buildDateSegment = (fecha) => {
  const date = fecha instanceof Date && !Number.isNaN(fecha.getTime()) ? fecha : new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
};

// Genera el siguiente codigo disponible para (producto, fecha) contando cuantos codigos
// existentes ya usan ese mismo prefijo. connection debe soportar .query(sql, params).
const generateLotCode = async (connection, { table, column, productoNombre, fecha, extraSeq = 0 }) => {
  const prefix = buildProductAbbreviation(productoNombre);
  const dateSegment = buildDateSegment(fecha);
  const likePrefix = `${prefix}-${dateSegment}-`;

  const [rows] = await connection.query(`SELECT COUNT(*) AS total FROM ${table} WHERE ${column} LIKE ?`, [`${likePrefix}%`]);

  const nextSeq = Number(rows[0]?.total || 0) + 1 + extraSeq;
  return `${likePrefix}${String(nextSeq).padStart(3, '0')}`;
};

module.exports = {
  buildProductAbbreviation,
  buildDateSegment,
  generateLotCode,
};
