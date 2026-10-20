const coldRoomTypeModel = require('../models/cold_room_type.model');

const parseId = (value) => Number.parseInt(value, 10);

const validatePayload = (payload) => {
  const nombreCuarto = typeof payload.nombre_cuarto === 'string' ? payload.nombre_cuarto.trim() : '';

  if (!nombreCuarto) {
    return 'nombre_cuarto es obligatorio';
  }

  if (nombreCuarto.length > 100) {
    return 'nombre_cuarto debe tener maximo 100 caracteres';
  }

  if (payload.descripcion && String(payload.descripcion).length > 150) {
    return 'descripcion debe tener maximo 150 caracteres';
  }

  return null;
};

const getColdRoomTypes = async (_req, res, next) => {
  try {
    const coldRoomTypes = await coldRoomTypeModel.findAll();
    return res.status(200).json(coldRoomTypes);
  } catch (error) {
    return next(error);
  }
};

const getColdRoomTypeById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const coldRoomType = await coldRoomTypeModel.findById(id);

    if (!coldRoomType) {
      return res.status(404).json({ message: 'Cuarto frio no encontrado' });
    }

    return res.status(200).json(coldRoomType);
  } catch (error) {
    return next(error);
  }
};

const createColdRoomType = async (req, res, next) => {
  try {
    const validationError = validatePayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const newColdRoomType = await coldRoomTypeModel.create({
      nombre_cuarto: req.body.nombre_cuarto.trim(),
      descripcion: req.body.descripcion,
      id_usuario_modificacion: req.auth?.sub ?? null,
    });

    return res.status(201).json(newColdRoomType);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ya existe un cuarto frio con ese nombre' });
    }

    return next(error);
  }
};

const updateColdRoomType = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const validationError = validatePayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const updatedColdRoomType = await coldRoomTypeModel.update(id, {
      nombre_cuarto: req.body.nombre_cuarto.trim(),
      descripcion: req.body.descripcion,
      id_usuario_modificacion: req.auth?.sub ?? null,
    });

    if (!updatedColdRoomType) {
      return res.status(404).json({ message: 'Cuarto frio no encontrado' });
    }

    return res.status(200).json(updatedColdRoomType);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ya existe un cuarto frio con ese nombre' });
    }

    return next(error);
  }
};

const deleteColdRoomType = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const deleted = await coldRoomTypeModel.remove(id, req.auth?.sub ?? null);

    if (!deleted) {
      return res.status(404).json({ message: 'Cuarto frio no encontrado' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getColdRoomTypes,
  getColdRoomTypeById,
  createColdRoomType,
  updateColdRoomType,
  deleteColdRoomType,
};
