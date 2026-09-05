const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('productionOrders.findAll', {});
};

const findById = async (id) => {
  return enqueueDbJob('productionOrders.findById', { id });
};

const create = async (payload) => {
  return enqueueDbJob('productionOrders.create', payload);
};

const cancel = async (id, id_usuario_modificacion) => {
  return enqueueDbJob('productionOrders.cancel', { id, id_usuario_modificacion });
};

module.exports = {
  findAll,
  findById,
  create,
  cancel,
};
