const vehicleServiceModel = require('../models/vehicle_service.model');

const parseId = (value) => Number.parseInt(value, 10);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isPositiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) > 0;
const isValidDecimal = (value) => !Number.isNaN(Number(value)) && Number(value) >= 0;

const validatePayload = (payload) => {
  if (!isPositiveInteger(payload.id_vehiculo)) {
    return 'id_vehiculo es obligatorio y debe ser numerico';
  }

  if (!isPositiveInteger(payload.id_tipo_servicio)) {
    return 'id_tipo_servicio es obligatorio y debe ser numerico';
  }

  if (typeof payload.fecha_servicio !== 'string' || !DATE_PATTERN.test(payload.fecha_servicio.trim())) {
    return 'fecha_servicio es obligatoria y debe tener formato YYYY-MM-DD';
  }

  if (!isValidDecimal(payload.km_en_servicio)) {
    return 'km_en_servicio es obligatorio y debe ser numerico mayor o igual a 0';
  }

  if (
    payload.costo_servicio !== undefined &&
    payload.costo_servicio !== null &&
    payload.costo_servicio !== '' &&
    !isValidDecimal(payload.costo_servicio)
  ) {
    return 'costo_servicio debe ser numerico mayor o igual a 0';
  }

  if (
    payload.proximo_servicio_km !== undefined &&
    payload.proximo_servicio_km !== null &&
    payload.proximo_servicio_km !== '' &&
    !isValidDecimal(payload.proximo_servicio_km)
  ) {
    return 'proximo_servicio_km debe ser numerico mayor o igual a 0';
  }

  return null;
};

const normalizePayload = (payload) => ({
  id_vehiculo: Number(payload.id_vehiculo),
  id_tipo_servicio: Number(payload.id_tipo_servicio),
  fecha_servicio: payload.fecha_servicio.trim(),
  km_en_servicio: Number(payload.km_en_servicio),
  costo_servicio:
    payload.costo_servicio === undefined || payload.costo_servicio === null || payload.costo_servicio === ''
      ? undefined
      : Number(payload.costo_servicio),
  proximo_servicio_km:
    payload.proximo_servicio_km === undefined ||
    payload.proximo_servicio_km === null ||
    payload.proximo_servicio_km === ''
      ? undefined
      : Number(payload.proximo_servicio_km),
  notas: payload.notas,
});

const getVehicleServices = async (_req, res, next) => {
  try {
    const vehicleServices = await vehicleServiceModel.findAll();
    return res.status(200).json(vehicleServices);
  } catch (error) {
    return next(error);
  }
};

const getVehicleServiceById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const vehicleService = await vehicleServiceModel.findById(id);

    if (!vehicleService) {
      return res.status(404).json({ message: 'Servicio de vehiculo no encontrado' });
    }

    return res.status(200).json(vehicleService);
  } catch (error) {
    return next(error);
  }
};

const createVehicleService = async (req, res, next) => {
  try {
    const validationError = validatePayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const newVehicleService = await vehicleServiceModel.create(normalizePayload(req.body));
    return res.status(201).json(newVehicleService);
  } catch (error) {
    return next(error);
  }
};

const updateVehicleService = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const validationError = validatePayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const updatedVehicleService = await vehicleServiceModel.update(id, normalizePayload(req.body));

    if (!updatedVehicleService) {
      return res.status(404).json({ message: 'Servicio de vehiculo no encontrado' });
    }

    return res.status(200).json(updatedVehicleService);
  } catch (error) {
    return next(error);
  }
};

const deleteVehicleService = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const deleted = await vehicleServiceModel.remove(id);

    if (!deleted) {
      return res.status(404).json({ message: 'Servicio de vehiculo no encontrado' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getVehicleServices,
  getVehicleServiceById,
  createVehicleService,
  updateVehicleService,
  deleteVehicleService,
};