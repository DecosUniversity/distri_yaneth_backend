const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('routes.findAll', {});
};

const findById = async (id) => {
  return enqueueDbJob('routes.findById', { id });
};

const pilotosDisponibles = async () => {
  return enqueueDbJob('routes.pilotosDisponibles', {});
};

const create = async (payload) => {
  return enqueueDbJob('routes.create', payload);
};

const registrarSalida = async (id, payload) => {
  return enqueueDbJob('routes.registrarSalida', { id, ...payload });
};

const confirmarEntregas = async (id, payload) => {
  return enqueueDbJob('routes.confirmarEntregas', { id, ...payload });
};

const cerrar = async (id, payload) => {
  return enqueueDbJob('routes.cerrar', { id, ...payload });
};

module.exports = {
  findAll,
  findById,
  pilotosDisponibles,
  create,
  registrarSalida,
  confirmarEntregas,
  cerrar,
};
