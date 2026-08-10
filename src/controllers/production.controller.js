const productModel = require('../models/product.model');
const productionModel = require('../models/production.model');
const maturationSublotModel = require('../models/maturation_sublot.model');

const parseId = (value) => Number.parseInt(value, 10);

const PRODUCTION_STAGES = ['Pelado', 'Corte', 'Fritura', 'Embalaje'];
const FINISHED_PRODUCT_TYPE = 'Producto Terminado';
const INSUMO_PRODUCT_TYPE = 'Insumo';
const SUBLOT_READY_STATE = 'Listo para produccion';

const formatDateTime = (value) => {
  if (!value) {
    return null;
  }

  return String(value).replace('T', ' ').slice(0, 19);
};

const emptyToNull = (value) => (value === undefined || value === null || value === '' ? null : value);

const BUSINESS_RULE_MESSAGES = [
  'La cantidad ingresada supera el peso disponible del sub-lote',
  'El proceso ya fue finalizado',
  'La cantidad producida no es valida',
  'La cantidad producida no puede superar la cantidad ingresada',
  'No hay suficiente inventario disponible para el insumo seleccionado',
];

const handleProductionError = (error, res, next) => {
  if (BUSINESS_RULE_MESSAGES.includes(error.message)) {
    return res.status(400).json({ message: error.message });
  }

  return next(error);
};

const validateProcessPayload = (payload) => {
  const sublotId = parseId(payload.id_sublote);
  const productId = parseId(payload.id_producto_resultado);
  const quantity = Number(payload.cantidad_ingresada_kg);

  if (Number.isNaN(sublotId) || sublotId <= 0) {
    return 'id_sublote es obligatorio y debe ser valido';
  }

  if (Number.isNaN(productId) || productId <= 0) {
    return 'id_producto_resultado es obligatorio y debe ser valido';
  }

  if (Number.isNaN(quantity) || quantity <= 0) {
    return 'cantidad_ingresada_kg debe ser mayor a 0';
  }

  return null;
};

const validateStagePayload = (payload) => {
  const stage = String(payload.nombre_etapa || '').trim();
  const quantityIn = emptyToNull(payload.cantidad_entrada_kg);
  const quantityOut = emptyToNull(payload.cantidad_salida_kg);
  const merma = emptyToNull(payload.merma_kg);

  if (!PRODUCTION_STAGES.includes(stage)) {
    return `nombre_etapa invalido. Valores permitidos: ${PRODUCTION_STAGES.join(', ')}`;
  }

  if (!payload.fecha_inicio) {
    return 'fecha_inicio es obligatoria';
  }

  if (!payload.personal_asignado || !String(payload.personal_asignado).trim()) {
    return 'personal_asignado es obligatorio';
  }

  if (quantityIn !== null && Number.isNaN(Number(quantityIn))) {
    return 'cantidad_entrada_kg debe ser numerica';
  }

  if (quantityOut !== null && Number.isNaN(Number(quantityOut))) {
    return 'cantidad_salida_kg debe ser numerica';
  }

  if (merma !== null && Number.isNaN(Number(merma))) {
    return 'merma_kg debe ser numerica';
  }

  return null;
};

const validateMermaPayload = (payload) => {
  const typeId = parseId(payload.id_tipo_merma);
  const quantity = Number(payload.cantidad_kg);

  if (Number.isNaN(typeId) || typeId <= 0) {
    return 'id_tipo_merma es obligatorio y debe ser valido';
  }

  if (Number.isNaN(quantity) || quantity <= 0) {
    return 'cantidad_kg debe ser mayor a 0';
  }

  return null;
};

const validateInsumoPayload = (payload) => {
  const productId = parseId(payload.id_producto);
  const quantity = Number(payload.cantidad);

  if (Number.isNaN(productId) || productId <= 0) {
    return 'id_producto es obligatorio y debe ser valido';
  }

  if (Number.isNaN(quantity) || quantity <= 0) {
    return 'cantidad debe ser mayor a 0';
  }

  if (!payload.unidad_medida || !String(payload.unidad_medida).trim()) {
    return 'unidad_medida es obligatoria';
  }

  return null;
};

const validateColdRoomPayload = (payload) => {
  const quantity = Number(payload.cantidad_kg);

  if (!payload.fecha_ingreso) {
    return 'fecha_ingreso es obligatoria';
  }

  if (!payload.ubicacion_cuarto || !String(payload.ubicacion_cuarto).trim()) {
    return 'ubicacion_cuarto es obligatoria';
  }

  if (Number.isNaN(quantity) || quantity <= 0) {
    return 'cantidad_kg debe ser mayor a 0';
  }

  return null;
};

const validateFinalizePayload = (payload) => {
  const quantity = Number(payload.cantidad_producida_kg);

  if (!payload.fecha_fin) {
    return 'fecha_fin es obligatoria';
  }

  if (!payload.fecha_vencimiento) {
    return 'fecha_vencimiento es obligatoria';
  }

  if (Number.isNaN(quantity) || quantity < 0) {
    return 'cantidad_producida_kg debe ser numerica y mayor o igual a 0';
  }

  return null;
};

const getProcesos = async (_req, res, next) => {
  try {
    const processes = await productionModel.findAll();
    return res.status(200).json(processes);
  } catch (error) {
    return next(error);
  }
};

const getProcesoById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const process = await productionModel.findById(id);

    if (!process) {
      return res.status(404).json({ message: 'Proceso no encontrado' });
    }

    return res.status(200).json(process);
  } catch (error) {
    return next(error);
  }
};

const createProceso = async (req, res, next) => {
  try {
    const validationError = validateProcessPayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const payload = {
      id_sublote: parseId(req.body.id_sublote),
      id_producto_resultado: parseId(req.body.id_producto_resultado),
      cantidad_ingresada_kg: Number(req.body.cantidad_ingresada_kg),
      fecha_inicio: formatDateTime(req.body.fecha_inicio) || undefined,
      cuarto_congelado: req.body.cuarto_congelado,
      ubicacion_cuarto_congelado: req.body.ubicacion_cuarto_congelado,
      observaciones: req.body.observaciones,
      id_usuario_registro: req.auth?.sub || null,
    };

    const sublote = await maturationSublotModel.findById(payload.id_sublote);
    if (!sublote) {
      return res.status(404).json({ message: 'Sub-lote de materia prima no encontrado' });
    }

    if (String(sublote.estado_registro || '').trim() !== SUBLOT_READY_STATE) {
      return res.status(400).json({
        message: 'El sub-lote debe estar Listo para produccion para iniciar un proceso',
      });
    }

    const product = await productModel.findById(payload.id_producto_resultado);
    if (!product) {
      return res.status(404).json({ message: 'Producto de salida no encontrado' });
    }

    if (String(product.tipo_producto || '').trim() !== FINISHED_PRODUCT_TYPE) {
      return res.status(400).json({ message: 'El producto de salida debe ser de tipo Producto Terminado' });
    }

    const process = await productionModel.create(payload);
    return res.status(201).json(process);
  } catch (error) {
    return handleProductionError(error, res, next);
  }
};

const addEtapa = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const validationError = validateStagePayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const stage = await productionModel.addStage(id, {
      nombre_etapa: String(req.body.nombre_etapa).trim(),
      fecha_inicio: formatDateTime(req.body.fecha_inicio),
      fecha_fin: formatDateTime(req.body.fecha_fin),
      personal_asignado: String(req.body.personal_asignado).trim(),
      cantidad_entrada_kg: emptyToNull(req.body.cantidad_entrada_kg) === null ? null : Number(req.body.cantidad_entrada_kg),
      cantidad_salida_kg: emptyToNull(req.body.cantidad_salida_kg) === null ? null : Number(req.body.cantidad_salida_kg),
      merma_kg: emptyToNull(req.body.merma_kg) === null ? null : Number(req.body.merma_kg),
      observaciones: req.body.observaciones,
    });

    if (!stage) {
      return res.status(404).json({ message: 'Proceso no encontrado o ya finalizado' });
    }

    return res.status(201).json(stage);
  } catch (error) {
    return next(error);
  }
};

const addMerma = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const validationError = validateMermaPayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const merma = await productionModel.addMerma(id, {
      id_etapa: emptyToNull(req.body.id_etapa) === null ? null : parseId(req.body.id_etapa),
      id_tipo_merma: parseId(req.body.id_tipo_merma),
      cantidad_kg: Number(req.body.cantidad_kg),
      observaciones: req.body.observaciones,
    });

    if (!merma) {
      return res.status(404).json({ message: 'Proceso no encontrado o ya finalizado' });
    }

    return res.status(201).json(merma);
  } catch (error) {
    return next(error);
  }
};

const addInsumo = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const validationError = validateInsumoPayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const idProducto = parseId(req.body.id_producto);
    const product = await productModel.findById(idProducto);

    if (!product) {
      return res.status(404).json({ message: 'Insumo (producto) no encontrado' });
    }

    if (String(product.tipo_producto || '').trim() !== INSUMO_PRODUCT_TYPE) {
      return res.status(400).json({ message: 'El producto seleccionado debe ser de tipo Insumo' });
    }

    const insumo = await productionModel.addInsumo(id, {
      id_etapa: emptyToNull(req.body.id_etapa) === null ? null : parseId(req.body.id_etapa),
      id_producto: idProducto,
      cantidad: Number(req.body.cantidad),
      unidad_medida: String(req.body.unidad_medida).trim(),
      observaciones: req.body.observaciones,
    });

    if (!insumo) {
      return res.status(404).json({ message: 'Proceso no encontrado o ya finalizado' });
    }

    return res.status(201).json(insumo);
  } catch (error) {
    return handleProductionError(error, res, next);
  }
};

const addColdRoomEntry = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const validationError = validateColdRoomPayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const coldRoom = await productionModel.addColdRoomEntry(id, {
      fecha_ingreso: formatDateTime(req.body.fecha_ingreso),
      ubicacion_cuarto: String(req.body.ubicacion_cuarto).trim(),
      cantidad_kg: Number(req.body.cantidad_kg),
      observaciones: req.body.observaciones,
    });

    if (!coldRoom) {
      return res.status(404).json({ message: 'Proceso no encontrado o ya finalizado' });
    }

    return res.status(201).json(coldRoom);
  } catch (error) {
    return next(error);
  }
};

const finalizeProceso = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const validationError = validateFinalizePayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const finalized = await productionModel.finalize(id, {
      cantidad_producida_kg: Number(req.body.cantidad_producida_kg),
      fecha_fin: formatDateTime(req.body.fecha_fin),
      fecha_vencimiento: String(req.body.fecha_vencimiento).slice(0, 10),
      cuarto_congelado: req.body.cuarto_congelado,
      ubicacion_cuarto_congelado: req.body.ubicacion_cuarto_congelado,
      observaciones: req.body.observaciones,
      costo_unitario: emptyToNull(req.body.costo_unitario) === null ? null : Number(req.body.costo_unitario),
    });

    if (!finalized) {
      return res.status(404).json({ message: 'Proceso no encontrado' });
    }

    return res.status(200).json(finalized);
  } catch (error) {
    return handleProductionError(error, res, next);
  }
};

const deleteProceso = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const deleted = await productionModel.remove(id);

    if (!deleted) {
      return res.status(404).json({ message: 'Proceso no encontrado' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getProcesos,
  getProcesoById,
  createProceso,
  addEtapa,
  addMerma,
  addInsumo,
  addColdRoomEntry,
  finalizeProceso,
  deleteProceso,
};
