const { routeConsumption, departureAlerts, closingAlerts, isMeasurable } = require('../../src/workers/shared/fuel');
const { buildIndicators } = require('../../src/workers/shared/logistics');

describe('consumo de combustible de una ruta', () => {
  it('calcula el consumo con la diferencia de niveles y lo cargado', () => {
    // Tanque de 16 gal: de lleno (8/8) a 1/2 (4/8) son 8 gal; mas 5 gal cargados = 13 gal.
    expect(routeConsumption({ nivelSalida: 8, nivelLlegada: 4, capacidad: 16 })).toBe(8);
    expect(routeConsumption({ nivelSalida: 8, nivelLlegada: 4, capacidad: 16, galonesCargados: 5 })).toBe(13);
  });

  it('devuelve null si falta la capacidad del tanque o algun nivel', () => {
    expect(routeConsumption({ nivelSalida: 8, nivelLlegada: 4, capacidad: null })).toBeNull();
    expect(routeConsumption({ nivelSalida: null, nivelLlegada: 4, capacidad: 16 })).toBeNull();
  });

  it('solo considera medible un consumo de al menos dos octavos de tanque', () => {
    expect(isMeasurable(4, 16)).toBe(true);
    expect(isMeasurable(2, 16)).toBe(false);
  });
});

describe('alertas de combustible', () => {
  it('avisa al salir si el vehiculo no tiene capacidad registrada', () => {
    expect(departureAlerts({ capacidad: null, nivelSalida: 8, nivelLlegadaAnterior: null })).toHaveLength(1);
  });

  it('avisa al salir si el tanque cambio desde la ultima ruta mas de un octavo', () => {
    expect(departureAlerts({ capacidad: 16, nivelSalida: 6, nivelLlegadaAnterior: 2 })[0]).toMatch(/subio de 1\/4 a 3\/4/);
    expect(departureAlerts({ capacidad: 16, nivelSalida: 2, nivelLlegadaAnterior: 6 })[0]).toMatch(/bajo/);
    expect(departureAlerts({ capacidad: 16, nivelSalida: 8, nivelLlegadaAnterior: 4 })[0]).toMatch(/subio de 1\/2 a lleno/);
    expect(departureAlerts({ capacidad: 16, nivelSalida: 5, nivelLlegadaAnterior: 4 })).toEqual([]);
  });

  it('avisa al cerrar si el combustible no cuadra', () => {
    const alerts = closingAlerts({ consumo: -4, capacidad: 16, km: 50, promedioKmPorGalon: null, rutasPrevias: 0 });
    expect(alerts[0]).toMatch(/no cuadra/);
  });

  it('avisa si el rendimiento se aleja mas de 50 % del promedio del vehiculo', () => {
    // 100 km con 4 gal = 25 km/gal contra un promedio de 10 km/gal
    expect(closingAlerts({ consumo: 4, capacidad: 16, km: 100, promedioKmPorGalon: 10, rutasPrevias: 3 })[0]).toMatch(/rendimiento/);
    expect(closingAlerts({ consumo: 4, capacidad: 16, km: 100, promedioKmPorGalon: 22, rutasPrevias: 3 })).toEqual([]);
    // Sin historial suficiente no se compara
    expect(closingAlerts({ consumo: 4, capacidad: 16, km: 100, promedioKmPorGalon: 10, rutasPrevias: 2 })).toEqual([]);
  });

  it('avisa si una factura ya estaba registrada en otra ruta', () => {
    const alerts = closingAlerts({
      consumo: 8,
      capacidad: 16,
      km: 100,
      promedioKmPorGalon: null,
      rutasPrevias: 0,
      facturasRepetidas: [{ numero_factura: 'F-1', id_ruta: 3 }],
    });
    expect(alerts).toEqual(['La factura F-1 ya estaba registrada en la ruta #3.']);
  });
});

describe('indicadores de logistica', () => {
  const route = (overrides) => ({
    id_vehiculo: 1,
    placa: 'P-1',
    piloto: 'Piloto',
    capacidad_tanque_galones: 16,
    nivel_tanque_salida: 8,
    nivel_tanque_llegada: 4,
    alertas_combustible: null,
    fecha_salida: '2026-10-05T08:00:00',
    fecha_llegada: '2026-10-05T12:00:00',
    mes_llegada: '2026-10',
    ...overrides,
  });

  it('calcula rendimiento, costo, duracion, puntualidad y entregas sin devolucion', () => {
    const routes = [
      // 120 km con 8 gal; sin factura propia: usa el precio de la factura anterior (costo estimado)
      route({ id_ruta: 1, km_salida: 1000, km_llegada: 1120 }),
      // 60 km; (6 - 2)/8 x 16 = 8 gal + 10 gal cargados = 18 gal; precio 30 Q/gal
      route({
        id_ruta: 2,
        km_salida: 1120,
        km_llegada: 1180,
        nivel_tanque_salida: 6,
        nivel_tanque_llegada: 2,
        fecha_salida: '2026-10-06T08:00:00',
        fecha_llegada: '2026-10-06T10:00:00',
        alertas_combustible: '["aviso"]',
      }),
    ];
    const loads = [
      { id_ruta: 99, galones: 10, monto: 250, fecha_creacion: '2026-10-01T09:00:00' },
      { id_ruta: 2, galones: 10, monto: 300, fecha_creacion: '2026-10-06T09:00:00' },
    ];
    const orders = [
      { id_ruta: 1, estado: 'Entregado', fecha_entrega_programada: '2026-10-05', fecha_entrega_dia: '2026-10-05' },
      { id_ruta: 1, estado: 'Con Devolucion', fecha_entrega_programada: '2026-10-04', fecha_entrega_dia: '2026-10-05' },
      { id_ruta: 2, estado: 'Entregado', fecha_entrega_programada: null, fecha_entrega_dia: '2026-10-06' },
    ];

    const { resumen, por_mes, por_vehiculo, rutas } = buildIndicators(routes, loads, orders);

    expect(resumen.km_recorridos).toBe(180);
    expect(resumen.consumo_galones).toBe(26);
    expect(resumen.km_por_galon).toBe(6.92); // 180 / 26
    expect(resumen.combustible_facturado_q).toBe(300);
    expect(rutas[0].costo).toBe(200); // 8 gal x 25 Q (precio de la factura anterior)
    expect(rutas[0].costo_estimado).toBe(true);
    expect(rutas[1].costo).toBe(540); // 18 gal x 30 Q
    expect(resumen.costo_combustible_q).toBe(740);
    expect(resumen.costo_por_km_q).toBe(4.11);
    expect(resumen.horas_promedio_ruta).toBe(3);
    expect(resumen.porcentaje_sin_devolucion).toBe(66.7);
    expect(resumen.pedidos_con_fecha_programada).toBe(2);
    expect(resumen.porcentaje_puntualidad).toBe(50);
    expect(resumen.pedidos_sin_fecha_programada).toBe(1);
    expect(resumen.rutas_con_alertas).toBe(1);
    expect(por_mes).toHaveLength(1);
    expect(por_vehiculo[0].placa).toBe('P-1');
  });

  it('no usa en los promedios una ruta cuyo combustible no cuadra', () => {
    const routes = [route({ id_ruta: 1, km_salida: 0, km_llegada: 50, nivel_tanque_salida: 2, nivel_tanque_llegada: 8 })];
    const { resumen } = buildIndicators(routes, [], []);
    expect(resumen.rutas_con_consumo).toBe(0);
    expect(resumen.km_por_galon).toBeNull();
  });
});
