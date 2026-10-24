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
  'Los galones de una factura no pueden superar la capacidad del tanque del vehiculo',
];

const LOCKED_LINE_MESSAGE = 'La linea ya fue procesada; solo un administrador puede modificarla';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TANK_EIGHTHS = 8;
const MAX_FUEL_LOADS = 10;

const parseId = (value) => Number.parseInt(value, 10);

// Nivel del tanque en octavos: entero de 0 (vacio) a 8 (lleno).
const parseTankLevel = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const level = Number(value);
  return Number.isInteger(level) && level >= 0 && level <= TANK_EIGHTHS ? level : null;
};

const validateFuelLoads = (cargas) => {
  if (cargas === undefined || cargas === null) return null;

  if (!Array.isArray(cargas)) return 'cargas debe ser una lista de facturas de combustible';

  if (cargas.length > MAX_FUEL_LOADS) return `No se pueden registrar mas de ${MAX_FUEL_LOADS} facturas por ruta`;

  for (const carga of cargas) {
    const factura = String(carga?.numero_factura ?? '').trim();

    if (!factura || factura.length > 40) {
      return 'Cada factura debe tener un numero_factura de hasta 40 caracteres';
    }

    if (!(Number(carga.galones) > 0)) {
      return 'Los galones de cada factura deben ser mayores a 0';
    }

    if (!(Number(carga.monto) > 0)) {
      return 'El monto de cada factura debe ser mayor a 0';
    }
  }

  return null;
};

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

    const nivelTanque = parseTankLevel(req.body.nivel_tanque_salida);

    if (nivelTanque === null) {
      return res.status(400).json({ message: 'nivel_tanque_salida es obligatorio y debe ser un octavo de tanque entre 0 y 8' });
    }

    const updated = await routeModel.registrarSalida(id, {
      km_salida: kmSalida,
      nivel_tanque_salida: nivelTanque,
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

    const nivelTanque = parseTankLevel(req.body.nivel_tanque_llegada);

    if (nivelTanque === null) {
      return res.status(400).json({ message: 'nivel_tanque_llegada es obligatorio y debe ser un octavo de tanque entre 0 y 8' });
    }

    const fuelLoadsError = validateFuelLoads(req.body.cargas);

    if (fuelLoadsError) {
      return res.status(400).json({ message: fuelLoadsError });
    }

    const updated = await routeModel.cerrar(id, {
      km_llegada: kmLlegada,
      nivel_tanque_llegada: nivelTanque,
      cargas: (req.body.cargas || []).map((carga) => ({
        numero_factura: String(carga.numero_factura).trim(),
        galones: Number(carga.galones),
        monto: Number(carga.monto),
      })),
      id_usuario_modificacion: req.auth?.sub ?? null,
    });

    return res.status(200).json(updated);
  } catch (error) {
    return handleRouteError(error, res, next);
  }
};

const getIndicadores = async (req, res, next) => {
  try {
    if (req.auth?.rol === PILOT_ROLE) {
      return res.status(403).json({ message: 'Solo Administrador o Logistica pueden ver los indicadores' });
    }

    const { desde, hasta, id_vehiculo } = req.query;

    if (desde && !DATE_PATTERN.test(desde)) {
      return res.status(400).json({ message: 'desde debe tener formato YYYY-MM-DD' });
    }

    if (hasta && !DATE_PATTERN.test(hasta)) {
      return res.status(400).json({ message: 'hasta debe tener formato YYYY-MM-DD' });
    }

    if (desde && hasta && desde > hasta) {
      return res.status(400).json({ message: 'La fecha "desde" no puede ser posterior a "hasta"' });
    }

    const idVehiculo = id_vehiculo ? parseId(id_vehiculo) : null;

    if (id_vehiculo && (Number.isNaN(idVehiculo) || idVehiculo <= 0)) {
      return res.status(400).json({ message: 'id_vehiculo debe ser valido' });
    }

    const indicadores = await routeModel.indicadores({
      desde: desde || null,
      hasta: hasta || null,
      id_vehiculo: idVehiculo,
    });

    return res.status(200).json(indicadores);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getIndicadores,
  getPilotosDisponibles,
  getRutas,
  getRutaById,
  createRuta,
  registrarSalida,
  confirmarEntregas,
  cerrarRuta,
};
