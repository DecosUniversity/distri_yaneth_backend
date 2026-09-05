const orderReturnModel = require('../models/order_return.model');
const orderModel = require('../models/order.model');

const RESOLUTION_STATES = ['Reingresado a inventario', 'Perdida'];
const BUSINESS_RULE_MESSAGES = [
  'La linea de pedido no esta disponible para recibir devolucion',
  'La devolucion ya fue resuelta',
  'No se encontro el producto de la linea devuelta',
  'resolucion invalida',
];

const parseId = (value) => Number.parseInt(value, 10);

const handleReturnError = (error, res, next) => {
  if (BUSINESS_RULE_MESSAGES.includes(error.message)) {
    return res.status(400).json({ message: error.message });
  }

  return next(error);
};

const getDevoluciones = async (_req, res, next) => {
  try {
    const returns = await orderReturnModel.findAll();
    return res.status(200).json(returns);
  } catch (error) {
    return next(error);
  }
};

const getDevolucionesPendientesRevision = async (_req, res, next) => {
  try {
    const returns = await orderReturnModel.findPendingReview();
    return res.status(200).json(returns);
  } catch (error) {
    return next(error);
  }
};

const getLineasPendientesRecepcion = async (_req, res, next) => {
  try {
    const lines = await orderModel.findPendingReturnLines();
    return res.status(200).json(lines);
  } catch (error) {
    return next(error);
  }
};

const createDevolucion = async (req, res, next) => {
  try {
    const idDetalle = parseId(req.body.id_detalle);

    if (Number.isNaN(idDetalle) || idDetalle <= 0) {
      return res.status(400).json({ message: 'id_detalle es obligatorio y debe ser valido' });
    }

    const cantidadDevuelta = req.body.cantidad_devuelta;

    if (
      cantidadDevuelta !== undefined &&
      cantidadDevuelta !== null &&
      cantidadDevuelta !== '' &&
      (Number.isNaN(Number(cantidadDevuelta)) || Number(cantidadDevuelta) <= 0)
    ) {
      return res.status(400).json({ message: 'cantidad_devuelta debe ser numerica y mayor a 0' });
    }

    const idUsuarioRecepcion = req.auth?.sub;

    if (!idUsuarioRecepcion) {
      return res.status(401).json({ message: 'No se pudo identificar el usuario' });
    }

    const devolucion = await orderReturnModel.create({
      id_detalle: idDetalle,
      cantidad_devuelta: cantidadDevuelta,
      motivo: req.body.motivo,
      id_usuario_recepcion: idUsuarioRecepcion,
    });

    return res.status(201).json(devolucion);
  } catch (error) {
    return handleReturnError(error, res, next);
  }
};

const resolverDevolucion = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const resolucion = String(req.body.resolucion || '').trim();

    if (!RESOLUTION_STATES.includes(resolucion)) {
      return res.status(400).json({
        message: `resolucion invalida. Valores permitidos: ${RESOLUTION_STATES.join(', ')}`,
      });
    }

    const idUsuarioResolucion = req.auth?.sub;

    if (!idUsuarioResolucion) {
      return res.status(401).json({ message: 'No se pudo identificar el usuario' });
    }

    const resolved = await orderReturnModel.resolve(id, {
      resolucion,
      id_usuario_resolucion: idUsuarioResolucion,
    });

    return res.status(200).json(resolved);
  } catch (error) {
    return handleReturnError(error, res, next);
  }
};

module.exports = {
  getDevoluciones,
  getDevolucionesPendientesRevision,
  getLineasPendientesRecepcion,
  createDevolucion,
  resolverDevolucion,
};
