const productModel = require('../models/product.model');
const productionModel = require('../models/production.model');
const maturationSublotModel = require('../models/maturation_sublot.model');

const parseId = (value) => Number.parseInt(value, 10);

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
  'El proceso ya fue finalizado y no puede revertirse',
  'Debes declarar el peso a revertir cuando el proceso ya tiene etapas, mermas o insumos registrados',
  'Debes justificar la reversion cuando el proceso ya tiene trabajo registrado',
  'La orden de produccion seleccionada no existe',
  'La orden de produccion ya no esta disponible (Completada o Cancelada)',
  'El producto del proceso no coincide con el producto de la orden de produccion',
];

const handleProductionError = (error, res, next) => {
  if (BUSINESS_RULE_MESSAGES.includes(error.message) || error.message.startsWith('El peso no cuadra')) {
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

  if (payload.id_orden !== undefined && payload.id_orden !== null && payload.id_orden !== '') {
    const orderId = parseId(payload.id_orden);

    if (Number.isNaN(orderId) || orderId <= 0) {
      return 'id_orden debe ser valido si se especifica';
    }
  }

  return null;
};

const isPositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0;
};

const validateStagePayload = (payload) => {
  const stageTypeId = parseId(payload.id_tipo_etapa);
  const quantityIn = emptyToNull(payload.cantidad_entrada_kg);

  if (Number.isNaN(stageTypeId) || stageTypeId <= 0) {
    return 'id_tipo_etapa es obligatorio y debe ser valido';
  }

  if (!payload.fecha_inicio) {
    return 'fecha_inicio es obligatoria';
  }

  if (!isPositiveInteger(payload.cantidad_personas)) {
    return 'cantidad_personas es obligatoria y debe ser un numero entero mayor a 0';
  }

  if (quantityIn !== null && Number.isNaN(Number(quantityIn))) {
    return 'cantidad_entrada_kg debe ser numerica';
  }

  return null;
};

const validateStageUpdatePayload = (payload) => {
  const stageTypeId = parseId(payload.id_tipo_etapa);
  const quantityIn = emptyToNull(payload.cantidad_entrada_kg);

  if (Number.isNaN(stageTypeId) || stageTypeId <= 0) {
    return 'id_tipo_etapa es obligatorio y debe ser valido';
  }

  if (!payload.fecha_inicio) {
    return 'fecha_inicio es obligatoria';
  }

  if (!isPositiveInteger(payload.cantidad_personas)) {
    return 'cantidad_personas es obligatoria y debe ser un numero entero mayor a 0';
  }

  if (quantityIn !== null && Number.isNaN(Number(quantityIn))) {
    return 'cantidad_entrada_kg debe ser numerica';
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

const getReporteMermasPorCategoria = async (_req, res, next) => {
  try {
    const report = await productionModel.reportMermasPorCategoria();
    return res.status(200).json(report);
  } catch (error) {
    return next(error);
  }
};

const getReporteProduccionPorProducto = async (_req, res, next) => {
  try {
    const report = await productionModel.reportProduccionPorProducto();
    return res.status(200).json(report);
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
      id_orden:
        req.body.id_orden !== undefined && req.body.id_orden !== null && req.body.id_orden !== ''
          ? parseId(req.body.id_orden)
          : null,
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
      id_tipo_etapa: parseId(req.body.id_tipo_etapa),
      cantidad_personas: Number.parseInt(req.body.cantidad_personas, 10),
      personal_asignado: req.body.personal_asignado,
      fecha_inicio: formatDateTime(req.body.fecha_inicio),
      cantidad_entrada_kg: emptyToNull(req.body.cantidad_entrada_kg) === null ? null : Number(req.body.cantidad_entrada_kg),
      observaciones: req.body.observaciones,
      id_usuario_modificacion: req.auth?.sub ?? null,
    });

    if (!stage) {
      return res.status(404).json({ message: 'Proceso no encontrado o ya finalizado' });
    }

    return res.status(201).json(stage);
  } catch (error) {
    return next(error);
  }
};

const updateEtapa = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const idEtapa = parseId(req.params.id_etapa);

    if (Number.isNaN(id) || Number.isNaN(idEtapa)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const validationError = validateStageUpdatePayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const stage = await productionModel.updateStage(id, idEtapa, {
      id_tipo_etapa: parseId(req.body.id_tipo_etapa),
      cantidad_personas: Number.parseInt(req.body.cantidad_personas, 10),
      personal_asignado: req.body.personal_asignado,
      fecha_inicio: formatDateTime(req.body.fecha_inicio),
      fecha_fin: formatDateTime(req.body.fecha_fin),
      cantidad_entrada_kg: emptyToNull(req.body.cantidad_entrada_kg) === null ? null : Number(req.body.cantidad_entrada_kg),
      observaciones: req.body.observaciones,
      id_usuario_modificacion: req.auth?.sub ?? null,
    });

    if (!stage) {
      return res.status(404).json({ message: 'Etapa no encontrada' });
    }

    return res.status(200).json(stage);
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
      id_usuario_modificacion: req.auth?.sub ?? null,
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
      id_usuario_modificacion: req.auth?.sub ?? null,
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
      id_usuario_modificacion: req.auth?.sub ?? null,
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
      justificacion_diferencia: req.body.justificacion_diferencia,
      id_usuario_modificacion: req.auth?.sub ?? null,
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

    const deleted = await productionModel.remove(id, req.auth?.sub ?? null);

    if (!deleted) {
      return res.status(404).json({ message: 'Proceso no encontrado' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

const revertProceso = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const { peso_a_revertir, justificacion_reversion } = req.body || {};
    const reverted = await productionModel.revert(id, peso_a_revertir, justificacion_reversion, req.auth?.sub ?? null);

    if (!reverted) {
      return res.status(404).json({ message: 'Proceso no encontrado' });
    }

    return res.status(200).json({ message: 'Proceso revertido: el sub-lote vuelve a Listo para produccion' });
  } catch (error) {
    return handleProductionError(error, res, next);
  }
};

module.exports = {
  getProcesos,
  getProcesoById,
  createProceso,
  addEtapa,
  updateEtapa,
  addMerma,
  addInsumo,
  addColdRoomEntry,
  finalizeProceso,
  deleteProceso,
  revertProceso,
  getReporteMermasPorCategoria,
  getReporteProduccionPorProducto,
};
