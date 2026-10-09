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

// El empaque de redes se estandarizo dentro de Produccion: ya no existe POST /api/redes-verdes,
// se usa el mismo POST /api/produccion/procesos + POST .../etapas (con `cajas`) que cualquier
// otro producto. Ver tests/workers/production_green_pack.test.js para el resto del flujo.
describe('POST /api/produccion/procesos/:id/etapas (cajas de empaque en red)', () => {
  const createGreenSublot = async (pesoKg) => {
    const [lotResult] = await pool.query(
      `INSERT INTO lotes_materia_prima (id_producto, id_proveedor, fecha_recepcion, peso_inicial_kg, estado_maduracion, estado_registro)
       VALUES (?, ?, CURRENT_DATE, ?, 'Verde', 'Activo')`,
      [baseline.idProductoMateriaPrima, baseline.idProveedor, pesoKg]
    );
    const [sublotResult] = await pool.query(
      `INSERT INTO sublotes_maduracion (id_lote_mp, codigo_sublote, peso_inicial_kg, peso_kg, estado_maduracion, estado_registro)
       VALUES (?, 'A', ?, ?, 'Verde', 'Activo')`,
      [lotResult.insertId, pesoKg, pesoKg]
    );
    return sublotResult.insertId;
  };

  it('inicia un proceso desde un sub-lote Verde y registra varias cajas en una etapa, por HTTP', async () => {
    const idSublote = await createGreenSublot(200);

    const processResponse = await request(app)
      .post('/api/produccion/procesos')
      .set('Authorization', authHeader)
      .send({
        id_sublote: idSublote,
        id_producto_resultado: baseline.idProductoTerminado,
        cantidad_ingresada_kg: 49.5,
      });

    expect(processResponse.status).toBe(201);

    const stageResponse = await request(app)
      .post(`/api/produccion/procesos/${processResponse.body.id_proceso}/etapas`)
      .set('Authorization', authHeader)
      .send({
        id_tipo_etapa: baseline.idTipoEtapa,
        cantidad_personas: 2,
        fecha_inicio: new Date().toISOString(),
        cajas: [
          { cantidad_redes: 50, peso_kg: 25 },
          { cantidad_redes: 50, peso_kg: 24.5 },
        ],
      });

    expect(stageResponse.status).toBe(201);
    expect(stageResponse.body.cajas).toHaveLength(2);
    expect(stageResponse.body.cajas[0].cantidad_redes).toBe(50);
  });

  it('devuelve 400 si una caja no trae un peso valido', async () => {
    const idSublote = await createGreenSublot(50);

    const processResponse = await request(app)
      .post('/api/produccion/procesos')
      .set('Authorization', authHeader)
      .send({
        id_sublote: idSublote,
        id_producto_resultado: baseline.idProductoTerminado,
        cantidad_ingresada_kg: 25,
      });

    const stageResponse = await request(app)
      .post(`/api/produccion/procesos/${processResponse.body.id_proceso}/etapas`)
      .set('Authorization', authHeader)
      .send({
        id_tipo_etapa: baseline.idTipoEtapa,
        cantidad_personas: 2,
        fecha_inicio: new Date().toISOString(),
        cajas: [{ cantidad_redes: 50, peso_kg: 0 }],
      });

    expect(stageResponse.status).toBe(400);
    expect(stageResponse.body.message).toMatch(/peso mayor a 0/);
  });
});
