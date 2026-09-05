const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('clients.findAll', {});
};

const findById = async (id) => {
  return enqueueDbJob('clients.findById', { id });
};

const create = async ({
  nombre_comercial,
  departamento,
  municipio,
  zona,
  direccion_entrega,
  telefono,
  nit_facturacion,
  estado_registro,
  id_usuario_modificacion,
}) => {
  return enqueueDbJob('clients.create', {
    nombre_comercial,
    departamento,
    municipio,
    zona,
    direccion_entrega,
    telefono,
    nit_facturacion,
    estado_registro,
    id_usuario_modificacion,
  });
};

const update = async (
  id,
  { nombre_comercial, departamento, municipio, zona, direccion_entrega, telefono, nit_facturacion, estado_registro, id_usuario_modificacion }
) => {
  return enqueueDbJob('clients.update', {
    id,
    nombre_comercial,
    departamento,
    municipio,
    zona,
    direccion_entrega,
    telefono,
    nit_facturacion,
    estado_registro,
    id_usuario_modificacion,
  });
};

const remove = async (id, id_usuario_modificacion) => {
  return enqueueDbJob('clients.remove', { id, id_usuario_modificacion });
};

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove,
};
