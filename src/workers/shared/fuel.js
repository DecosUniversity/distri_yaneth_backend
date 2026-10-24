// Calculo de combustible por ruta. El nivel del tanque se registra en octavos (0 = vacio,
// 8 = lleno), como lo marca el indicador del vehiculo, y el consumo de una ruta es:
//   (nivel al salir - nivel al llegar) x capacidad del tanque + galones cargados en la ruta.
const TANK_EIGHTHS = 8;
// El indicador solo distingue octavos: diferencias de un octavo se consideran ruido de lectura.
const GAUGE_TOLERANCE_EIGHTHS = 1;
// Por debajo de dos octavos de consumo la ruta es demasiado corta para juzgar su rendimiento.
const MIN_MEASURABLE_EIGHTHS = 2;
const MIN_ROUTES_FOR_AVERAGE = 3;
const EFFICIENCY_DEVIATION = 0.5;

const toNumberOrNull = (value) => (value === null || value === undefined || value === '' ? null : Number(value));

const TANK_LEVEL_LABELS = ['vacio', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8', 'lleno'];
const formatEighths = (level) => TANK_LEVEL_LABELS[level] ?? `${level}/8`;

const round = (value, decimals = 2) => (value === null ? null : Number(value.toFixed(decimals)));

// Galones consumidos en la ruta, o null si falta algun dato para calcularlo.
const routeConsumption = ({ nivelSalida, nivelLlegada, capacidad, galonesCargados = 0 }) => {
  const salida = toNumberOrNull(nivelSalida);
  const llegada = toNumberOrNull(nivelLlegada);
  const tank = toNumberOrNull(capacidad);

  if (salida === null || llegada === null || tank === null || tank <= 0) {
    return null;
  }

  return ((salida - llegada) / TANK_EIGHTHS) * tank + Number(galonesCargados || 0);
};

const isMeasurable = (consumo, capacidad) =>
  consumo !== null && Number(capacidad) > 0 && consumo >= (MIN_MEASURABLE_EIGHTHS / TANK_EIGHTHS) * Number(capacidad);

// Alertas al registrar la salida: falta la capacidad del tanque, o el nivel no coincide con
// el de la llegada anterior del mismo vehiculo (cargas o consumos fuera de ruta).
const departureAlerts = ({ capacidad, nivelSalida, nivelLlegadaAnterior }) => {
  const alerts = [];

  if (!(Number(capacidad) > 0)) {
    alerts.push('El vehiculo no tiene registrada la capacidad del tanque; no se podra calcular el consumo de esta ruta.');
  }

  if (nivelSalida !== null && nivelLlegadaAnterior !== null && nivelLlegadaAnterior !== undefined) {
    const diff = Number(nivelSalida) - Number(nivelLlegadaAnterior);

    if (diff > GAUGE_TOLERANCE_EIGHTHS) {
      alerts.push(
        `El tanque subio de ${formatEighths(Number(nivelLlegadaAnterior))} a ${formatEighths(Number(nivelSalida))} desde la ultima ruta sin una factura registrada.`
      );
    } else if (diff < -GAUGE_TOLERANCE_EIGHTHS) {
      alerts.push(
        `El tanque bajo de ${formatEighths(Number(nivelLlegadaAnterior))} a ${formatEighths(Number(nivelSalida))} desde la ultima ruta, fuera de una ruta registrada.`
      );
    }
  }

  return alerts;
};

// Alertas al cerrar la ruta: el combustible no cuadra, el rendimiento se aleja del promedio
// del vehiculo o una factura ya habia sido registrada en otra ruta.
const closingAlerts = ({ consumo, capacidad, km, promedioKmPorGalon, rutasPrevias, facturasRepetidas = [] }) => {
  const alerts = [];
  const tank = Number(capacidad);

  if (consumo !== null && tank > 0 && consumo < -(GAUGE_TOLERANCE_EIGHTHS / TANK_EIGHTHS) * tank) {
    alerts.push(
      'El combustible no cuadra: el tanque llego con mas combustible del que salio mas lo cargado. Revise el nivel registrado o si falta una factura.'
    );
  }

  if (isMeasurable(consumo, capacidad) && promedioKmPorGalon && rutasPrevias >= MIN_ROUTES_FOR_AVERAGE) {
    const rendimiento = km / consumo;
    const desviacion = Math.abs(rendimiento - promedioKmPorGalon) / promedioKmPorGalon;

    if (desviacion > EFFICIENCY_DEVIATION) {
      alerts.push(
        `El rendimiento de esta ruta (${round(rendimiento, 1)} km/gal) se aleja mas de ${EFFICIENCY_DEVIATION * 100} % del promedio del vehiculo (${round(promedioKmPorGalon, 1)} km/gal).`
      );
    }
  }

  for (const { numero_factura, id_ruta } of facturasRepetidas) {
    alerts.push(`La factura ${numero_factura} ya estaba registrada en la ruta #${id_ruta}.`);
  }

  return alerts;
};

const parseAlerts = (value) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

module.exports = {
  TANK_EIGHTHS,
  routeConsumption,
  isMeasurable,
  departureAlerts,
  closingAlerts,
  parseAlerts,
  round,
};
