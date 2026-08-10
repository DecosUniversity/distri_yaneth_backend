const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('maturationControls.findAll', {});
};

const findBySublot = async (id_sublote) => {
  return enqueueDbJob('maturationControls.findBySublot', { id_sublote });
};

const create = async (payload) => {
  return enqueueDbJob('maturationControls.create', payload);
};

const remove = async (id) => {
  return enqueueDbJob('maturationControls.remove', { id });
};

module.exports = {
  findAll,
  findBySublot,
  create,
  remove,
};
