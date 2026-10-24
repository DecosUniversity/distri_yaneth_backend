// Indicadores de logistica a partir de las rutas cerradas: rendimiento de combustible, costo,
// duracion de las rutas, puntualidad y entregas sin devolucion.
const { routeConsumption, parseAlerts, round } = require('./fuel');

const ORDER_DELIVERED_STATE = 'Entregado';

const percentage = (part, total) => (total > 0 ? round((part / total) * 100, 1) : null);

// Precio por galon de la ruta: el de sus propias facturas o, si no tiene, el de la ultima
// factura registrada antes de su cierre (entonces el costo es estimado).
const fuelPrice = (route, loadsByRoute, allLoads) => {
  const own = loadsByRoute.get(route.id_ruta) || [];
  const galones = own.reduce((total, load) => total + Number(load.galones), 0);

  if (galones > 0) {
    return { precio: own.reduce((total, load) => total + Number(load.monto), 0) / galones, estimado: false };
  }

  const closedAt = new Date(route.fecha_llegada).getTime();
  const previous = allLoads.filter((load) => new Date(load.fecha_creacion).getTime() <= closedAt && Number(load.galones) > 0);
  const last = previous[previous.length - 1];

  return last ? { precio: Number(last.monto) / Number(last.galones), estimado: true } : { precio: null, estimado: false };
};

// Datos calculados de cada ruta. `allLoads` debe venir ordenado por fecha de registro.
const enrichRoutes = (routes, allLoads, orders) => {
  const loadsByRoute = new Map();
  for (const load of allLoads) {
    if (!loadsByRoute.has(load.id_ruta)) loadsByRoute.set(load.id_ruta, []);
    loadsByRoute.get(load.id_ruta).push(load);
  }

  const ordersByRoute = new Map();
  for (const order of orders) {
    if (!ordersByRoute.has(order.id_ruta)) ordersByRoute.set(order.id_ruta, []);
    ordersByRoute.get(order.id_ruta).push(order);
  }

  return routes.map((route) => {
    const own = loadsByRoute.get(route.id_ruta) || [];
    const galonesFacturados = own.reduce((total, load) => total + Number(load.galones), 0);
    const montoFacturado = own.reduce((total, load) => total + Number(load.monto), 0);
    const km = Number(route.km_llegada) - Number(route.km_salida);
    const consumo = routeConsumption({
      nivelSalida: route.nivel_tanque_salida,
      nivelLlegada: route.nivel_tanque_llegada,
      capacidad: route.capacidad_tanque_galones,
      galonesCargados: galonesFacturados,
    });
    // Un consumo negativo no cuadra (ya genero una alerta) y no se usa en los promedios.
    const consumoValido = consumo !== null && consumo > 0 ? consumo : null;
    const { precio, estimado } = fuelPrice(route, loadsByRoute, allLoads);
    const routeOrders = ordersByRoute.get(route.id_ruta) || [];
    const conFecha = routeOrders.filter((order) => order.fecha_entrega_programada);

    return {
      id_ruta: route.id_ruta,
      id_vehiculo: route.id_vehiculo,
      placa: route.placa,
      piloto: route.piloto,
      fecha_llegada: route.fecha_llegada,
      mes: String(route.mes_llegada),
      km,
      horas: route.fecha_salida && route.fecha_llegada
        ? (new Date(route.fecha_llegada).getTime() - new Date(route.fecha_salida).getTime()) / 3600000
        : null,
      consumo: consumoValido,
      km_por_galon: consumoValido ? km / consumoValido : null,
      costo: consumoValido !== null && precio !== null ? consumoValido * precio : null,
      costo_estimado: consumoValido !== null && precio !== null && estimado,
      galones_facturados: galonesFacturados,
      monto_facturado: montoFacturado,
      pedidos: routeOrders.length,
      pedidos_sin_devolucion: routeOrders.filter((order) => order.estado === ORDER_DELIVERED_STATE).length,
      pedidos_con_fecha: conFecha.length,
      pedidos_a_tiempo: conFecha.filter((order) => order.fecha_entrega_dia && order.fecha_entrega_dia <= order.fecha_entrega_programada).length,
      alertas: parseAlerts(route.alertas_combustible),
    };
  });
};

const sum = (list, key) => list.reduce((total, item) => total + Number(item[key] || 0), 0);

const summarize = (list) => {
  const conConsumo = list.filter((route) => route.consumo !== null);
  const conCosto = list.filter((route) => route.costo !== null);
  const conHoras = list.filter((route) => route.horas !== null);
  const consumoTotal = sum(conConsumo, 'consumo');
  const kmConConsumo = sum(conConsumo, 'km');
  const costoTotal = sum(conCosto, 'costo');
  const kmConCosto = sum(conCosto, 'km');
  const pedidos = sum(list, 'pedidos');
  const pedidosConFecha = sum(list, 'pedidos_con_fecha');

  return {
    rutas: list.length,
    km_recorridos: round(sum(list, 'km')),
    horas_promedio_ruta: conHoras.length ? round(sum(conHoras, 'horas') / conHoras.length) : null,
    rutas_con_consumo: conConsumo.length,
    consumo_galones: round(consumoTotal),
    km_por_galon: consumoTotal > 0 ? round(kmConConsumo / consumoTotal) : null,
    galones_facturados: round(sum(list, 'galones_facturados')),
    combustible_facturado_q: round(sum(list, 'monto_facturado')),
    costo_combustible_q: conCosto.length ? round(costoTotal) : null,
    costo_por_km_q: kmConCosto > 0 ? round(costoTotal / kmConCosto) : null,
    costo_estimado: list.some((route) => route.costo_estimado),
    pedidos,
    pedidos_sin_devolucion: sum(list, 'pedidos_sin_devolucion'),
    porcentaje_sin_devolucion: percentage(sum(list, 'pedidos_sin_devolucion'), pedidos),
    pedidos_con_fecha_programada: pedidosConFecha,
    pedidos_a_tiempo: sum(list, 'pedidos_a_tiempo'),
    porcentaje_puntualidad: percentage(sum(list, 'pedidos_a_tiempo'), pedidosConFecha),
    pedidos_sin_fecha_programada: pedidos - pedidosConFecha,
    rutas_con_alertas: list.filter((route) => route.alertas.length > 0).length,
  };
};

const groupBy = (list, keyOf) => {
  const groups = new Map();
  for (const item of list) {
    const key = keyOf(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
};

const buildIndicators = (routes, allLoads, orders) => {
  const enriched = enrichRoutes(routes, allLoads, orders);

  return {
    resumen: summarize(enriched),
    por_mes: [...groupBy(enriched, (route) => route.mes)].map(([mes, list]) => ({ mes, ...summarize(list) })),
    por_vehiculo: [...groupBy(enriched, (route) => route.id_vehiculo)].map(([idVehiculo, list]) => ({
      id_vehiculo: idVehiculo,
      placa: list[0].placa,
      ...summarize(list),
    })),
    rutas: enriched.map((route) => ({
      ...route,
      horas: round(route.horas),
      consumo: round(route.consumo),
      km_por_galon: round(route.km_por_galon),
      costo: round(route.costo),
    })),
  };
};

module.exports = {
  buildIndicators,
};
