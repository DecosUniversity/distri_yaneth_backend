const entradasMercanciaModel = require('../models/entradas_mercancia.model');
const productModel = require('../models/product.model');

const ALLOWED_ENTRY_PRODUCT_TYPES = ['Materia Prima', 'Insumo'];

const parseId = (value) => Number.parseInt(value, 10);

const getEntradasMercancia = async (_req, res, next) => {
  try {
    const entradas = await entradasMercanciaModel.findAll();
    return res.status(200).json(entradas);
  } catch (error) {
    return next(error);
  }
};

const getInventarioExistencias = async (_req, res, next) => {
  try {
    const existencias = await entradasMercanciaModel.findExistencias();
    return res.status(200).json(existencias);
  } catch (error) {
    return next(error);
  }
};

const getMovimientosInventario = async (_req, res, next) => {
  try {
    const movimientos = await entradasMercanciaModel.findMovimientos();
    return res.status(200).json(movimientos);
  } catch (error) {
    return next(error);
  }
};

const getEntradaMercanciaById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const entrada = await entradasMercanciaModel.findById(id);

    if (!entrada) {
      return res.status(404).json({ message: 'Entrada no encontrada' });
    }

    return res.status(200).json(entrada);
  } catch (error) {
    return next(error);
  }
};

const createEntradaMercancia = async (req, res, next) => {
  try {
    const {
      id_proveedor,
      id_producto,
      fecha_vencimiento,
      cantidad_disponible,
      costo_unitario,
      documento_referencia,
      unidades,
    } = req.body;
    const id_usuario_receptor = req.auth?.sub;

    const parsedProviderId = Number.parseInt(id_proveedor, 10);
    const parsedProductId = Number.parseInt(id_producto, 10);
    const parsedCantidad = Number(cantidad_disponible);
    const parsedCostoUnitario =
      costo_unitario === undefined || costo_unitario === null || costo_unitario === ''
        ? null
        : Number(costo_unitario);

    if (Number.isNaN(parsedProviderId) || parsedProviderId <= 0) {
      return res.status(400).json({ message: 'id_proveedor es obligatorio y debe ser valido' });
    }

    if (Number.isNaN(parsedProductId) || parsedProductId <= 0) {
      return res.status(400).json({ message: 'id_producto es obligatorio y debe ser valido' });
    }

    const product = await productModel.findById(parsedProductId);

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    if (!ALLOWED_ENTRY_PRODUCT_TYPES.includes(product.tipo_producto)) {
      return res.status(400).json({
        message: 'Solo se pueden registrar en entradas productos de tipo Materia Prima o Insumo',
      });
    }

    if (!fecha_vencimiento) {
      return res.status(400).json({ message: 'fecha_vencimiento es obligatoria' });
    }

    if (Number.isNaN(parsedCantidad) || parsedCantidad <= 0) {
      return res.status(400).json({ message: 'cantidad_disponible debe ser mayor a 0' });
    }

    if (parsedCostoUnitario !== null && (Number.isNaN(parsedCostoUnitario) || parsedCostoUnitario < 0)) {
      return res.status(400).json({ message: 'costo_unitario debe ser mayor o igual a 0' });
    }

    if (!id_usuario_receptor) {
      return res.status(401).json({ message: 'No se pudo identificar usuario receptor' });
    }

    const newEntrada = await entradasMercanciaModel.create({
      id_proveedor: parsedProviderId,
      id_producto: parsedProductId,
      fecha_vencimiento,
      cantidad_disponible: parsedCantidad,
      costo_unitario: parsedCostoUnitario,
      documento_referencia: documento_referencia || null,
      id_usuario_receptor,
      unidades,
    });

    return res.status(201).json(newEntrada);
  } catch (error) {
    return next(error);
  }
};

const deleteEntradaMercancia = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const deleted = await entradasMercanciaModel.remove(id);

    if (!deleted) {
      return res.status(404).json({ message: 'Entrada no encontrada' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

const getUnitsByEntrada = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const units = await entradasMercanciaModel.findUnitsByEntrada(id);
    return res.status(200).json(units);
  } catch (error) {
    return next(error);
  }
};

const createUnitForEntrada = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const { unidad_codigo, peso, fecha_pesos } = req.body;
    const creado_por = req.auth?.sub;

    if (peso === undefined || peso === null || Number.isNaN(Number(peso))) {
      return res.status(400).json({ message: 'peso es obligatorio y debe ser numerico' });
    }

    const unit = await require('../models/entrada_unidades.model').create({
      id_entrada: id,
      unidad_codigo: unidad_codigo ?? null,
      peso: Number(peso),
      creado_por,
      fecha_pesos,
    });

    return res.status(201).json(unit);
  } catch (error) {
    return next(error);
  }
};

const deleteUnit = async (req, res, next) => {
  try {
    const unitId = parseId(req.params.unitId);
    if (Number.isNaN(unitId)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const removed = await require('../models/entrada_unidades.model').remove(unitId);
    if (!removed) {
      return res.status(404).json({ message: 'Unidad no encontrada' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getEntradasMercancia,
  getInventarioExistencias,
  getMovimientosInventario,
  getEntradaMercanciaById,
  createEntradaMercancia,
  deleteEntradaMercancia,
  getUnitsByEntrada,
  createUnitForEntrada,
  deleteUnit,
};