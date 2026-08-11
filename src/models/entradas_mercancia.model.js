const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('entries.findAll', {});
};

const findById = async (id) => {
  return enqueueDbJob('entries.findById', { id });
};

const findExistencias = async () => {
  return enqueueDbJob('inventory.findAll', {});
};

const findMovimientos = async () => {
  return enqueueDbJob('movements.findAll', {});
};

const create = async ({
  id_proveedor,
  id_producto,
  fecha_vencimiento,
  cantidad_disponible,
  costo_unitario,
  documento_referencia,
  id_usuario_receptor,
  unidades, // array opcional de unidades pequeñas: [{ unidad_codigo, peso, creado_por, fecha_pesos }]
}) => {
  return enqueueDbJob('entries.create', {
    id_proveedor,
    id_producto,
    fecha_vencimiento,
    cantidad_disponible,
    costo_unitario,
    documento_referencia,
    id_usuario_receptor,
    unidades,
  });
};

const findUnitsByEntrada = async (id_entrada) => {
  return enqueueDbJob('entries.findUnitsByEntrada', { id_entrada });
};

const remove = async (id, id_usuario_modificacion) => {
  return enqueueDbJob('entries.remove', { id, id_usuario_modificacion });
};

module.exports = {
  findAll,
  findById,
  findExistencias,
  findMovimientos,
  create,
  remove,
  findUnitsByEntrada,
};