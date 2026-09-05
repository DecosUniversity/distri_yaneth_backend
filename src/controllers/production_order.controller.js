const productionOrderModel = require('../models/production_order.model');
const productModel = require('../models/product.model');

const FINISHED_PRODUCT_TYPE = 'Producto Terminado';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseId = (value) => Number.parseInt(value, 10);

const BUSINESS_RULE_MESSAGES = [
  'La orden de produccion seleccionada no existe',
  'La orden de produccion ya no esta disponible (Completada o Cancelada)',
  'El producto del proceso no coincide con el producto de la orden de produccion',
];

const handleProductionOrderError = (error, res, next) => {
  if (BUSINESS_RULE_MESSAGES.includes(error.message)) {
    return res.status(400).json({ message: error.message });
  }

  return next(error);
};

const validateCreatePayload = async (payload) => {
  const productId = Number.parseInt(payload.id_producto, 10);
  const quantity = Number(payload.cantidad_solicitada_kg);

  if (Number.isNaN(productId) || productId <= 0) {
    return 'id_producto es obligatorio y debe ser valido';
  }

  if (Number.isNaN(quantity) || quantity <= 0) {
    return 'cantidad_solicitada_kg debe ser mayor a 0';
  }

  if (payload.fecha_solicitada && !DATE_PATTERN.test(payload.fecha_solicitada)) {
    return 'fecha_solicitada debe tener formato YYYY-MM-DD';
  }

  const product = await productModel.findById(productId);

  if (!product) {
    return 'El producto no existe';
  }

  if (String(product.tipo_producto || '').trim() !== FINISHED_PRODUCT_TYPE) {
    return 'El producto debe ser de tipo Producto Terminado';
  }

  return null;
};

const getProductionOrders = async (_req, res, next) => {
  try {
    const orders = await productionOrderModel.findAll();
    return res.status(200).json(orders);
  } catch (error) {
    return next(error);
  }
};

const getProductionOrderById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const order = await productionOrderModel.findById(id);

    if (!order) {
      return res.status(404).json({ message: 'Orden de produccion no encontrada' });
    }

    return res.status(200).json(order);
  } catch (error) {
    return next(error);
  }
};

const createProductionOrder = async (req, res, next) => {
  try {
    const validationError = await validateCreatePayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const idUsuarioCreacion = req.auth?.sub;

    if (!idUsuarioCreacion) {
      return res.status(401).json({ message: 'No se pudo identificar el usuario' });
    }

    const newOrder = await productionOrderModel.create({
      id_producto: Number.parseInt(req.body.id_producto, 10),
      cantidad_solicitada_kg: Number(req.body.cantidad_solicitada_kg),
      fecha_solicitada: req.body.fecha_solicitada || null,
      observaciones: req.body.observaciones,
      id_usuario_creacion: idUsuarioCreacion,
    });

    return res.status(201).json(newOrder);
  } catch (error) {
    return handleProductionOrderError(error, res, next);
  }
};

const cancelProductionOrder = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const cancelled = await productionOrderModel.cancel(id, req.auth?.sub ?? null);

    if (!cancelled) {
      return res.status(404).json({ message: 'Orden no encontrada o ya no esta Pendiente' });
    }

    return res.status(200).json(cancelled);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getProductionOrders,
  getProductionOrderById,
  createProductionOrder,
  cancelProductionOrder,
};
