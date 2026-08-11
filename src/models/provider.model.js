const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('providers.findAll', {});
};

const findById = async (id) => {
  return enqueueDbJob('providers.findById', { id });
};

const create = async ({ nombre_empresa, nit, contacto_nombre, telefono, estado_registro, id_usuario_modificacion }) => {
  return enqueueDbJob('providers.create', {
    nombre_empresa,
    nit,
    contacto_nombre,
    telefono,
    estado_registro,
    id_usuario_modificacion,
  });
};

const update = async (id, { nombre_empresa, nit, contacto_nombre, telefono, estado_registro, id_usuario_modificacion }) => {
  return enqueueDbJob('providers.update', {
    id,
    nombre_empresa,
    nit,
    contacto_nombre,
    telefono,
    estado_registro,
    id_usuario_modificacion,
  });
};

const remove = async (id, id_usuario_modificacion) => {
  return enqueueDbJob('providers.remove', { id, id_usuario_modificacion });
};

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove,
};
