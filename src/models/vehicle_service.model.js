const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('vehicleServices.findAll', {});
};

const findById = async (id) => {
  return enqueueDbJob('vehicleServices.findById', { id });
};

const create = async ({
  id_vehiculo,
  id_tipo_servicio,
  fecha_servicio,
  km_en_servicio,
  costo_servicio,
  proximo_servicio_km,
  notas,
  id_usuario_modificacion,
}) => {
  return enqueueDbJob('vehicleServices.create', {
    id_vehiculo,
    id_tipo_servicio,
    fecha_servicio,
    km_en_servicio,
    costo_servicio,
    proximo_servicio_km,
    notas,
    id_usuario_modificacion,
  });
};

const update = async (
  id,
  {
    id_vehiculo,
    id_tipo_servicio,
    fecha_servicio,
    km_en_servicio,
    costo_servicio,
    proximo_servicio_km,
    notas,
    id_usuario_modificacion,
  }
) => {
  return enqueueDbJob('vehicleServices.update', {
    id,
    id_vehiculo,
    id_tipo_servicio,
    fecha_servicio,
    km_en_servicio,
    costo_servicio,
    proximo_servicio_km,
    notas,
    id_usuario_modificacion,
  });
};

const remove = async (id) => {
  return enqueueDbJob('vehicleServices.remove', { id });
};

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove,
};