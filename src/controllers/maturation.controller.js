const maturationLotModel = require('../models/maturation_lot.model');
const maturationSublotModel = require('../models/maturation_sublot.model');
const maturationControlModel = require('../models/maturation_control.model');
const greenNetModel = require('../models/green_net.model');
const productModel = require('../models/product.model');
const entradasMercanciaModel = require('../models/entradas_mercancia.model');

const parseId = (value) => Number.parseInt(value, 10);
const MATURATION_REGISTRATION_STATES = ['Pendiente', 'Activo', 'Completo', 'Inactivo'];
const RIPENESS_STATES = ['Verde', 'Sarazo', 'Maduro', 'Sobre maduro'];
const FINISHED_PRODUCT_TYPE = 'Producto Terminado';
const BUSINESS_RULE_MESSAGES = [
  'El sub-lote no esta disponible para cerrar maduracion',
  'Se requiere peso_medido_kg para cerrar la maduracion; no hay mediciones previas con peso capturado',
  'El peso medido no puede ser mayor al peso disponible del sub-lote',
  'El peso a fraccionar supera el peso disponible del sub-lote',
  'El sub-lote debe estar Verde y activo para empacar como red',
  'El peso de la red supera el peso disponible del sub-lote',
];

const emptyToNull = (value) => (value === undefined || value === null || value === '' ? null : value);

const handleMaturationError = (error, res, next) => {
  if (BUSINESS_RULE_MESSAGES.includes(error.message)) {
    return res.status(400).json({ message: error.message });
  }

  return next(error);
};

const validateLotPayload = (payload) => {
  const parsedProductId = Number.parseInt(payload.id_producto, 10);
  const parsedProviderId = Number.parseInt(payload.id_proveedor, 10);
  const parsedEntryOriginId =
    payload.id_entrada_origen === undefined || payload.id_entrada_origen === null || payload.id_entrada_origen === ''
      ? null
      : Number.parseInt(payload.id_entrada_origen, 10);
  const parsedCantidad =
    payload.cantidad_unidades === undefined || payload.cantidad_unidades === null || payload.cantidad_unidades === ''
      ? null
      : Number.parseInt(payload.cantidad_unidades, 10);
  const parsedPeso = Number(payload.peso_inicial_kg);

  if (Number.isNaN(parsedProductId) || parsedProductId <= 0) {
    return 'id_producto es obligatorio y debe ser valido';
  }

  if (Number.isNaN(parsedProviderId) || parsedProviderId <= 0) {
    return 'id_proveedor es obligatorio y debe ser valido';
  }

  if (parsedEntryOriginId === null || Number.isNaN(parsedEntryOriginId) || parsedEntryOriginId <= 0) {
    return 'id_entrada_origen es obligatorio y debe ser valido';
  }

  if (!payload.fecha_recepcion) {
    return 'fecha_recepcion es obligatoria';
  }

  if (Number.isNaN(parsedPeso) || parsedPeso <= 0) {
    return 'peso_inicial_kg debe ser mayor a 0';
  }

  if (parsedCantidad !== null && (Number.isNaN(parsedCantidad) || parsedCantidad < 0)) {
    return 'cantidad_unidades debe ser mayor o igual a 0';
  }

  if (
    payload.estado_registro !== undefined &&
    payload.estado_registro !== null &&
    payload.estado_registro !== '' &&
    !MATURATION_REGISTRATION_STATES.includes(String(payload.estado_registro).trim())
  ) {
    return 'estado_registro debe ser Pendiente, Activo, Completo o Inactivo';
  }

  return null;
};

const normalizeLotPayload = (payload) => ({
  id_producto: Number.parseInt(payload.id_producto, 10),
  id_proveedor: Number.parseInt(payload.id_proveedor, 10),
  id_entrada_origen: Number.parseInt(payload.id_entrada_origen, 10),
  fecha_recepcion: payload.fecha_recepcion ? String(payload.fecha_recepcion).slice(0, 10) : payload.fecha_recepcion,
  cantidad_unidades:
    payload.cantidad_unidades === undefined || payload.cantidad_unidades === null || payload.cantidad_unidades === ''
      ? null
      : Number.parseInt(payload.cantidad_unidades, 10),
  peso_inicial_kg: Number(payload.peso_inicial_kg),
  estado_maduracion:
    typeof payload.estado_maduracion === 'string' && payload.estado_maduracion.trim()
      ? payload.estado_maduracion.trim()
      : 'Verde',
  estado_registro:
    typeof payload.estado_registro === 'string' && payload.estado_registro.trim()
      ? payload.estado_registro.trim()
      : 'Pendiente',
});

const validateControlPayload = (payload) => {
  const parsedSublotId = Number.parseInt(payload.id_sublote, 10);
  const parsedBrix = Number(payload.grados_brix);
  const parsedPesoMedido = emptyToNull(payload.peso_medido_kg);
  const parsedMateriaSeca = emptyToNull(payload.porcentaje_materia_seca);
  const parsedTemperatura = emptyToNull(payload.temperatura_cuarto);

  if (Number.isNaN(parsedSublotId) || parsedSublotId <= 0) {
    return 'id_sublote es obligatorio y debe ser valido';
  }

  if (Number.isNaN(parsedBrix) || parsedBrix < 0) {
    return 'grados_brix debe ser numerico y mayor o igual a 0';
  }

  if (parsedPesoMedido !== null && Number.isNaN(Number(parsedPesoMedido))) {
    return 'peso_medido_kg debe ser numerico';
  }

  if (parsedMateriaSeca !== null && Number.isNaN(Number(parsedMateriaSeca))) {
    return 'porcentaje_materia_seca debe ser numerico';
  }

  if (parsedTemperatura !== null && Number.isNaN(Number(parsedTemperatura))) {
    return 'temperatura_cuarto debe ser numerica';
  }

  return null;
};

const normalizeControlPayload = (payload) => ({
  id_sublote: Number.parseInt(payload.id_sublote, 10),
  grados_brix: Number(payload.grados_brix),
  peso_medido_kg: emptyToNull(payload.peso_medido_kg) === null ? null : Number(payload.peso_medido_kg),
  porcentaje_materia_seca:
    emptyToNull(payload.porcentaje_materia_seca) === null ? null : Number(payload.porcentaje_materia_seca),
  temperatura_cuarto: emptyToNull(payload.temperatura_cuarto) === null ? null : Number(payload.temperatura_cuarto),
  observaciones:
    typeof payload.observaciones === 'string' && payload.observaciones.trim() ? payload.observaciones.trim() : null,
});

const getLotes = async (_req, res, next) => {
  try {
    const lots = await maturationLotModel.findAll();
    return res.status(200).json(lots);
  } catch (error) {
    return next(error);
  }
};

const getLoteById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const lot = await maturationLotModel.findById(id);

    if (!lot) {
      return res.status(404).json({ message: 'Lote no encontrado' });
    }

    return res.status(200).json(lot);
  } catch (error) {
    return next(error);
  }
};

const createLote = async (req, res, next) => {
  try {
    const validationError = validateLotPayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const normalizedPayload = normalizeLotPayload(req.body);
    const entry = await entradasMercanciaModel.findById(normalizedPayload.id_entrada_origen);

    if (!entry) {
      return res.status(404).json({ message: 'La entrada de origen no existe' });
    }

    const existingLots = await maturationLotModel.findAll();
    const duplicatedOrigin = existingLots.find(
      (lot) => Number(lot.id_entrada_origen) === Number(normalizedPayload.id_entrada_origen)
    );

    if (duplicatedOrigin) {
      return res.status(400).json({
        message: 'La entrada seleccionada ya tiene un lote de maduracion asociado',
      });
    }

    const newLot = await maturationLotModel.create(normalizedPayload);
    return res.status(201).json(newLot);
  } catch (error) {
    return next(error);
  }
};

const updateLote = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const validationError = validateLotPayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const normalizedPayload = normalizeLotPayload(req.body);
    const entry = await entradasMercanciaModel.findById(normalizedPayload.id_entrada_origen);

    if (!entry) {
      return res.status(404).json({ message: 'La entrada de origen no existe' });
    }

    const existingLots = await maturationLotModel.findAll();
    const duplicatedOrigin = existingLots.find(
      (lot) =>
        Number(lot.id_entrada_origen) === Number(normalizedPayload.id_entrada_origen) &&
        Number(lot.id_lote_mp) !== id
    );

    if (duplicatedOrigin) {
      return res.status(400).json({
        message: 'La entrada seleccionada ya tiene un lote de maduracion asociado',
      });
    }

    const updatedLot = await maturationLotModel.update(id, normalizedPayload);

    if (!updatedLot) {
      return res.status(404).json({ message: 'Lote no encontrado' });
    }

    return res.status(200).json(updatedLot);
  } catch (error) {
    return next(error);
  }
};

const deleteLote = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const deleted = await maturationLotModel.remove(id);

    if (!deleted) {
      return res.status(404).json({ message: 'Lote no encontrado' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

const acceptLote = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const estadoMaduracion = String(req.body.estado_maduracion || '').trim();

    if (!RIPENESS_STATES.includes(estadoMaduracion)) {
      return res.status(400).json({
        message: `estado_maduracion invalido. Valores permitidos: ${RIPENESS_STATES.join(', ')}`,
      });
    }

    const sublote = await maturationLotModel.accept(id, { estado_maduracion: estadoMaduracion });

    if (!sublote) {
      return res.status(404).json({ message: 'Lote no encontrado o no esta pendiente de aceptacion' });
    }

    return res.status(201).json(sublote);
  } catch (error) {
    return next(error);
  }
};

const getSublotes = async (_req, res, next) => {
  try {
    const sublotes = await maturationSublotModel.findAll();
    return res.status(200).json(sublotes);
  } catch (error) {
    return next(error);
  }
};

const getSubloteById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const sublote = await maturationSublotModel.findById(id);

    if (!sublote) {
      return res.status(404).json({ message: 'Sub-lote no encontrado' });
    }

    return res.status(200).json(sublote);
  } catch (error) {
    return next(error);
  }
};

const getSublotesByLote = async (req, res, next) => {
  try {
    const idLote = parseId(req.params.id_lote_mp);

    if (Number.isNaN(idLote)) {
      return res.status(400).json({ message: 'id_lote_mp invalido' });
    }

    const sublotes = await maturationSublotModel.findByLot(idLote);
    return res.status(200).json(sublotes);
  } catch (error) {
    return next(error);
  }
};

const getSublotesListosParaProduccion = async (_req, res, next) => {
  try {
    const sublotes = await maturationSublotModel.findReadyForProduction();
    return res.status(200).json(sublotes);
  } catch (error) {
    return next(error);
  }
};

const splitSublote = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const pesoKg = Number(req.body.peso_kg);

    if (Number.isNaN(pesoKg) || pesoKg <= 0) {
      return res.status(400).json({ message: 'peso_kg debe ser mayor a 0' });
    }

    const result = await maturationSublotModel.split(id, {
      peso_kg: pesoKg,
      observaciones: req.body.observaciones,
    });

    if (!result) {
      return res.status(404).json({ message: 'Sub-lote no encontrado o no esta activo' });
    }

    return res.status(201).json(result);
  } catch (error) {
    return handleMaturationError(error, res, next);
  }
};

const closeSublote = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const pesoMedido = emptyToNull(req.body.peso_medido_kg);

    if (pesoMedido !== null && Number.isNaN(Number(pesoMedido))) {
      return res.status(400).json({ message: 'peso_medido_kg debe ser numerico' });
    }

    const sublote = await maturationSublotModel.close(id, {
      peso_medido_kg: pesoMedido === null ? undefined : Number(pesoMedido),
    });

    if (!sublote) {
      return res.status(404).json({ message: 'Sub-lote no encontrado' });
    }

    return res.status(200).json(sublote);
  } catch (error) {
    return handleMaturationError(error, res, next);
  }
};

const getControles = async (_req, res, next) => {
  try {
    const controls = await maturationControlModel.findAll();
    return res.status(200).json(controls);
  } catch (error) {
    return next(error);
  }
};

const getControlesBySublote = async (req, res, next) => {
  try {
    const idSublote = parseId(req.params.id_sublote);

    if (Number.isNaN(idSublote)) {
      return res.status(400).json({ message: 'id_sublote invalido' });
    }

    const controls = await maturationControlModel.findBySublot(idSublote);
    return res.status(200).json(controls);
  } catch (error) {
    return next(error);
  }
};

const createControl = async (req, res, next) => {
  try {
    const validationError = validateControlPayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const newControl = await maturationControlModel.create(normalizeControlPayload(req.body));
    return res.status(201).json(newControl);
  } catch (error) {
    return next(error);
  }
};

const deleteControl = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const deleted = await maturationControlModel.remove(id);

    if (!deleted) {
      return res.status(404).json({ message: 'Control no encontrado' });
    }

    return res.status(204).send();
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
    const pesoKg = Number(req.body.peso_kg);

    if (Number.isNaN(idSublote) || idSublote <= 0) {
      return res.status(400).json({ message: 'id_sublote es obligatorio y debe ser valido' });
    }

    if (Number.isNaN(idProducto) || idProducto <= 0) {
      return res.status(400).json({ message: 'id_producto es obligatorio y debe ser valido' });
    }

    if (Number.isNaN(pesoKg) || pesoKg <= 0) {
      return res.status(400).json({ message: 'peso_kg debe ser mayor a 0' });
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

    const red = await greenNetModel.create({
      id_sublote: idSublote,
      id_producto: idProducto,
      peso_kg: pesoKg,
      fecha_vencimiento: String(req.body.fecha_vencimiento).slice(0, 10),
      costo_unitario: emptyToNull(req.body.costo_unitario) === null ? null : Number(req.body.costo_unitario),
      id_usuario: req.auth?.sub || null,
    });

    if (!red) {
      return res.status(404).json({ message: 'Sub-lote no encontrado' });
    }

    return res.status(201).json(red);
  } catch (error) {
    return handleMaturationError(error, res, next);
  }
};

module.exports = {
  getLotes,
  getLoteById,
  createLote,
  updateLote,
  deleteLote,
  acceptLote,
  getSublotes,
  getSubloteById,
  getSublotesByLote,
  getSublotesListosParaProduccion,
  splitSublote,
  closeSublote,
  getControles,
  getControlesBySublote,
  createControl,
  deleteControl,
  getRedesBySublote,
  createRed,
};
