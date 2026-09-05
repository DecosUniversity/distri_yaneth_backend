const request = require('supertest');
const { pool, resetDatabase, seedBaseline } = require('../helpers/db');
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

describe('flujo completo por HTTP: entrada -> maduracion -> produccion', () => {
  it('crea una entrada de materia prima, la acepta y arranca/finaliza un proceso de produccion', async () => {
    const entryResponse = await request(app)
      .post('/api/entradas-mercancia')
      .set('Authorization', authHeader)
      .send({
        id_proveedor: baseline.idProveedor,
        id_producto: baseline.idProductoMateriaPrima,
        fecha_vencimiento: '2027-01-01',
        cantidad_disponible: 100,
        costo_unitario: 5,
      });

    expect(entryResponse.status).toBe(201);
    expect(entryResponse.body.codigo_lote).toMatch(/^[A-Z]{3}-\d{6}-\d{3}$/);

    const [loteRows] = await pool.query('SELECT id_lote_mp FROM lotes_materia_prima WHERE id_entrada_origen = ?', [
      entryResponse.body.id_entrada,
    ]);
    const idLoteMp = loteRows[0].id_lote_mp;

    const acceptResponse = await request(app)
      .post(`/api/maduracion/lotes/${idLoteMp}/aceptar`)
      .set('Authorization', authHeader)
      .send({ estado_maduracion: 'Maduro' });

    expect(acceptResponse.status).toBe(201);
    expect(acceptResponse.body.estado_registro).toBe('Listo para produccion');

    const idSublote = acceptResponse.body.id_sublote;

    const processResponse = await request(app)
      .post('/api/produccion/procesos')
      .set('Authorization', authHeader)
      .send({
        id_sublote: idSublote,
        id_producto_resultado: baseline.idProductoTerminado,
        cantidad_ingresada_kg: 100,
      });

    expect(processResponse.status).toBe(201);
    const idProceso = processResponse.body.id_proceso;

    const mismatchedFinalize = await request(app)
      .post(`/api/produccion/procesos/${idProceso}/finalizar`)
      .set('Authorization', authHeader)
      .send({ cantidad_producida_kg: 50, fecha_fin: new Date().toISOString(), fecha_vencimiento: '2027-06-01' });

    expect(mismatchedFinalize.status).toBe(400);
    expect(mismatchedFinalize.body.message).toMatch(/El peso no cuadra/);

    const finalizeResponse = await request(app)
      .post(`/api/produccion/procesos/${idProceso}/finalizar`)
      .set('Authorization', authHeader)
      .send({ cantidad_producida_kg: 100, fecha_fin: new Date().toISOString(), fecha_vencimiento: '2027-06-01' });

    expect(finalizeResponse.status).toBe(200);
    expect(finalizeResponse.body.estado_proceso).toBe('Finalizado');
  });

  it('revierte un proceso recien creado (sin trabajo) por HTTP', async () => {
    const entryResponse = await request(app)
      .post('/api/entradas-mercancia')
      .set('Authorization', authHeader)
      .send({
        id_proveedor: baseline.idProveedor,
        id_producto: baseline.idProductoMateriaPrima,
        fecha_vencimiento: '2027-01-01',
        cantidad_disponible: 60,
      });

    const [loteRows] = await pool.query('SELECT id_lote_mp FROM lotes_materia_prima WHERE id_entrada_origen = ?', [
      entryResponse.body.id_entrada,
    ]);

    const acceptResponse = await request(app)
      .post(`/api/maduracion/lotes/${loteRows[0].id_lote_mp}/aceptar`)
      .set('Authorization', authHeader)
      .send({ estado_maduracion: 'Maduro' });

    const processResponse = await request(app)
      .post('/api/produccion/procesos')
      .set('Authorization', authHeader)
      .send({
        id_sublote: acceptResponse.body.id_sublote,
        id_producto_resultado: baseline.idProductoTerminado,
        cantidad_ingresada_kg: 60,
      });

    const revertResponse = await request(app)
      .put(`/api/produccion/procesos/${processResponse.body.id_proceso}/revertir`)
      .set('Authorization', authHeader)
      .send({});

    expect(revertResponse.status).toBe(200);

    const [sublotRows] = await pool.query('SELECT peso_kg, estado_registro FROM sublotes_maduracion WHERE id_sublote = ?', [
      acceptResponse.body.id_sublote,
    ]);
    expect(Number(sublotRows[0].peso_kg)).toBe(60);
    expect(sublotRows[0].estado_registro).toBe('Listo para produccion');
  });
});

describe('validaciones propias del controlador (no se ven en las pruebas de worker)', () => {
  it('rechaza registrar una entrada de un producto que no es Materia Prima ni Insumo', async () => {
    const response = await request(app)
      .post('/api/entradas-mercancia')
      .set('Authorization', authHeader)
      .send({
        id_proveedor: baseline.idProveedor,
        id_producto: baseline.idProductoTerminado,
        fecha_vencimiento: '2027-01-01',
        cantidad_disponible: 10,
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/Materia Prima o Insumo/);
  });

  it('devuelve 404 al pedir un proceso de produccion inexistente', async () => {
    const response = await request(app).get('/api/produccion/procesos/999999').set('Authorization', authHeader);
    expect(response.status).toBe(404);
  });

  it('devuelve 400 al crear un proceso sin id_sublote', async () => {
    const response = await request(app)
      .post('/api/produccion/procesos')
      .set('Authorization', authHeader)
      .send({ id_producto_resultado: baseline.idProductoTerminado, cantidad_ingresada_kg: 10 });

    expect(response.status).toBe(400);
  });
});
