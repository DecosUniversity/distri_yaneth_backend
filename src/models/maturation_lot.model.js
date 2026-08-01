const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('maturationLots.findAll', {});
};

const findById = async (id) => {
  return enqueueDbJob('maturationLots.findById', { id });
};

const create = async (payload) => {
  return enqueueDbJob('maturationLots.create', payload);
};

const update = async (id, payload) => {
  return enqueueDbJob('maturationLots.update', {
    id,
    ...payload,
  });
};

const remove = async (id) => {
  return enqueueDbJob('maturationLots.remove', { id });
};

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove,
};
