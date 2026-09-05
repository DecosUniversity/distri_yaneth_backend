const mermaTypeModel = require('../models/merma_type.model');

const parseId = (value) => Number.parseInt(value, 10);

const validatePayload = (payload) => {
  const nombreMerma = typeof payload.nombre_merma === 'string' ? payload.nombre_merma.trim() : '';

  if (!nombreMerma) {
    return 'nombre_merma es obligatorio';
  }

  if (nombreMerma.length > 50) {
    return 'nombre_merma debe tener maximo 50 caracteres';
  }

  if (payload.descripcion && String(payload.descripcion).length > 150) {
    return 'descripcion debe tener maximo 150 caracteres';
  }

  return null;
};

const getMermaTypes = async (_req, res, next) => {
  try {
    const mermaTypes = await mermaTypeModel.findAll();
    return res.status(200).json(mermaTypes);
  } catch (error) {
    return next(error);
  }
};

const getMermaTypeById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const mermaType = await mermaTypeModel.findById(id);

    if (!mermaType) {
      return res.status(404).json({ message: 'Categoria de merma no encontrada' });
    }

    return res.status(200).json(mermaType);
  } catch (error) {
    return next(error);
  }
};

const createMermaType = async (req, res, next) => {
  try {
    const validationError = validatePayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const newMermaType = await mermaTypeModel.create({
      nombre_merma: req.body.nombre_merma.trim(),
      descripcion: req.body.descripcion,
      id_usuario_modificacion: req.auth?.sub ?? null,
    });

    return res.status(201).json(newMermaType);
  } catch (error) {
    return next(error);
  }
};

const updateMermaType = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const validationError = validatePayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const updatedMermaType = await mermaTypeModel.update(id, {
      nombre_merma: req.body.nombre_merma.trim(),
      descripcion: req.body.descripcion,
      id_usuario_modificacion: req.auth?.sub ?? null,
    });

    if (!updatedMermaType) {
      return res.status(404).json({ message: 'Categoria de merma no encontrada' });
    }

    return res.status(200).json(updatedMermaType);
  } catch (error) {
    return next(error);
  }
};

const deleteMermaType = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const deleted = await mermaTypeModel.remove(id, req.auth?.sub ?? null);

    if (!deleted) {
      return res.status(404).json({ message: 'Categoria de merma no encontrada' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getMermaTypes,
  getMermaTypeById,
  createMermaType,
  updateMermaType,
  deleteMermaType,
};
