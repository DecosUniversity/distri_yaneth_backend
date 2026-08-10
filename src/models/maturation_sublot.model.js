const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('maturationSublots.findAll', {});
};

const findById = async (id) => {
  return enqueueDbJob('maturationSublots.findById', { id });
};

const findByLot = async (id_lote_mp) => {
  return enqueueDbJob('maturationSublots.findByLot', { id_lote_mp });
};

const findReadyForProduction = async () => {
  return enqueueDbJob('maturationSublots.findReadyForProduction', {});
};

const split = async (id, payload) => {
  return enqueueDbJob('maturationSublots.split', { id, ...payload });
};

const close = async (id, payload) => {
  return enqueueDbJob('maturationSublots.close', { id, ...payload });
};

module.exports = {
  findAll,
  findById,
  findByLot,
  findReadyForProduction,
  split,
  close,
};
