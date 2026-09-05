const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('inventory.findAll', {});
};

const findByProduct = async (id_producto) => {
  return enqueueDbJob('inventory.findByProduct', { id_producto });
};

module.exports = {
  findAll,
  findByProduct,
};