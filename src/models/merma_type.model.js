const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('mermaTypes.findAll', {});
};

const findById = async (id) => {
  return enqueueDbJob('mermaTypes.findById', { id });
};

const create = async (payload) => {
  return enqueueDbJob('mermaTypes.create', payload);
};

const update = async (id, payload) => {
  return enqueueDbJob('mermaTypes.update', { id, ...payload });
};

const remove = async (id, id_usuario_modificacion) => {
  return enqueueDbJob('mermaTypes.remove', { id, id_usuario_modificacion });
};

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove,
};
