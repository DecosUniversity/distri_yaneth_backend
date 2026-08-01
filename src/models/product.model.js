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
}) => {
  return enqueueDbJob('products.create', {
    nombre,
    descripcion,
    unidad_medida,
    tipo_producto,
    stock_minimo,
    precio_venta_sugerido,
    estado_registro,
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
  });
};

const remove = async (id) => {
  return enqueueDbJob('products.remove', { id });
};

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove,
};
