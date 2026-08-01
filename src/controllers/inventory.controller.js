const inventoryModel = require('../models/inventory.model');

const getInventory = async (_req, res, next) => {
  try {
    const inventory = await inventoryModel.findAll();
    return res.status(200).json(inventory);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getInventory,
};