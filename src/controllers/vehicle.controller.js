const vehicleModel = require('../models/vehicle.model');

const VEHICLE_STATES = ['Disponible', 'En ruta', 'Mantenimiento', 'Inactivo'];

const parseId = (value) => Number.parseInt(value, 10);

const getVehicles = async (_req, res, next) => {
  try {
    const vehicles = await vehicleModel.findAll();
    return res.status(200).json(vehicles);
  } catch (error) {
    return next(error);
  }
};

const getVehicleById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const vehicle = await vehicleModel.findById(id);

    if (!vehicle) {
      return res.status(404).json({ message: 'Vehiculo no encontrado' });
    }

    return res.status(200).json(vehicle);
  } catch (error) {
    return next(error);
  }
};

const validateVehiclePayload = (payload) => {
  const { placa, estado, kilometraje_actual } = payload;

  if (!placa) {
    return 'placa es obligatoria';
  }

  if (estado !== undefined && !VEHICLE_STATES.includes(estado)) {
    return `estado invalido. Valores permitidos: ${VEHICLE_STATES.join(', ')}`;
  }

  if (kilometraje_actual !== undefined && Number.isNaN(Number(kilometraje_actual))) {
    return 'kilometraje_actual debe ser numerico';
  }

  return null;
};

const validateKilometrajeOnlyPayload = (payload) => {
  if (payload.kilometraje_actual === undefined || payload.kilometraje_actual === null || payload.kilometraje_actual === '') {
    return 'kilometraje_actual es obligatorio';
  }

  if (Number.isNaN(Number(payload.kilometraje_actual))) {
    return 'kilometraje_actual debe ser numerico';
  }

  return null;
};

const createVehicle = async (req, res, next) => {
  try {
    const errorMessage = validateVehiclePayload(req.body);

    if (errorMessage) {
      return res.status(400).json({ message: errorMessage });
    }

    const { placa, modelo, estado, kilometraje_actual } = req.body;

    const newVehicle = await vehicleModel.create({
      placa,
      modelo,
      estado,
      kilometraje_actual,
    });

    return res.status(201).json(newVehicle);
  } catch (error) {
    return next(error);
  }
};

const updateVehicle = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const isPilot = req.auth?.rol === 'Piloto';
    const modifierUserId = req.auth?.sub;

    if (!modifierUserId) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const currentVehicle = await vehicleModel.findById(id);

    if (!currentVehicle) {
      return res.status(404).json({ message: 'Vehiculo no encontrado' });
    }

    if (isPilot) {
      const errorMessage = validateKilometrajeOnlyPayload(req.body);

      if (errorMessage) {
        return res.status(400).json({ message: errorMessage });
      }

      const updatedVehicle = await vehicleModel.update(id, {
        placa: currentVehicle.placa,
        modelo: currentVehicle.modelo,
        estado: currentVehicle.estado,
        kilometraje_actual: req.body.kilometraje_actual,
        id_usuario_modificador: modifierUserId,
      });

      return res.status(200).json(updatedVehicle);
    }

    const errorMessage = validateVehiclePayload(req.body);

    if (errorMessage) {
      return res.status(400).json({ message: errorMessage });
    }

    const { placa, modelo, estado, kilometraje_actual } = req.body;

    const updatedVehicle = await vehicleModel.update(id, {
      placa,
      modelo,
      estado,
      kilometraje_actual,
      id_usuario_modificador: modifierUserId,
    });

    if (!updatedVehicle) {
      return res.status(404).json({ message: 'Vehiculo no encontrado' });
    }

    return res.status(200).json(updatedVehicle);
  } catch (error) {
    return next(error);
  }
};

const deleteVehicle = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const deleted = await vehicleModel.remove(id);

    if (!deleted) {
      return res.status(404).json({ message: 'Vehiculo no encontrado' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
};
