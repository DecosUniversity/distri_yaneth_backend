const maturationLotModel = require('../models/maturation_lot.model');
const maturationControlModel = require('../models/maturation_control.model');
const entradasMercanciaModel = require('../models/entradas_mercancia.model');

const parseId = (value) => Number.parseInt(value, 10);
const MATURATION_REGISTRATION_STATES = ['Pendiente', 'Activo', 'Completo', 'Inactivo'];

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

  if (parsedEntryOriginId === null) {
    return 'id_entrada_origen es obligatorio y debe ser valido';
  }

  if (Number.isNaN(parsedEntryOriginId) || parsedEntryOriginId <= 0) {
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
  const parsedLotId = Number.parseInt(payload.id_lote_mp, 10);
  const parsedBrix = Number(payload.grados_brix);
  const parsedTemperatura =
    payload.temperatura_cuarto === undefined || payload.temperatura_cuarto === null || payload.temperatura_cuarto === ''
      ? null
      : Number(payload.temperatura_cuarto);

  if (Number.isNaN(parsedLotId) || parsedLotId <= 0) {
    return 'id_lote_mp es obligatorio y debe ser valido';
  }

  if (Number.isNaN(parsedBrix) || parsedBrix < 0) {
    return 'grados_brix debe ser numerico y mayor o igual a 0';
  }

  if (parsedTemperatura !== null && Number.isNaN(parsedTemperatura)) {
    return 'temperatura_cuarto debe ser numerica';
  }

  return null;
};

const normalizeControlPayload = (payload) => ({
  id_lote_mp: Number.parseInt(payload.id_lote_mp, 10),
  grados_brix: Number(payload.grados_brix),
  temperatura_cuarto:
    payload.temperatura_cuarto === undefined || payload.temperatura_cuarto === null || payload.temperatura_cuarto === ''
      ? null
      : Number(payload.temperatura_cuarto),
  observaciones:
    typeof payload.observaciones === 'string' && payload.observaciones.trim()
      ? payload.observaciones.trim()
      : null,
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

const getControles = async (_req, res, next) => {
  try {
    const controls = await maturationControlModel.findAll();
    return res.status(200).json(controls);
  } catch (error) {
    return next(error);
  }
};

const getControlesByLote = async (req, res, next) => {
  try {
    const idLote = parseId(req.params.id_lote_mp);

    if (Number.isNaN(idLote)) {
      return res.status(400).json({ message: 'id_lote_mp invalido' });
    }

    const controls = await maturationControlModel.findByLot(idLote);
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

module.exports = {
  getLotes,
  getLoteById,
  createLote,
  updateLote,
  deleteLote,
  getControles,
  getControlesByLote,
  createControl,
  deleteControl,
};
