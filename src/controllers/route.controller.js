const routeModel = require('../models/route.model');
const vehicleModel = require('../models/vehicle.model');
const userModel = require('../models/user.model');

const PILOT_ROLE = 'Piloto';
const ADMIN_ROLE = 'Administrador';
const BUSINESS_RULE_MESSAGES = [
  'El vehiculo debe estar Disponible para asignarlo a una ruta',
  'El piloto no tiene el rol Piloto o no esta activo',
  'El piloto ya tiene una ruta activa',
  'Debes seleccionar al menos un pedido para la ruta',
  'Todos los pedidos deben estar Pendiente para agregarlos a una ruta',
  'La ruta debe estar Preparada para registrar la salida',
  'La ruta debe estar En Ruta para confirmar entregas',
  'La linea de pedido no pertenece a esta ruta',
  'La ruta debe estar En Ruta para cerrarla',
  'km_llegada debe ser mayor a km_salida',
];

const LOCKED_LINE_MESSAGE = 'La linea ya fue procesada; solo un administrador puede modificarla';

const parseId = (value) => Number.parseInt(value, 10);

const handleRouteError = (error, res, next) => {
  if (error.message === LOCKED_LINE_MESSAGE) {
    return res.status(403).json({ message: error.message });
  }

  if (BUSINESS_RULE_MESSAGES.includes(error.message)) {
    return res.status(400).json({ message: error.message });
  }

  return next(error);
};

const isPilotOwnRoute = (req, route) => String(route.id_piloto) === String(req.auth?.sub);

const getPilotosDisponibles = async (_req, res, next) => {
  try {
    const pilotos = await routeModel.pilotosDisponibles();
    return res.status(200).json(pilotos);
  } catch (error) {
    return next(error);
  }
};

const getRutas = async (req, res, next) => {
  try {
    const routes = await routeModel.findAll();

    if (req.auth?.rol === PILOT_ROLE) {
      return res.status(200).json(routes.filter((route) => String(route.id_piloto) === String(req.auth.sub)));
    }

    return res.status(200).json(routes);
  } catch (error) {
    return next(error);
  }
};

const getRutaById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const route = await routeModel.findById(id);

    if (!route) {
      return res.status(404).json({ message: 'Ruta no encontrada' });
    }

    if (req.auth?.rol === PILOT_ROLE && !isPilotOwnRoute(req, route)) {
      return res.status(403).json({ message: 'No tienes permisos para ver esta ruta' });
    }

    return res.status(200).json(route);
  } catch (error) {
    return next(error);
  }
};

const createRuta = async (req, res, next) => {
  try {
    if (req.auth?.rol === PILOT_ROLE) {
      return res.status(403).json({ message: 'Solo Administrador o Logistica pueden crear rutas' });
    }

    const idVehiculo = parseId(req.body.id_vehiculo);
    const idPiloto = parseId(req.body.id_piloto);
    const idPedidos = Array.isArray(req.body.id_pedidos) ? req.body.id_pedidos.map((id) => parseId(id)) : [];

    if (Number.isNaN(idVehiculo) || idVehiculo <= 0) {
      return res.status(400).json({ message: 'id_vehiculo es obligatorio y debe ser valido' });
    }

    if (Number.isNaN(idPiloto) || idPiloto <= 0) {
      return res.status(400).json({ message: 'id_piloto es obligatorio y debe ser valido' });
    }

    if (idPedidos.length === 0 || idPedidos.some((id) => Number.isNaN(id))) {
      return res.status(400).json({ message: 'id_pedidos debe ser una lista valida de pedidos' });
    }

    const vehicle = await vehicleModel.findById(idVehiculo);

    if (!vehicle) {
      return res.status(404).json({ message: 'Vehiculo no encontrado' });
    }

    const piloto = await userModel.findById(idPiloto);

    if (!piloto) {
      return res.status(404).json({ message: 'Piloto no encontrado' });
    }

    const idUsuarioCreacion = req.auth?.sub;

    if (!idUsuarioCreacion) {
      return res.status(401).json({ message: 'No se pudo identificar el usuario' });
    }

    const route = await routeModel.create({
      id_pedidos: idPedidos,
      id_vehiculo: idVehiculo,
      id_piloto: idPiloto,
      id_usuario_creacion: idUsuarioCreacion,
    });

    return res.status(201).json(route);
  } catch (error) {
    return handleRouteError(error, res, next);
  }
};

const registrarSalida = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const route = await routeModel.findById(id);

    if (!route) {
      return res.status(404).json({ message: 'Ruta no encontrada' });
    }

    if (req.auth?.rol === PILOT_ROLE && !isPilotOwnRoute(req, route)) {
      return res.status(403).json({ message: 'No tienes permisos sobre esta ruta' });
    }

    const kmSalida = Number(req.body.km_salida);

    if (Number.isNaN(kmSalida) || kmSalida < 0) {
      return res.status(400).json({ message: 'km_salida es obligatorio y debe ser numerico' });
    }

    const galones = req.body.galones_combustible;

    if (galones !== undefined && galones !== null && galones !== '' && (Number.isNaN(Number(galones)) || Number(galones) < 0)) {
      return res.status(400).json({ message: 'galones_combustible debe ser numerico y mayor o igual a 0' });
    }

    const updated = await routeModel.registrarSalida(id, {
      km_salida: kmSalida,
      galones_combustible: galones,
      id_usuario_modificacion: req.auth?.sub ?? null,
    });

    return res.status(200).json(updated);
  } catch (error) {
    return handleRouteError(error, res, next);
  }
};

const confirmarEntregas = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const route = await routeModel.findById(id);

    if (!route) {
      return res.status(404).json({ message: 'Ruta no encontrada' });
    }

    if (req.auth?.rol === PILOT_ROLE && !isPilotOwnRoute(req, route)) {
      return res.status(403).json({ message: 'No tienes permisos sobre esta ruta' });
    }

    if (!Array.isArray(req.body.entregas) || req.body.entregas.length === 0) {
      return res.status(400).json({ message: 'entregas debe ser una lista con al menos una linea' });
    }

    for (const entrega of req.body.entregas) {
      const cantidadEntregada = Number(entrega.cantidad_entregada);

      if (Number.isNaN(parseId(entrega.id_detalle))) {
        return res.status(400).json({ message: 'Cada entrega debe tener un id_detalle valido' });
      }

      if (!Number.isFinite(cantidadEntregada) || cantidadEntregada < 0) {
        return res.status(400).json({ message: 'Cada entrega debe tener una cantidad_entregada numerica y no negativa' });
      }
    }

    const updated = await routeModel.confirmarEntregas(id, {
      entregas: req.body.entregas.map((entrega) => ({
        id_detalle: parseId(entrega.id_detalle),
        cantidad_entregada: Number(entrega.cantidad_entregada),
      })),
      id_usuario_modificacion: req.auth?.sub ?? null,
      esAdministrador: req.auth?.rol === ADMIN_ROLE,
    });

    return res.status(200).json(updated);
  } catch (error) {
    return handleRouteError(error, res, next);
  }
};

const cerrarRuta = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const route = await routeModel.findById(id);

    if (!route) {
      return res.status(404).json({ message: 'Ruta no encontrada' });
    }

    if (req.auth?.rol === PILOT_ROLE && !isPilotOwnRoute(req, route)) {
      return res.status(403).json({ message: 'No tienes permisos sobre esta ruta' });
    }

    const kmLlegada = Number(req.body.km_llegada);

    if (Number.isNaN(kmLlegada)) {
      return res.status(400).json({ message: 'km_llegada es obligatorio y debe ser numerico' });
    }

    const updated = await routeModel.cerrar(id, {
      km_llegada: kmLlegada,
      id_usuario_modificacion: req.auth?.sub ?? null,
    });

    return res.status(200).json(updated);
  } catch (error) {
    return handleRouteError(error, res, next);
  }
};

module.exports = {
  getPilotosDisponibles,
  getRutas,
  getRutaById,
  createRuta,
  registrarSalida,
  confirmarEntregas,
  cerrarRuta,
};
