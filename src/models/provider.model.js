const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('providers.findAll', {});
};

const findById = async (id) => {
  return enqueueDbJob('providers.findById', { id });
};

const create = async ({ nombre_empresa, nit, contacto_nombre, telefono, estado_registro }) => {
  return enqueueDbJob('providers.create', {
    nombre_empresa,
    nit,
    contacto_nombre,
    telefono,
    estado_registro,
  });
};

const update = async (id, { nombre_empresa, nit, contacto_nombre, telefono, estado_registro }) => {
  return enqueueDbJob('providers.update', {
    id,
    nombre_empresa,
    nit,
    contacto_nombre,
    telefono,
    estado_registro,
  });
};

const remove = async (id) => {
  return enqueueDbJob('providers.remove', { id });
};

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove,
};
