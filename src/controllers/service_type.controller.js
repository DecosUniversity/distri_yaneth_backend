const serviceTypeModel = require('../models/service_type.model');

const parseId = (value) => Number.parseInt(value, 10);

const validatePayload = (payload) => {
  const nombreServicio = typeof payload.nombre_servicio === 'string' ? payload.nombre_servicio.trim() : '';

  if (!nombreServicio) {
    return 'nombre_servicio es obligatorio';
  }

  if (
    payload.km_frecuencia !== undefined &&
    payload.km_frecuencia !== null &&
    payload.km_frecuencia !== '' &&
    (Number.isNaN(Number(payload.km_frecuencia)) || Number(payload.km_frecuencia) < 0)
  ) {
    return 'km_frecuencia debe ser numerico y mayor o igual a 0';
  }

  return null;
};

const getServiceTypes = async (_req, res, next) => {
  try {
    const serviceTypes = await serviceTypeModel.findAll();
    return res.status(200).json(serviceTypes);
  } catch (error) {
    return next(error);
  }
};

const getServiceTypeById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const serviceType = await serviceTypeModel.findById(id);

    if (!serviceType) {
      return res.status(404).json({ message: 'Tipo de servicio no encontrado' });
    }

    return res.status(200).json(serviceType);
  } catch (error) {
    return next(error);
  }
};

const createServiceType = async (req, res, next) => {
  try {
    const validationError = validatePayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const payload = {
      nombre_servicio: req.body.nombre_servicio.trim(),
      descripcion: req.body.descripcion,
      km_frecuencia: req.body.km_frecuencia,
    };

    const newServiceType = await serviceTypeModel.create(payload);
    return res.status(201).json(newServiceType);
  } catch (error) {
    return next(error);
  }
};

const updateServiceType = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const validationError = validatePayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const payload = {
      nombre_servicio: req.body.nombre_servicio.trim(),
      descripcion: req.body.descripcion,
      km_frecuencia: req.body.km_frecuencia,
    };

    const updatedServiceType = await serviceTypeModel.update(id, payload);

    if (!updatedServiceType) {
      return res.status(404).json({ message: 'Tipo de servicio no encontrado' });
    }

    return res.status(200).json(updatedServiceType);
  } catch (error) {
    return next(error);
  }
};

const deleteServiceType = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const deleted = await serviceTypeModel.remove(id);

    if (!deleted) {
      return res.status(404).json({ message: 'Tipo de servicio no encontrado' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getServiceTypes,
  getServiceTypeById,
  createServiceType,
  updateServiceType,
  deleteServiceType,
};
