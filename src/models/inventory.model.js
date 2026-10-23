const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('inventory.findAll', {});
};

const findByProduct = async (id_producto) => {
  return enqueueDbJob('inventory.findByProduct', { id_producto });
};

const getExpirationReport = async (months) => {
  return enqueueDbJob('inventory.expirationReport', { months });
};

const writeOffExpired = async (id_existencia, id_usuario) => {
  return enqueueDbJob('inventory.writeOffExpired', { id_existencia, id_usuario });
};

module.exports = {
  findAll,
  findByProduct,
  getExpirationReport,
  writeOffExpired,
};
