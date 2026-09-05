const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('productionProcesses.findAll', {});
};

const reportMermasPorCategoria = async () => {
  return enqueueDbJob('productionProcesses.reportMermasPorCategoria', {});
};

const reportProduccionPorProducto = async () => {
  return enqueueDbJob('productionProcesses.reportProduccionPorProducto', {});
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

const updateStage = async (id, id_etapa, payload) => {
  return enqueueDbJob('productionProcesses.updateStage', {
    id,
    id_etapa,
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

const remove = async (id, id_usuario_modificacion) => {
  return enqueueDbJob('productionProcesses.remove', { id, id_usuario_modificacion });
};

const revert = async (id, peso_a_revertir, justificacion_reversion, id_usuario_modificacion) => {
  return enqueueDbJob('productionProcesses.revert', {
    id,
    peso_a_revertir,
    justificacion_reversion,
    id_usuario_modificacion,
  });
};

module.exports = {
  findAll,
  findById,
  create,
  addStage,
  updateStage,
  addMerma,
  addInsumo,
  addColdRoomEntry,
  finalize,
  remove,
  revert,
  reportMermasPorCategoria,
  reportProduccionPorProducto,
};
