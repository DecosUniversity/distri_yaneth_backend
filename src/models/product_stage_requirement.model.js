const { enqueueDbJob } = require('../queues/db.queue');

const findByProduct = async (id_producto) => {
  return enqueueDbJob('productStageRequirements.findByProduct', { id_producto });
};

const replaceForProduct = async (id_producto, etapas, id_usuario_modificacion) => {
  return enqueueDbJob('productStageRequirements.replaceForProduct', {
    id_producto,
    etapas,
    id_usuario_modificacion,
  });
};

module.exports = {
  findByProduct,
  replaceForProduct,
};
