const orderModel = require('../models/order.model');
const clientModel = require('../models/client.model');
const productModel = require('../models/product.model');

const FINISHED_PRODUCT_TYPE = 'Producto Terminado';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const BUSINESS_RULE_MESSAGES = [
  'No hay suficiente inventario disponible para el producto solicitado',
  'La existencia seleccionada no existe o no tiene stock suficiente',
  'La existencia seleccionada no tiene stock suficiente',
  'El pedido ya no esta en curso; no se puede cambiar su fecha de entrega',
];

const parseId = (value) => Number.parseInt(value, 10);

const handleOrderError = (error, res, next) => {
  if (BUSINESS_RULE_MESSAGES.includes(error.message)) {
    return res.status(400).json({ message: error.message });
  }

  return next(error);
};

const parseReportFilters = (query) => {
  const { desde, hasta, id_cliente } = query;

  if (desde && !DATE_PATTERN.test(desde)) {
    return { error: 'desde debe tener formato YYYY-MM-DD' };
  }

  if (hasta && !DATE_PATTERN.test(hasta)) {
    return { error: 'hasta debe tener formato YYYY-MM-DD' };
  }

  let parsedClientId = null;

  if (id_cliente) {
    parsedClientId = Number.parseInt(id_cliente, 10);

    if (Number.isNaN(parsedClientId) || parsedClientId <= 0) {
      return { error: 'id_cliente debe ser valido' };
    }
  }

  return { filters: { desde: desde || null, hasta: hasta || null, id_cliente: parsedClientId } };
};

const validateOrderPayload = async (payload) => {
  const parsedClientId = Number.parseInt(payload.id_cliente, 10);

  if (Number.isNaN(parsedClientId) || parsedClientId <= 0) {
    return 'id_cliente es obligatorio y debe ser valido';
  }

  const client = await clientModel.findById(parsedClientId);

  if (!client) {
    return 'El cliente no existe';
  }

  if (
    payload.fecha_entrega_programada !== undefined &&
    payload.fecha_entrega_programada !== null &&
    payload.fecha_entrega_programada !== '' &&
    !DATE_PATTERN.test(payload.fecha_entrega_programada)
  ) {
    return 'fecha_entrega_programada debe tener formato YYYY-MM-DD';
  }

  if (!Array.isArray(payload.lineas) || payload.lineas.length === 0) {
    return 'Debes agregar al menos una linea de producto';
  }

  for (const linea of payload.lineas) {
    const parsedProductId = Number.parseInt(linea.id_producto, 10);
    const parsedCantidad = Number(linea.cantidad);

    if (Number.isNaN(parsedProductId) || parsedProductId <= 0) {
      return 'Cada linea debe tener un id_producto valido';
    }

    if (Number.isNaN(parsedCantidad) || parsedCantidad <= 0) {
      return 'Cada linea debe tener una cantidad mayor a 0';
    }

    if (linea.id_existencia !== undefined && linea.id_existencia !== null && linea.id_existencia !== '') {
      const parsedExistenciaId = Number.parseInt(linea.id_existencia, 10);

      if (Number.isNaN(parsedExistenciaId) || parsedExistenciaId <= 0) {
        return 'id_existencia debe ser valido si se especifica';
      }
    }

    const product = await productModel.findById(parsedProductId);

    if (!product) {
      return `El producto #${parsedProductId} no existe`;
    }

    if (String(product.tipo_producto || '').trim() !== FINISHED_PRODUCT_TYPE) {
      return `El producto ${product.nombre} debe ser de tipo Producto Terminado`;
    }
  }

  return null;
};

const getReporteProductosMasVendidos = async (req, res, next) => {
  try {
    const { error, filters } = parseReportFilters(req.query);

    if (error) {
      return res.status(400).json({ message: error });
    }

    const report = await orderModel.reportProductosMasVendidos(filters);
    return res.status(200).json(report);
  } catch (error) {
    return next(error);
  }
};

const getReporteMejoresClientes = async (req, res, next) => {
  try {
    const { error, filters } = parseReportFilters(req.query);

    if (error) {
      return res.status(400).json({ message: error });
    }

    const report = await orderModel.reportMejoresClientes(filters);
    return res.status(200).json(report);
  } catch (error) {
    return next(error);
  }
};

const getReportePedidosDelDia = async (req, res, next) => {
  try {
    const { fecha } = req.query;

    if (fecha && !DATE_PATTERN.test(fecha)) {
      return res.status(400).json({ message: 'fecha debe tener formato YYYY-MM-DD' });
    }

    const report = await orderModel.reportPedidosDelDia({ fecha: fecha || null });
    return res.status(200).json(report);
  } catch (error) {
    return next(error);
  }
};

const getPedidos = async (_req, res, next) => {
  try {
    const orders = await orderModel.findAll();
    return res.status(200).json(orders);
  } catch (error) {
    return next(error);
  }
};

const getPedidoById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const order = await orderModel.findById(id);

    if (!order) {
      return res.status(404).json({ message: 'Pedido no encontrado' });
    }

    return res.status(200).json(order);
  } catch (error) {
    return next(error);
  }
};

const createPedido = async (req, res, next) => {
  try {
    const validationError = await validateOrderPayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const idUsuarioCreacion = req.auth?.sub;

    if (!idUsuarioCreacion) {
      return res.status(401).json({ message: 'No se pudo identificar el usuario' });
    }

    const newOrder = await orderModel.create({
      id_cliente: Number.parseInt(req.body.id_cliente, 10),
      observaciones: req.body.observaciones,
      fecha_entrega_programada: req.body.fecha_entrega_programada || null,
      id_usuario_creacion: idUsuarioCreacion,
      lineas: req.body.lineas.map((linea) => ({
        id_producto: Number.parseInt(linea.id_producto, 10),
        cantidad: Number(linea.cantidad),
        id_existencia:
          linea.id_existencia !== undefined && linea.id_existencia !== null && linea.id_existencia !== ''
            ? Number.parseInt(linea.id_existencia, 10)
            : null,
      })),
    });

    return res.status(201).json(newOrder);
  } catch (error) {
    return handleOrderError(error, res, next);
  }
};

const cancelPedido = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const cancelled = await orderModel.cancel(id, req.auth?.sub ?? null);

    if (!cancelled) {
      return res.status(404).json({ message: 'Pedido no encontrado o ya no esta Pendiente' });
    }

    return res.status(200).json(cancelled);
  } catch (error) {
    return next(error);
  }
};

const updateFechaEntregaProgramada = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const { fecha_entrega_programada } = req.body;

    if (fecha_entrega_programada && !DATE_PATTERN.test(fecha_entrega_programada)) {
      return res.status(400).json({ message: 'fecha_entrega_programada debe tener formato YYYY-MM-DD' });
    }

    const updated = await orderModel.updateFechaEntregaProgramada(
      id,
      fecha_entrega_programada || null,
      req.auth?.sub ?? null
    );

    if (!updated) {
      return res.status(404).json({ message: 'Pedido no encontrado' });
    }

    return res.status(200).json(updated);
  } catch (error) {
    return handleOrderError(error, res, next);
  }
};

module.exports = {
  getPedidos,
  getPedidoById,
  createPedido,
  cancelPedido,
  updateFechaEntregaProgramada,
  getReporteProductosMasVendidos,
  getReporteMejoresClientes,
  getReportePedidosDelDia,
};
