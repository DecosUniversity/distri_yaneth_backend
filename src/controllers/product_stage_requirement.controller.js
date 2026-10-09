const productModel = require('../models/product.model');
const stageTypeModel = require('../models/stage_type.model');
const productStageRequirementModel = require('../models/product_stage_requirement.model');
const { parseId, validateEtapasPayload } = require('../utils/stage_recipe_validation');

const FINISHED_PRODUCT_TYPE = 'Producto Terminado';

const getRequirements = async (req, res, next) => {
  try {
    const idProducto = parseId(req.params.id_producto);

    if (Number.isNaN(idProducto)) {
      return res.status(400).json({ message: 'id_producto invalido' });
    }

    const product = await productModel.findById(idProducto);

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    const requirements = await productStageRequirementModel.findByProduct(idProducto);
    return res.status(200).json(requirements);
  } catch (error) {
    return next(error);
  }
};

const replaceRequirements = async (req, res, next) => {
  try {
    const idProducto = parseId(req.params.id_producto);

    if (Number.isNaN(idProducto)) {
      return res.status(400).json({ message: 'id_producto invalido' });
    }

    const etapas = req.body?.etapas ?? [];
    const validationError = validateEtapasPayload(etapas);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const product = await productModel.findById(idProducto);

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    if (String(product.tipo_producto || '').trim() !== FINISHED_PRODUCT_TYPE) {
      return res.status(400).json({ message: 'Solo los productos de tipo Producto Terminado pueden tener una receta de etapas' });
    }

    const normalizedEtapas = etapas.map((value) => parseId(value));

    for (const idTipoEtapa of normalizedEtapas) {
      const stageType = await stageTypeModel.findById(idTipoEtapa);

      if (!stageType) {
        return res.status(404).json({ message: `Tipo de etapa #${idTipoEtapa} no encontrado` });
      }
    }

    const requirements = await productStageRequirementModel.replaceForProduct(
      idProducto,
      normalizedEtapas,
      req.auth?.sub ?? null
    );

    return res.status(200).json(requirements);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getRequirements,
  replaceRequirements,
};
