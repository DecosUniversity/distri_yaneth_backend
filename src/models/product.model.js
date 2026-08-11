const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('products.findAll', {});
};

const findById = async (id) => {
  return enqueueDbJob('products.findById', { id });
};

const create = async ({
  nombre,
  descripcion,
  unidad_medida,
  tipo_producto,
  stock_minimo,
  precio_venta_sugerido,
  estado_registro,
  id_usuario_modificacion,
}) => {
  return enqueueDbJob('products.create', {
    nombre,
    descripcion,
    unidad_medida,
    tipo_producto,
    stock_minimo,
    precio_venta_sugerido,
    estado_registro,
    id_usuario_modificacion,
  });
};

const update = async (
  id,
  {
    nombre,
    descripcion,
    unidad_medida,
    tipo_producto,
    stock_minimo,
    precio_venta_sugerido,
    estado_registro,
    id_usuario_modificacion,
  }
) => {
  return enqueueDbJob('products.update', {
    id,
    nombre,
    descripcion,
    unidad_medida,
    tipo_producto,
    stock_minimo,
    precio_venta_sugerido,
    estado_registro,
    id_usuario_modificacion,
  });
};

const remove = async (id, id_usuario_modificacion) => {
  return enqueueDbJob('products.remove', { id, id_usuario_modificacion });
};

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove,
};
