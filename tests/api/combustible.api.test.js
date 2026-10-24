const request = require('supertest');
const { pool, resetDatabase, seedBaseline } = require('../helpers/db');
const { createVehicle, createPilot, createFinishedProductStock } = require('../helpers/fixtures');
const { startTestServer, stopTestServer } = require('../helpers/apiServer');
const { signToken } = require('../helpers/authToken');

let app;
let baseline;
let authHeader;

beforeAll(async () => {
  app = await startTestServer();
});

afterAll(async () => {
  await stopTestServer();
});

beforeEach(async () => {
  await resetDatabase();
  baseline = await seedBaseline();
  authHeader = `Bearer ${signToken({ sub: baseline.idUsuario, rol: 'Administrador' })}`;
});

// Crea un pedido entregable y una ruta para el vehiculo, y la deja En Ruta.
const startRoute = async ({ idVehiculo, idPiloto, kmSalida, nivelSalida, fechaProgramada = '2099-12-31' }) => {
  await createFinishedProductStock({ idProducto: baseline.idProductoTerminado, cantidad: 5 });
  const order = await request(app)
    .post('/api/pedidos')
    .set('Authorization', authHeader)
    .send({
      id_cliente: baseline.idCliente,
      fecha_entrega_programada: fechaProgramada,
      lineas: [{ id_producto: baseline.idProductoTerminado, cantidad: 5 }],
    });
  const route = await request(app)
    .post('/api/rutas')
    .set('Authorization', authHeader)
    .send({ id_pedidos: [order.body.id_pedido], id_vehiculo: idVehiculo, id_piloto: idPiloto });
  const salida = await request(app)
    .put(`/api/rutas/${route.body.id_ruta}/salida`)
    .set('Authorization', authHeader)
    .send({ km_salida: kmSalida, nivel_tanque_salida: nivelSalida });
  await request(app)
    .put(`/api/rutas/${route.body.id_ruta}/entregas`)
    .set('Authorization', authHeader)
    .send({ entregas: [{ id_detalle: order.body.lineas[0].id_detalle, cantidad_entregada: 5 }] });
  return { idRuta: route.body.id_ruta, salida };
};

describe('control de combustible en salida y cierre de ruta', () => {
  it('exige el nivel del tanque al salir y al llegar, en octavos de 0 a 8', async () => {
    const idVehiculo = await createVehicle();
    const idPiloto = await createPilot();
    const { idRuta } = await startRoute({ idVehiculo, idPiloto, kmSalida: 1000, nivelSalida: 8 });

    const sinNivel = await request(app)
      .put(`/api/rutas/${idRuta}/cerrar`)
      .set('Authorization', authHeader)
      .send({ km_llegada: 1100 });
    expect(sinNivel.status).toBe(400);

    const nivelInvalido = await request(app)
      .put(`/api/rutas/${idRuta}/cerrar`)
      .set('Authorization', authHeader)
      .send({ km_llegada: 1100, nivel_tanque_llegada: 9 });
    expect(nivelInvalido.status).toBe(400);
  });

  it('calcula el consumo y el rendimiento al cerrar, y guarda las facturas', async () => {
    const idVehiculo = await createVehicle({ capacidadTanque: 16 });
    const idPiloto = await createPilot();
    const { idRuta } = await startRoute({ idVehiculo, idPiloto, kmSalida: 1000, nivelSalida: 8 });

    // De lleno a 1/4 (6 octavos de 16 gal = 12 gal) mas 4 gal cargados = 16 gal en 160 km
    const cierre = await request(app)
      .put(`/api/rutas/${idRuta}/cerrar`)
      .set('Authorization', authHeader)
      .send({ km_llegada: 1160, nivel_tanque_llegada: 2, cargas: [{ numero_factura: 'A-100', galones: 4, monto: 120 }] });

    expect(cierre.status).toBe(200);
    expect(cierre.body.consumo_galones).toBe(16);
    expect(cierre.body.km_por_galon).toBe(10);
    expect(cierre.body.cargas_combustible).toHaveLength(1);
    expect(cierre.body.alertas_combustible).toEqual([]);
  });

  it('rechaza una factura con mas galones que la capacidad del tanque, sin cerrar la ruta', async () => {
    const idVehiculo = await createVehicle({ capacidadTanque: 16 });
    const idPiloto = await createPilot();
    const { idRuta } = await startRoute({ idVehiculo, idPiloto, kmSalida: 1000, nivelSalida: 8 });

    const response = await request(app)
      .put(`/api/rutas/${idRuta}/cerrar`)
      .set('Authorization', authHeader)
      .send({ km_llegada: 1100, nivel_tanque_llegada: 4, cargas: [{ numero_factura: 'A-1', galones: 20, monto: 600 }] });

    expect(response.status).toBe(400);
    const [routeRows] = await pool.query('SELECT estado FROM rutas_entrega WHERE id_ruta = ?', [idRuta]);
    const [loadRows] = await pool.query('SELECT COUNT(*) AS total FROM cargas_combustible');
    expect(routeRows[0].estado).toBe('En Ruta');
    expect(loadRows[0].total).toBe(0);
  });

  it('notifica cuando el combustible no cuadra entre rutas y dentro de la ruta', async () => {
    const idVehiculo = await createVehicle({ capacidadTanque: 16 });
    const idPiloto = await createPilot();

    const first = await startRoute({ idVehiculo, idPiloto, kmSalida: 1000, nivelSalida: 8 });
    await request(app)
      .put(`/api/rutas/${first.idRuta}/cerrar`)
      .set('Authorization', authHeader)
      .send({ km_llegada: 1100, nivel_tanque_llegada: 2, cargas: [{ numero_factura: 'B-7', galones: 5, monto: 150 }] });

    // Sale con 3/4 cuando llego con 1/4, sin factura: el tanque subio fuera de ruta
    const second = await startRoute({ idVehiculo, idPiloto, kmSalida: 1100, nivelSalida: 6 });
    expect(second.salida.body.alertas_combustible[0]).toMatch(/subio/);

    // Llega con mas de lo que salio y repite la factura B-7
    const cierre = await request(app)
      .put(`/api/rutas/${second.idRuta}/cerrar`)
      .set('Authorization', authHeader)
      .send({ km_llegada: 1150, nivel_tanque_llegada: 8, cargas: [{ numero_factura: 'B-7', galones: 1, monto: 30 }] });

    const alertas = cierre.body.alertas_combustible;
    expect(alertas.some((alerta) => /subio/.test(alerta))).toBe(true);
    expect(alertas.some((alerta) => /no cuadra/.test(alerta))).toBe(true);
    expect(alertas.some((alerta) => /B-7 ya estaba registrada/.test(alerta))).toBe(true);
  });
});

describe('GET /api/rutas/reportes/indicadores', () => {
  it('resume km, consumo, costo y puntualidad de las rutas cerradas', async () => {
    const idVehiculo = await createVehicle({ capacidadTanque: 16 });
    const idPiloto = await createPilot();

    const onTime = await startRoute({ idVehiculo, idPiloto, kmSalida: 1000, nivelSalida: 8, fechaProgramada: '2099-12-31' });
    await request(app)
      .put(`/api/rutas/${onTime.idRuta}/cerrar`)
      .set('Authorization', authHeader)
      .send({ km_llegada: 1160, nivel_tanque_llegada: 2, cargas: [{ numero_factura: 'C-1', galones: 4, monto: 120 }] });

    const late = await startRoute({ idVehiculo, idPiloto, kmSalida: 1160, nivelSalida: 2, fechaProgramada: '2020-01-01' });
    await request(app)
      .put(`/api/rutas/${late.idRuta}/cerrar`)
      .set('Authorization', authHeader)
      .send({ km_llegada: 1200, nivel_tanque_llegada: 0 });

    const response = await request(app).get('/api/rutas/reportes/indicadores').set('Authorization', authHeader);

    expect(response.status).toBe(200);
    const { resumen } = response.body;
    expect(resumen.rutas).toBe(2);
    expect(resumen.km_recorridos).toBe(200);
    expect(resumen.consumo_galones).toBe(20); // 16 + 4 gal
    expect(resumen.km_por_galon).toBe(10);
    expect(resumen.combustible_facturado_q).toBe(120);
    expect(resumen.costo_combustible_q).toBe(600); // 20 gal x 30 Q (la 2.a ruta usa el precio de C-1)
    expect(resumen.costo_estimado).toBe(true);
    expect(resumen.porcentaje_puntualidad).toBe(50);
    expect(resumen.porcentaje_sin_devolucion).toBe(100);
    expect(response.body.por_vehiculo).toHaveLength(1);
  });

  it('solo lo ven Administrador y Logistica, y valida los filtros', async () => {
    const piloto = signToken({ sub: baseline.idUsuario, rol: 'Piloto' });
    const logistica = signToken({ sub: baseline.idUsuario, rol: 'Logistica' });

    const pilotResponse = await request(app).get('/api/rutas/reportes/indicadores').set('Authorization', `Bearer ${piloto}`);
    expect(pilotResponse.status).toBe(403);

    const logisticsResponse = await request(app).get('/api/rutas/reportes/indicadores').set('Authorization', `Bearer ${logistica}`);
    expect(logisticsResponse.status).toBe(200);

    const invalidRange = await request(app)
      .get('/api/rutas/reportes/indicadores?desde=2026-10-31&hasta=2026-10-01')
      .set('Authorization', authHeader);
    expect(invalidRange.status).toBe(400);
  });
});

describe('datos que alimentan los indicadores', () => {
  it('la fecha de entrega programada es obligatoria al crear un pedido', async () => {
    await createFinishedProductStock({ idProducto: baseline.idProductoTerminado, cantidad: 5 });
    const response = await request(app)
      .post('/api/pedidos')
      .set('Authorization', authHeader)
      .send({ id_cliente: baseline.idCliente, lineas: [{ id_producto: baseline.idProductoTerminado, cantidad: 1 }] });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/obligatoria/);
  });

  it('registra y valida la capacidad del tanque del vehiculo', async () => {
    const idVehiculo = await createVehicle({ capacidadTanque: null });

    const invalid = await request(app)
      .put(`/api/vehiculos/${idVehiculo}`)
      .set('Authorization', authHeader)
      .send({ placa: 'TST-CAP', estado: 'Disponible', capacidad_tanque_galones: 0 });
    expect(invalid.status).toBe(400);

    const valid = await request(app)
      .put(`/api/vehiculos/${idVehiculo}`)
      .set('Authorization', authHeader)
      .send({ placa: 'TST-CAP', estado: 'Disponible', capacidad_tanque_galones: 18.5 });
    expect(valid.status).toBe(200);
    expect(Number(valid.body.capacidad_tanque_galones)).toBe(18.5);
  });
});
