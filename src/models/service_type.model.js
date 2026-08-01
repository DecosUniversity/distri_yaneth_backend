const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('serviceTypes.findAll', {});
};

const findById = async (id) => {
  return enqueueDbJob('serviceTypes.findById', { id });
};

const create = async ({ nombre_servicio, descripcion, km_frecuencia }) => {
  return enqueueDbJob('serviceTypes.create', {
    nombre_servicio,
    descripcion,
    km_frecuencia,
  });
};

const update = async (id, { nombre_servicio, descripcion, km_frecuencia }) => {
  return enqueueDbJob('serviceTypes.update', {
    id,
    nombre_servicio,
    descripcion,
    km_frecuencia,
  });
};

const remove = async (id) => {
  return enqueueDbJob('serviceTypes.remove', { id });
};

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove,
};
