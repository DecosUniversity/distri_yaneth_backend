const stageTypeModel = require('../models/stage_type.model');

const parseId = (value) => Number.parseInt(value, 10);

const validatePayload = (payload) => {
  const nombreEtapa = typeof payload.nombre_etapa === 'string' ? payload.nombre_etapa.trim() : '';

  if (!nombreEtapa) {
    return 'nombre_etapa es obligatorio';
  }

  if (nombreEtapa.length > 60) {
    return 'nombre_etapa debe tener maximo 60 caracteres';
  }

  if (payload.descripcion && String(payload.descripcion).length > 150) {
    return 'descripcion debe tener maximo 150 caracteres';
  }

  return null;
};

const getStageTypes = async (_req, res, next) => {
  try {
    const stageTypes = await stageTypeModel.findAll();
    return res.status(200).json(stageTypes);
  } catch (error) {
    return next(error);
  }
};

const getStageTypeById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const stageType = await stageTypeModel.findById(id);

    if (!stageType) {
      return res.status(404).json({ message: 'Tipo de etapa no encontrado' });
    }

    return res.status(200).json(stageType);
  } catch (error) {
    return next(error);
  }
};

const createStageType = async (req, res, next) => {
  try {
    const validationError = validatePayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const newStageType = await stageTypeModel.create({
      nombre_etapa: req.body.nombre_etapa.trim(),
      descripcion: req.body.descripcion,
      id_usuario_modificacion: req.auth?.sub ?? null,
    });

    return res.status(201).json(newStageType);
  } catch (error) {
    return next(error);
  }
};

const updateStageType = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const validationError = validatePayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const updatedStageType = await stageTypeModel.update(id, {
      nombre_etapa: req.body.nombre_etapa.trim(),
      descripcion: req.body.descripcion,
      id_usuario_modificacion: req.auth?.sub ?? null,
    });

    if (!updatedStageType) {
      return res.status(404).json({ message: 'Tipo de etapa no encontrado' });
    }

    return res.status(200).json(updatedStageType);
  } catch (error) {
    return next(error);
  }
};

const deleteStageType = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const deleted = await stageTypeModel.remove(id, req.auth?.sub ?? null);

    if (!deleted) {
      return res.status(404).json({ message: 'Tipo de etapa no encontrado' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getStageTypes,
  getStageTypeById,
  createStageType,
  updateStageType,
  deleteStageType,
};
