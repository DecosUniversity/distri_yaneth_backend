const greenNetModel = require('../models/green_net.model');
const productModel = require('../models/product.model');

const parseId = (value) => Number.parseInt(value, 10);
const FINISHED_PRODUCT_TYPE = 'Producto Terminado';
const BUSINESS_RULE_MESSAGES = [
  'El sub-lote debe estar Verde y activo para empacar como red',
  'El peso de la red supera el peso disponible del sub-lote',
  'Debes registrar al menos una caja',
];

const emptyToNull = (value) => (value === undefined || value === null || value === '' ? null : value);

const handleGreenNetError = (error, res, next) => {
  if (
    BUSINESS_RULE_MESSAGES.includes(error.message) ||
    /^La caja \d+ debe tener/.test(error.message)
  ) {
    return res.status(400).json({ message: error.message });
  }

  return next(error);
};

const getRedes = async (_req, res, next) => {
  try {
    const redes = await greenNetModel.findAll();
    return res.status(200).json(redes);
  } catch (error) {
    return next(error);
  }
};

const getRedesBySublote = async (req, res, next) => {
  try {
    const idSublote = parseId(req.params.id_sublote);

    if (Number.isNaN(idSublote)) {
      return res.status(400).json({ message: 'id_sublote invalido' });
    }

    const redes = await greenNetModel.findBySublot(idSublote);
    return res.status(200).json(redes);
  } catch (error) {
    return next(error);
  }
};

const createRed = async (req, res, next) => {
  try {
    const idSublote = parseId(req.body.id_sublote);
    const idProducto = parseId(req.body.id_producto);
    const cajas = Array.isArray(req.body.cajas) ? req.body.cajas : null;

    if (Number.isNaN(idSublote) || idSublote <= 0) {
      return res.status(400).json({ message: 'id_sublote es obligatorio y debe ser valido' });
    }

    if (Number.isNaN(idProducto) || idProducto <= 0) {
      return res.status(400).json({ message: 'id_producto es obligatorio y debe ser valido' });
    }

    if (!cajas || cajas.length === 0) {
      return res.status(400).json({ message: 'Debes registrar al menos una caja' });
    }

    if (!req.body.fecha_vencimiento) {
      return res.status(400).json({ message: 'fecha_vencimiento es obligatoria' });
    }

    const product = await productModel.findById(idProducto);

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    if (String(product.tipo_producto || '').trim() !== FINISHED_PRODUCT_TYPE) {
      return res.status(400).json({ message: 'El producto debe ser de tipo Producto Terminado' });
    }

    const redes = await greenNetModel.create({
      id_sublote: idSublote,
      id_producto: idProducto,
      cajas: cajas.map((caja) => ({
        cantidad_redes: caja.cantidad_redes,
        peso_kg: caja.peso_kg,
      })),
      fecha_vencimiento: String(req.body.fecha_vencimiento).slice(0, 10),
      costo_unitario: emptyToNull(req.body.costo_unitario) === null ? null : Number(req.body.costo_unitario),
      id_usuario: req.auth?.sub || null,
    });

    if (!redes) {
      return res.status(404).json({ message: 'Sub-lote no encontrado' });
    }

    return res.status(201).json(redes);
  } catch (error) {
    return handleGreenNetError(error, res, next);
  }
};

module.exports = {
  getRedes,
  getRedesBySublote,
  createRed,
};
