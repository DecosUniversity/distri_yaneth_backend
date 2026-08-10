const mermaTypeModel = require('../models/merma_type.model');

const getMermaTypes = async (_req, res, next) => {
  try {
    const mermaTypes = await mermaTypeModel.findAll();
    return res.status(200).json(mermaTypes);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getMermaTypes,
};
