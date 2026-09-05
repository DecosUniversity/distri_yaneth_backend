const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('stageTypes.findAll', {});
};

const findById = async (id) => {
  return enqueueDbJob('stageTypes.findById', { id });
};

const create = async (payload) => {
  return enqueueDbJob('stageTypes.create', payload);
};

const update = async (id, payload) => {
  return enqueueDbJob('stageTypes.update', { id, ...payload });
};

const remove = async (id, id_usuario_modificacion) => {
  return enqueueDbJob('stageTypes.remove', { id, id_usuario_modificacion });
};

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove,
};
