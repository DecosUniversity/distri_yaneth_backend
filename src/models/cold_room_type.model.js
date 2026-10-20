const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('coldRoomTypes.findAll', {});
};

const findById = async (id) => {
  return enqueueDbJob('coldRoomTypes.findById', { id });
};

const create = async (payload) => {
  return enqueueDbJob('coldRoomTypes.create', payload);
};

const update = async (id, payload) => {
  return enqueueDbJob('coldRoomTypes.update', { id, ...payload });
};

const remove = async (id, id_usuario_modificacion) => {
  return enqueueDbJob('coldRoomTypes.remove', { id, id_usuario_modificacion });
};

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove,
};
