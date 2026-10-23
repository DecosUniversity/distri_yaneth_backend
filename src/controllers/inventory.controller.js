const inventoryModel = require('../models/inventory.model');

const getInventory = async (_req, res, next) => {
  try {
    const inventory = await inventoryModel.findAll();
    return res.status(200).json(inventory);
  } catch (error) {
    return next(error);
  }
};

const getExistenciasByProduct = async (req, res, next) => {
  try {
    const idProducto = Number.parseInt(req.query.id_producto, 10);

    if (Number.isNaN(idProducto) || idProducto <= 0) {
      return res.status(400).json({ message: 'id_producto es obligatorio y debe ser valido' });
    }

    const existencias = await inventoryModel.findByProduct(idProducto);
    return res.status(200).json(existencias);
  } catch (error) {
    return next(error);
  }
};

const MAX_LOSS_MONTHS = 24;

const BUSINESS_RULE_MESSAGES = [
  'Solo se puede dar de baja una existencia vencida',
  'La existencia no tiene stock para dar de baja',
];

const getExpirationReport = async (req, res, next) => {
  try {
    const months = req.query.meses === undefined ? undefined : Number.parseInt(req.query.meses, 10);

    if (months !== undefined && (Number.isNaN(months) || months < 1 || months > MAX_LOSS_MONTHS)) {
      return res.status(400).json({ message: `meses debe ser un numero entre 1 y ${MAX_LOSS_MONTHS}` });
    }

    const report = await inventoryModel.getExpirationReport(months);
    return res.status(200).json(report);
  } catch (error) {
    return next(error);
  }
};

const writeOffExpired = async (req, res, next) => {
  try {
    const idExistencia = Number.parseInt(req.params.id, 10);

    if (Number.isNaN(idExistencia) || idExistencia <= 0) {
      return res.status(400).json({ message: 'id de existencia invalido' });
    }

    const idUsuario = req.auth?.sub;

    if (!idUsuario) {
      return res.status(401).json({ message: 'No se pudo identificar el usuario' });
    }

    const result = await inventoryModel.writeOffExpired(idExistencia, idUsuario);

    if (!result) {
      return res.status(404).json({ message: 'Existencia no encontrada' });
    }

    return res.status(200).json(result);
  } catch (error) {
    if (BUSINESS_RULE_MESSAGES.includes(error.message)) {
      return res.status(400).json({ message: error.message });
    }

    return next(error);
  }
};

module.exports = {
  getInventory,
  getExistenciasByProduct,
  getExpirationReport,
  writeOffExpired,
};