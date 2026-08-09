const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('productionProcesses.findAll', {});
};

const findById = async (id) => {
  return enqueueDbJob('productionProcesses.findById', { id });
};

const create = async (payload) => {
  return enqueueDbJob('productionProcesses.create', payload);
};

const addStage = async (id, payload) => {
  return enqueueDbJob('productionProcesses.addStage', {
    id,
    ...payload,
  });
};

const addMerma = async (id, payload) => {
  return enqueueDbJob('productionProcesses.addMerma', {
    id,
    ...payload,
  });
};

const addInsumo = async (id, payload) => {
  return enqueueDbJob('productionProcesses.addInsumo', {
    id,
    ...payload,
  });
};

const addColdRoomEntry = async (id, payload) => {
  return enqueueDbJob('productionProcesses.addColdRoomEntry', {
    id,
    ...payload,
  });
};

const finalize = async (id, payload) => {
  return enqueueDbJob('productionProcesses.finalize', {
    id,
    ...payload,
  });
};

const remove = async (id) => {
  return enqueueDbJob('productionProcesses.remove', { id });
};

module.exports = {
  findAll,
  findById,
  create,
  addStage,
  addMerma,
  addInsumo,
  addColdRoomEntry,
  finalize,
  remove,
};
