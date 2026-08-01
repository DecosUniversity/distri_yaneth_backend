const productModel = require('../models/product.model');

const PRODUCT_TYPES = ['Materia Prima', 'Producto Terminado', 'Insumo', 'Venta Directa'];

const parseId = (value) => Number.parseInt(value, 10);

const getProducts = async (_req, res, next) => {
  try {
    const products = await productModel.findAll();
    return res.status(200).json(products);
  } catch (error) {
    return next(error);
  }
};

const getProductById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const product = await productModel.findById(id);

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    return res.status(200).json(product);
  } catch (error) {
    return next(error);
  }
};

const validateProductPayload = (payload) => {
  const {
    nombre,
    tipo_producto,
    stock_minimo,
    precio_venta_sugerido,
  } = payload;

  if (!nombre) {
    return 'nombre es obligatorio';
  }

  if (!tipo_producto) {
    return 'tipo_producto es obligatorio';
  }

  if (!PRODUCT_TYPES.includes(tipo_producto)) {
    return `tipo_producto invalido. Valores permitidos: ${PRODUCT_TYPES.join(', ')}`;
  }

  if (stock_minimo !== undefined && Number.isNaN(Number(stock_minimo))) {
    return 'stock_minimo debe ser numerico';
  }

  if (precio_venta_sugerido !== undefined && Number.isNaN(Number(precio_venta_sugerido))) {
    return 'precio_venta_sugerido debe ser numerico';
  }

  return null;
};

const createProduct = async (req, res, next) => {
  try {
    const errorMessage = validateProductPayload(req.body);

    if (errorMessage) {
      return res.status(400).json({ message: errorMessage });
    }

    const {
      nombre,
      descripcion,
      unidad_medida,
      tipo_producto,
      stock_minimo,
      precio_venta_sugerido,
    } = req.body;

    const newProduct = await productModel.create({
      nombre,
      descripcion,
      unidad_medida,
      tipo_producto,
      stock_minimo,
      precio_venta_sugerido,
    });

    return res.status(201).json(newProduct);
  } catch (error) {
    return next(error);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const errorMessage = validateProductPayload(req.body);

    if (errorMessage) {
      return res.status(400).json({ message: errorMessage });
    }

    const {
      nombre,
      descripcion,
      unidad_medida,
      tipo_producto,
      stock_minimo,
      precio_venta_sugerido,
    } = req.body;

    const updatedProduct = await productModel.update(id, {
      nombre,
      descripcion,
      unidad_medida,
      tipo_producto,
      stock_minimo,
      precio_venta_sugerido,
    });

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    return res.status(200).json(updatedProduct);
  } catch (error) {
    return next(error);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const deleted = await productModel.remove(id);

    if (!deleted) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
