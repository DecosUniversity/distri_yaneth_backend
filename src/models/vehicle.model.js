const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('vehicles.findAll', {});
};

const findById = async (id) => {
  return enqueueDbJob('vehicles.findById', { id });
};

const create = async ({ placa, modelo, estado, kilometraje_actual, estado_registro }) => {
  return enqueueDbJob('vehicles.create', {
    placa,
    modelo,
    estado,
    kilometraje_actual,
    estado_registro,
  });
};

const update = async (
  id,
  { placa, modelo, estado, kilometraje_actual, estado_registro, id_usuario_modificador }
) => {
  return enqueueDbJob('vehicles.update', {
    id,
    placa,
    modelo,
    estado,
    kilometraje_actual,
    estado_registro,
    id_usuario_modificador,
  });
};

const remove = async (id) => {
  return enqueueDbJob('vehicles.remove', { id });
};

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove,
};
