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

module.exports = {
  getInventory,
  getExistenciasByProduct,
};