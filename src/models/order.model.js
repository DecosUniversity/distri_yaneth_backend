const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('orders.findAll', {});
};

const findById = async (id) => {
  return enqueueDbJob('orders.findById', { id });
};

const findPendingReturnLines = async () => {
  return enqueueDbJob('orders.findPendingReturnLines', {});
};

const create = async (payload) => {
  return enqueueDbJob('orders.create', payload);
};

const cancel = async (id, id_usuario_modificacion) => {
  return enqueueDbJob('orders.cancel', { id, id_usuario_modificacion });
};

const updateFechaEntregaProgramada = async (id, fecha_entrega_programada, id_usuario_modificacion) => {
  return enqueueDbJob('orders.updateFechaEntregaProgramada', { id, fecha_entrega_programada, id_usuario_modificacion });
};

const reportProductosMasVendidos = async ({ desde, hasta, id_cliente }) => {
  return enqueueDbJob('orders.reportProductosMasVendidos', { desde, hasta, id_cliente });
};

const reportMejoresClientes = async ({ desde, hasta }) => {
  return enqueueDbJob('orders.reportMejoresClientes', { desde, hasta });
};

const reportPedidosDelDia = async ({ fecha } = {}) => {
  return enqueueDbJob('orders.reportPedidosDelDia', { fecha });
};

const reportComprasPorCliente = async ({ desde, hasta }) => {
  return enqueueDbJob('orders.reportComprasPorCliente', { desde, hasta });
};

const reportComprasPorProducto = async ({ desde, hasta, id_cliente }) => {
  return enqueueDbJob('orders.reportComprasPorProducto', { desde, hasta, id_cliente });
};

module.exports = {
  findAll,
  findById,
  findPendingReturnLines,
  create,
  cancel,
  updateFechaEntregaProgramada,
  reportProductosMasVendidos,
  reportMejoresClientes,
  reportPedidosDelDia,
  reportComprasPorCliente,
  reportComprasPorProducto,
};
