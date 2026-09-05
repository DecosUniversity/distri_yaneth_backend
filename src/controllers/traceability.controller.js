const traceabilityModel = require('../models/traceability.model');

const VALID_TYPES = ['entrada', 'lote', 'sublote', 'proceso', 'red', 'existencia', 'movimiento'];
const VALID_AREAS = ['maduracion', 'produccion', 'redes', 'inventario', 'pedidos'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const BUSINESS_RULE_MESSAGES = [
  'No existe ninguna entrada con ese codigo de trazabilidad',
  'Se requiere un codigo o un tipo+id para trazar',
  'No se pudo determinar el origen (entrada de mercancia) para este registro',
  'No se encontro la entrada de mercancia de origen',
];

const handleTraceabilityError = (error, res, next) => {
  if (BUSINESS_RULE_MESSAGES.includes(error.message) || error.message.startsWith('area invalida')) {
    return res.status(400).json({ message: error.message });
  }

  return next(error);
};

const getTrace = async (req, res, next) => {
  try {
    const { codigo, tipo, id } = req.query;

    if (!codigo && !(tipo && id)) {
      return res.status(400).json({ message: 'Debes indicar codigo o tipo+id para trazar' });
    }

    if (tipo && !VALID_TYPES.includes(tipo)) {
      return res.status(400).json({ message: `tipo invalido, debe ser uno de: ${VALID_TYPES.join(', ')}` });
    }

    const result = await traceabilityModel.trace({ codigo, tipo, id });
    return res.status(200).json(result);
  } catch (error) {
    return handleTraceabilityError(error, res, next);
  }
};

const getSearch = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || String(q).trim().length < 1) {
      return res.status(400).json({ message: 'Debes indicar un termino de busqueda (q)' });
    }

    const results = await traceabilityModel.search(String(q).trim());
    return res.status(200).json(results);
  } catch (error) {
    return next(error);
  }
};

const getFilteredSearch = async (req, res, next) => {
  try {
    const { areas, desde, hasta } = req.query;

    const areaList = areas
      ? String(areas).split(',').map((area) => area.trim()).filter(Boolean)
      : [];

    const invalidArea = areaList.find((area) => !VALID_AREAS.includes(area));

    if (invalidArea) {
      return res.status(400).json({ message: `area invalida: ${invalidArea}, debe ser una de: ${VALID_AREAS.join(', ')}` });
    }

    if (desde && !DATE_PATTERN.test(desde)) {
      return res.status(400).json({ message: 'desde debe tener formato YYYY-MM-DD' });
    }

    if (hasta && !DATE_PATTERN.test(hasta)) {
      return res.status(400).json({ message: 'hasta debe tener formato YYYY-MM-DD' });
    }

    const results = await traceabilityModel.searchByFilters({ areas: areaList, desde, hasta });
    return res.status(200).json(results);
  } catch (error) {
    return handleTraceabilityError(error, res, next);
  }
};

module.exports = {
  getTrace,
  getSearch,
  getFilteredSearch,
};
