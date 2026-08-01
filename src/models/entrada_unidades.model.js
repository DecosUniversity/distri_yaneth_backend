const { enqueueDbJob } = require('../queues/db.queue');

const create = async ({ id_entrada, unidad_codigo, peso, creado_por, fecha_pesos }) => {
  return enqueueDbJob('entries.createUnit', {
    id_entrada,
    unidad_codigo,
    peso,
    creado_por,
    fecha_pesos,
  });
};

const findByEntrada = async (id_entrada) => {
  return enqueueDbJob('entries.findUnitsByEntrada', { id_entrada });
};

const remove = async (id) => {
  return enqueueDbJob('entries.removeUnit', { id });
};

module.exports = {
  create,
  findByEntrada,
  remove,
};
