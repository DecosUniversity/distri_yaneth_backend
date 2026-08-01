const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('maturationControls.findAll', {});
};

const findByLot = async (id_lote_mp) => {
  return enqueueDbJob('maturationControls.findByLot', { id_lote_mp });
};

const create = async (payload) => {
  return enqueueDbJob('maturationControls.create', payload);
};

const remove = async (id) => {
  return enqueueDbJob('maturationControls.remove', { id });
};

module.exports = {
  findAll,
  findByLot,
  create,
  remove,
};
