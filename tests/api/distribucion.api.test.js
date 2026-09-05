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

describe('flujo completo por HTTP: pedido -> ruta -> salida -> entregas -> cierre', () => {
  it('crea un pedido, arma la ruta, la despacha y la cierra con entrega completa', async () => {
    const idVehiculo = await createVehicle();
    const idPiloto = await createPilot();
    await createFinishedProductStock({ idProducto: baseline.idProductoTerminado, cantidad: 20 });

    const orderResponse = await request(app)
      .post('/api/pedidos')
      .set('Authorization', authHeader)
      .send({
        id_cliente: baseline.idCliente,
        lineas: [{ id_producto: baseline.idProductoTerminado, cantidad: 8 }],
      });

    expect(orderResponse.status).toBe(201);
    const idPedido = orderResponse.body.id_pedido;
    const idDetalle = orderResponse.body.lineas[0].id_detalle;

    const routeResponse = await request(app)
      .post('/api/rutas')
      .set('Authorization', authHeader)
      .send({ id_pedidos: [idPedido], id_vehiculo: idVehiculo, id_piloto: idPiloto });

    expect(routeResponse.status).toBe(201);
    const idRuta = routeResponse.body.id_ruta;

    const salidaResponse = await request(app)
      .put(`/api/rutas/${idRuta}/salida`)
      .set('Authorization', authHeader)
      .send({ km_salida: 1000 });

    expect(salidaResponse.status).toBe(200);
    expect(salidaResponse.body.estado).toBe('En Ruta');

    const entregasResponse = await request(app)
      .put(`/api/rutas/${idRuta}/entregas`)
      .set('Authorization', authHeader)
      .send({ entregas: [{ id_detalle: idDetalle, cantidad_entregada: 8 }] });

    expect(entregasResponse.status).toBe(200);

    const cierreResponse = await request(app)
      .put(`/api/rutas/${idRuta}/cerrar`)
      .set('Authorization', authHeader)
      .send({ km_llegada: 1050 });

    expect(cierreResponse.status).toBe(200);
    expect(cierreResponse.body.estado).toBe('Cerrada');

    const [orderRows] = await pool.query('SELECT estado FROM pedidos WHERE id_pedido = ?', [idPedido]);
    expect(orderRows[0].estado).toBe('Entregado');

    const [vehicleRows] = await pool.query('SELECT estado FROM vehiculos WHERE id_vehiculo = ?', [idVehiculo]);
    expect(vehicleRows[0].estado).toBe('Disponible');
  });

  it('con entrega parcial, la devolucion se puede recibir y resolver como Reingresado', async () => {
    const idVehiculo = await createVehicle();
    const idPiloto = await createPilot();
    await createFinishedProductStock({ idProducto: baseline.idProductoTerminado, cantidad: 20 });

    const orderResponse = await request(app)
      .post('/api/pedidos')
      .set('Authorization', authHeader)
      .send({
        id_cliente: baseline.idCliente,
        lineas: [{ id_producto: baseline.idProductoTerminado, cantidad: 6 }],
      });
    const idPedido = orderResponse.body.id_pedido;
    const idDetalle = orderResponse.body.lineas[0].id_detalle;

    const routeResponse = await request(app)
      .post('/api/rutas')
      .set('Authorization', authHeader)
      .send({ id_pedidos: [idPedido], id_vehiculo: idVehiculo, id_piloto: idPiloto });
    const idRuta = routeResponse.body.id_ruta;

    await request(app).put(`/api/rutas/${idRuta}/salida`).set('Authorization', authHeader).send({ km_salida: 200 });
    await request(app)
      .put(`/api/rutas/${idRuta}/entregas`)
      .set('Authorization', authHeader)
      .send({ entregas: [{ id_detalle: idDetalle, cantidad_entregada: 0 }] });
    await request(app).put(`/api/rutas/${idRuta}/cerrar`).set('Authorization', authHeader).send({ km_llegada: 230 });

    const [orderRows] = await pool.query('SELECT estado FROM pedidos WHERE id_pedido = ?', [idPedido]);
    expect(orderRows[0].estado).toBe('Con Devolucion');

    const returnResponse = await request(app)
      .post('/api/devoluciones')
      .set('Authorization', authHeader)
      .send({ id_detalle: idDetalle, cantidad_devuelta: 6, motivo: 'Cliente no recibio' });

    expect(returnResponse.status).toBe(201);

    const resolveResponse = await request(app)
      .put(`/api/devoluciones/${returnResponse.body.id_devolucion}/resolver`)
      .set('Authorization', authHeader)
      .send({ resolucion: 'Reingresado a inventario' });

    expect(resolveResponse.status).toBe(200);
    expect(resolveResponse.body.resolucion).toBe('Reingresado a inventario');
  });
});

describe('fecha_entrega_programada de un pedido', () => {
  it('se puede asignar al crear el pedido y cambiar despues via PUT', async () => {
    await createFinishedProductStock({ idProducto: baseline.idProductoTerminado, cantidad: 10 });

    const createResponse = await request(app)
      .post('/api/pedidos')
      .set('Authorization', authHeader)
      .send({
        id_cliente: baseline.idCliente,
        fecha_entrega_programada: '2026-09-10',
        lineas: [{ id_producto: baseline.idProductoTerminado, cantidad: 2 }],
      });

    expect(createResponse.status).toBe(201);
    expect(new Date(createResponse.body.fecha_entrega_programada).toISOString().slice(0, 10)).toBe('2026-09-10');

    const updateResponse = await request(app)
      .put(`/api/pedidos/${createResponse.body.id_pedido}/fecha-entrega`)
      .set('Authorization', authHeader)
      .send({ fecha_entrega_programada: '2026-09-20' });

    expect(updateResponse.status).toBe(200);
    expect(new Date(updateResponse.body.fecha_entrega_programada).toISOString().slice(0, 10)).toBe('2026-09-20');
  });

  it('rechaza un formato de fecha invalido al crear o actualizar', async () => {
    await createFinishedProductStock({ idProducto: baseline.idProductoTerminado, cantidad: 10 });

    const createResponse = await request(app)
      .post('/api/pedidos')
      .set('Authorization', authHeader)
      .send({
        id_cliente: baseline.idCliente,
        fecha_entrega_programada: '10-09-2026',
        lineas: [{ id_producto: baseline.idProductoTerminado, cantidad: 2 }],
      });

    expect(createResponse.status).toBe(400);

    const okOrder = await request(app)
      .post('/api/pedidos')
      .set('Authorization', authHeader)
      .send({
        id_cliente: baseline.idCliente,
        lineas: [{ id_producto: baseline.idProductoTerminado, cantidad: 2 }],
      });

    const updateResponse = await request(app)
      .put(`/api/pedidos/${okOrder.body.id_pedido}/fecha-entrega`)
      .set('Authorization', authHeader)
      .send({ fecha_entrega_programada: '10-09-2026' });

    expect(updateResponse.status).toBe(400);
  });
});

describe('GET /api/pedidos/reportes/pedidos-del-dia', () => {
  it('refleja un pedido recien creado como pendiente del dia', async () => {
    await createFinishedProductStock({ idProducto: baseline.idProductoTerminado, cantidad: 10 });
    await request(app)
      .post('/api/pedidos')
      .set('Authorization', authHeader)
      .send({
        id_cliente: baseline.idCliente,
        lineas: [{ id_producto: baseline.idProductoTerminado, cantidad: 2 }],
      });

    const response = await request(app)
      .get('/api/pedidos/reportes/pedidos-del-dia')
      .set('Authorization', authHeader);

    expect(response.status).toBe(200);
    expect(response.body.pendientes).toBeGreaterThanOrEqual(1);
  });

  it('rechaza una fecha con formato invalido', async () => {
    const response = await request(app)
      .get('/api/pedidos/reportes/pedidos-del-dia?fecha=03-09-2026')
      .set('Authorization', authHeader);

    expect(response.status).toBe(400);
  });
});

describe('devoluciones: deteccion automatica y control de roles', () => {
  it('una linea Rechazada aparece en pendientes-recepcion sin esperar a cerrar la ruta', async () => {
    const idVehiculo = await createVehicle();
    const idPiloto = await createPilot();
    await createFinishedProductStock({ idProducto: baseline.idProductoTerminado, cantidad: 10 });

    const orderResponse = await request(app)
      .post('/api/pedidos')
      .set('Authorization', authHeader)
      .send({
        id_cliente: baseline.idCliente,
        lineas: [{ id_producto: baseline.idProductoTerminado, cantidad: 4 }],
      });
    const idDetalle = orderResponse.body.lineas[0].id_detalle;

    const routeResponse = await request(app)
      .post('/api/rutas')
      .set('Authorization', authHeader)
      .send({ id_pedidos: [orderResponse.body.id_pedido], id_vehiculo: idVehiculo, id_piloto: idPiloto });
    const idRuta = routeResponse.body.id_ruta;

    await request(app).put(`/api/rutas/${idRuta}/salida`).set('Authorization', authHeader).send({ km_salida: 10 });

    const entregasResponse = await request(app)
      .put(`/api/rutas/${idRuta}/entregas`)
      .set('Authorization', authHeader)
      .send({ entregas: [{ id_detalle: idDetalle, cantidad_entregada: 0 }] });

    expect(entregasResponse.status).toBe(200);

    // La ruta sigue En Ruta (no se ha cerrado); la linea Rechazada debe verse igual.
    const pendingResponse = await request(app)
      .get('/api/devoluciones/pendientes-recepcion')
      .set('Authorization', authHeader);

    expect(pendingResponse.status).toBe(200);
    const pendingLine = pendingResponse.body.find((line) => line.id_detalle === idDetalle);
    expect(pendingLine).toBeDefined();
    expect(pendingLine.id_piloto).toBe(idPiloto);
    expect(pendingLine.piloto_nombre).toBe('Piloto de Pruebas');
  });

  it('un piloto no puede recibir ni resolver una devolucion; logistica recibe y produccion resuelve', async () => {
    const idVehiculo = await createVehicle();
    const idPiloto = await createPilot();
    await createFinishedProductStock({ idProducto: baseline.idProductoTerminado, cantidad: 10 });

    const orderResponse = await request(app)
      .post('/api/pedidos')
      .set('Authorization', authHeader)
      .send({
        id_cliente: baseline.idCliente,
        lineas: [{ id_producto: baseline.idProductoTerminado, cantidad: 3 }],
      });
    const idDetalle = orderResponse.body.lineas[0].id_detalle;

    const routeResponse = await request(app)
      .post('/api/rutas')
      .set('Authorization', authHeader)
      .send({ id_pedidos: [orderResponse.body.id_pedido], id_vehiculo: idVehiculo, id_piloto: idPiloto });
    const idRuta = routeResponse.body.id_ruta;

    await request(app).put(`/api/rutas/${idRuta}/salida`).set('Authorization', authHeader).send({ km_salida: 10 });
    await request(app)
      .put(`/api/rutas/${idRuta}/entregas`)
      .set('Authorization', authHeader)
      .send({ entregas: [{ id_detalle: idDetalle, cantidad_entregada: 0 }] });

    const pilotoToken = signToken({ sub: baseline.idUsuario, rol: 'Piloto' });
    const logisticaToken = signToken({ sub: baseline.idUsuario, rol: 'Logistica' });
    const produccionToken = signToken({ sub: baseline.idUsuario, rol: 'Produccion' });

    const produccionCreateResponse = await request(app)
      .post('/api/devoluciones')
      .set('Authorization', `Bearer ${produccionToken}`)
      .send({ id_detalle: idDetalle, cantidad_devuelta: 3 });

    expect(produccionCreateResponse.status).toBe(403);

    const pilotoCreateResponse = await request(app)
      .post('/api/devoluciones')
      .set('Authorization', `Bearer ${pilotoToken}`)
      .send({ id_detalle: idDetalle, cantidad_devuelta: 3 });

    expect(pilotoCreateResponse.status).toBe(403);

    const logisticaCreateResponse = await request(app)
      .post('/api/devoluciones')
      .set('Authorization', `Bearer ${logisticaToken}`)
      .send({ id_detalle: idDetalle, cantidad_devuelta: 3 });

    expect(logisticaCreateResponse.status).toBe(201);
    const idDevolucion = logisticaCreateResponse.body.id_devolucion;

    const pilotoResolveResponse = await request(app)
      .put(`/api/devoluciones/${idDevolucion}/resolver`)
      .set('Authorization', `Bearer ${pilotoToken}`)
      .send({ resolucion: 'Reingresado a inventario' });

    expect(pilotoResolveResponse.status).toBe(403);

    const produccionResolveResponse = await request(app)
      .put(`/api/devoluciones/${idDevolucion}/resolver`)
      .set('Authorization', `Bearer ${produccionToken}`)
      .send({ resolucion: 'Reingresado a inventario' });

    expect(produccionResolveResponse.status).toBe(200);
  });
});

describe('validaciones propias del controlador', () => {
  it('rechaza crear una ruta sin id_pedidos', async () => {
    const idVehiculo = await createVehicle();
    const idPiloto = await createPilot();

    const response = await request(app)
      .post('/api/rutas')
      .set('Authorization', authHeader)
      .send({ id_vehiculo: idVehiculo, id_piloto: idPiloto });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/id_pedidos/);
  });

  it('devuelve 404 al cancelar un pedido que no existe', async () => {
    const response = await request(app).put('/api/pedidos/999999/cancelar').set('Authorization', authHeader);
    expect(response.status).toBe(404);
  });

  it('Logistica no puede acceder a /api/auditoria (solo Administrador)', async () => {
    const logisticaToken = signToken({ sub: baseline.idUsuario, rol: 'Logistica' });
    const response = await request(app).get('/api/auditoria').set('Authorization', `Bearer ${logisticaToken}`);
    expect(response.status).toBe(403);
  });
});
