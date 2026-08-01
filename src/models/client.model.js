const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('clients.findAll', {});
};

const findById = async (id) => {
  return enqueueDbJob('clients.findById', { id });
};

const create = async ({ nombre_comercial, direccion_entrega, telefono, nit_facturacion, estado_registro }) => {
  return enqueueDbJob('clients.create', {
    nombre_comercial,
    direccion_entrega,
    telefono,
    nit_facturacion,
    estado_registro,
  });
};

const update = async (id, { nombre_comercial, direccion_entrega, telefono, nit_facturacion, estado_registro }) => {
  return enqueueDbJob('clients.update', {
    id,
    nombre_comercial,
    direccion_entrega,
    telefono,
    nit_facturacion,
    estado_registro,
  });
};

const remove = async (id) => {
  return enqueueDbJob('clients.remove', { id });
};

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove,
};
