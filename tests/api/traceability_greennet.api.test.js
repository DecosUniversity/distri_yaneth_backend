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

describe('GET /api/trazabilidad', () => {
  it('rastrea por codigo de lote una entrada recien creada', async () => {
    const entryResponse = await request(app)
      .post('/api/entradas-mercancia')
      .set('Authorization', authHeader)
      .send({
        id_proveedor: baseline.idProveedor,
        id_producto: baseline.idProductoMateriaPrima,
        fecha_vencimiento: '2027-01-01',
        cantidad_disponible: 40,
      });

    const traceResponse = await request(app)
      .get('/api/trazabilidad')
      .set('Authorization', authHeader)
      .query({ codigo: entryResponse.body.codigo_lote });

    expect(traceResponse.status).toBe(200);
    expect(traceResponse.body.raiz.id_entrada).toBe(entryResponse.body.id_entrada);
  });

  it('devuelve 400 sin codigo ni tipo+id', async () => {
    const response = await request(app).get('/api/trazabilidad').set('Authorization', authHeader);
    expect(response.status).toBe(400);
  });

  it('/buscar devuelve 400 sin termino de busqueda', async () => {
    const response = await request(app).get('/api/trazabilidad/buscar').set('Authorization', authHeader);
    expect(response.status).toBe(400);
  });

  it('/filtrar rechaza un area invalida', async () => {
    const response = await request(app)
      .get('/api/trazabilidad/filtrar')
      .set('Authorization', authHeader)
      .query({ areas: 'no-existe' });

    expect(response.status).toBe(400);
  });
});

describe('POST /api/redes-verdes (cajas)', () => {
  it('registra varias cajas de una red verde en un solo envio por HTTP', async () => {
    const [lotResult] = await pool.query(
      `INSERT INTO lotes_materia_prima (id_producto, id_proveedor, fecha_recepcion, peso_inicial_kg, estado_maduracion, estado_registro)
       VALUES (?, ?, CURRENT_DATE, 200, 'Verde', 'Activo')`,
      [baseline.idProductoMateriaPrima, baseline.idProveedor]
    );
    const [sublotResult] = await pool.query(
      `INSERT INTO sublotes_maduracion (id_lote_mp, codigo_sublote, peso_inicial_kg, peso_kg, estado_maduracion, estado_registro)
       VALUES (?, 'A', 200, 200, 'Verde', 'Activo')`,
      [lotResult.insertId]
    );

    const response = await request(app)
      .post('/api/redes-verdes')
      .set('Authorization', authHeader)
      .send({
        id_sublote: sublotResult.insertId,
        id_producto: baseline.idProductoTerminado,
        fecha_vencimiento: '2027-01-01',
        cajas: [
          { cantidad_redes: 50, peso_kg: 25 },
          { cantidad_redes: 50, peso_kg: 24.5 },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveLength(2);
    expect(response.body[0].cantidad_redes).toBe(50);
  });

  it('devuelve 400 si no se envia ninguna caja', async () => {
    const [lotResult] = await pool.query(
      `INSERT INTO lotes_materia_prima (id_producto, id_proveedor, fecha_recepcion, peso_inicial_kg, estado_maduracion, estado_registro)
       VALUES (?, ?, CURRENT_DATE, 50, 'Verde', 'Activo')`,
      [baseline.idProductoMateriaPrima, baseline.idProveedor]
    );
    const [sublotResult] = await pool.query(
      `INSERT INTO sublotes_maduracion (id_lote_mp, codigo_sublote, peso_inicial_kg, peso_kg, estado_maduracion, estado_registro)
       VALUES (?, 'A', 50, 50, 'Verde', 'Activo')`,
      [lotResult.insertId]
    );

    const response = await request(app)
      .post('/api/redes-verdes')
      .set('Authorization', authHeader)
      .send({
        id_sublote: sublotResult.insertId,
        id_producto: baseline.idProductoTerminado,
        fecha_vencimiento: '2027-01-01',
        cajas: [],
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/al menos una caja/);
  });
});
