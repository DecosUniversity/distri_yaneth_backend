// Regresion de los defectos reportados por QA en la Entrega 3 (Bug Tracker del curso de
// Aseguramiento de la Calidad). Cada bloque reproduce el caso de prueba original y verifica
// que el sistema ahora lo rechaza.
const request = require('supertest');
const { pool, resetDatabase, seedBaseline } = require('../helpers/db');
const { startTestServer, stopTestServer } = require('../helpers/apiServer');
const { signToken } = require('../helpers/authToken');
const { createReadySublot } = require('../helpers/fixtures');

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

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

const startProcess = async (kg) => {
  const { idSublote } = await createReadySublot({
    idProducto: baseline.idProductoMateriaPrima,
    idProveedor: baseline.idProveedor,
    pesoKg: kg,
  });
  const response = await request(app)
    .post('/api/produccion/procesos')
    .set('Authorization', authHeader)
    .send({ id_sublote: idSublote, id_producto_resultado: baseline.idProductoTerminado, cantidad_ingresada_kg: kg });
  expect(response.status).toBe(201);
  return response.body.id_proceso;
};

const addStage = async (idProceso, entradaKg) => {
  const response = await request(app)
    .post(`/api/produccion/procesos/${idProceso}/etapas`)
    .set('Authorization', authHeader)
    .send({ id_tipo_etapa: baseline.idTipoEtapa, fecha_inicio: now(), cantidad_personas: 2, cantidad_entrada_kg: entradaKg });
  expect(response.status).toBe(201);
  return response.body.id_etapa;
};

const addMerma = (idProceso, body) =>
  request(app)
    .post(`/api/produccion/procesos/${idProceso}/mermas`)
    .set('Authorization', authHeader)
    .send({ id_tipo_merma: baseline.idTipoMerma, ...body });

describe('BUG-CLI-01 (TC-REQ001-005): NIT duplicado en clientes', () => {
  const client = (nombre, nit) => ({ nombre_comercial: nombre, nit_facturacion: nit });

  it('rechaza con 409 un segundo cliente activo con el mismo NIT y conserva solo el original', async () => {
    const first = await request(app).post('/api/clientes').set('Authorization', authHeader).send(client('Cliente QA Original', '1234567-8'));
    expect(first.status).toBe(201);

    const duplicate = await request(app).post('/api/clientes').set('Authorization', authHeader).send(client('Cliente QA Duplicado', ' 1234567-8 '));
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.message).toMatch(/NIT/);

    const [rows] = await pool.query("SELECT COUNT(*) AS total FROM clientes WHERE nit_facturacion = '1234567-8'");
    expect(rows[0].total).toBe(1);
  });

  it('impide editar un cliente para ponerle el NIT de otro, pero permite guardar su propio NIT', async () => {
    await request(app).post('/api/clientes').set('Authorization', authHeader).send(client('Cliente A', '1234567-8'));
    const other = await request(app).post('/api/clientes').set('Authorization', authHeader).send(client('Cliente B', '7654321-0'));

    const stealNit = await request(app)
      .put(`/api/clientes/${other.body.id_cliente}`)
      .set('Authorization', authHeader)
      .send(client('Cliente B', '1234567-8'));
    expect(stealNit.status).toBe(409);

    const keepOwnNit = await request(app)
      .put(`/api/clientes/${other.body.id_cliente}`)
      .set('Authorization', authHeader)
      .send(client('Cliente B renombrado', '7654321-0'));
    expect(keepOwnNit.status).toBe(200);
  });

  it('permite reutilizar el NIT de un cliente eliminado y clientes sin NIT', async () => {
    const deleted = await request(app).post('/api/clientes').set('Authorization', authHeader).send(client('Cliente Viejo', '1234567-8'));
    await request(app).delete(`/api/clientes/${deleted.body.id_cliente}`).set('Authorization', authHeader);

    const reused = await request(app).post('/api/clientes').set('Authorization', authHeader).send(client('Cliente Nuevo', '1234567-8'));
    expect(reused.status).toBe(201);

    const noNit1 = await request(app).post('/api/clientes').set('Authorization', authHeader).send(client('Sin NIT 1', ''));
    const noNit2 = await request(app).post('/api/clientes').set('Authorization', authHeader).send(client('Sin NIT 2', ''));
    expect(noNit1.status).toBe(201);
    expect(noNit2.status).toBe(201);
  });
});

describe('BUG-REC-01 (TC-REQ002-002): peso de unidad negativo en recepcion', () => {
  const createEntry = (unidades) =>
    request(app)
      .post('/api/entradas-mercancia')
      .set('Authorization', authHeader)
      .send({
        id_proveedor: baseline.idProveedor,
        id_producto: baseline.idProductoMateriaPrima,
        fecha_vencimiento: '2027-01-01',
        cantidad_disponible: 20,
        unidades,
      });

  it('rechaza con 400 una unidad con peso negativo o cero', async () => {
    const entry = await createEntry([{ unidad_codigo: '1', peso: 20 }]);
    expect(entry.status).toBe(201);

    for (const peso of [-5, 0]) {
      const response = await request(app)
        .post(`/api/entradas-mercancia/${entry.body.id_entrada}/units`)
        .set('Authorization', authHeader)
        .send({ peso });
      expect(response.status).toBe(400);
    }

    const [rows] = await pool.query('SELECT COUNT(*) AS total FROM entrada_unidades WHERE peso <= 0');
    expect(rows[0].total).toBe(0);
  });

  it('rechaza crear una entrada si alguna de sus unidades tiene peso no positivo', async () => {
    const response = await createEntry([
      { unidad_codigo: '1', peso: 25 },
      { unidad_codigo: '2', peso: -5 },
    ]);
    expect(response.status).toBe(400);
  });
});

describe('BUG-PRO-01 (TC-REQ003-002): merma mayor que la entrada', () => {
  it('rechaza una merma de 60 kg sobre una etapa con 50 kg de entrada', async () => {
    const idProceso = await startProcess(50);
    const idEtapa = await addStage(idProceso, 50);

    const response = await addMerma(idProceso, { id_etapa: idEtapa, cantidad_kg: 60 });
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/La merma supera la entrada de la etapa/);

    const [rows] = await pool.query('SELECT COUNT(*) AS total FROM produccion_mermas WHERE id_proceso = ?', [idProceso]);
    expect(rows[0].total).toBe(0);
  });

  it('acumula las mermas: 30 + 30 kg sobre 50 kg rechaza la segunda', async () => {
    const idProceso = await startProcess(50);
    const idEtapa = await addStage(idProceso, 50);

    expect((await addMerma(idProceso, { id_etapa: idEtapa, cantidad_kg: 30 })).status).toBe(201);
    expect((await addMerma(idProceso, { id_etapa: idEtapa, cantidad_kg: 30 })).status).toBe(400);
  });

  it('permite el limite exacto (merma = entrada, TC-REQ003-007)', async () => {
    const idProceso = await startProcess(50);
    const idEtapa = await addStage(idProceso, 50);

    expect((await addMerma(idProceso, { id_etapa: idEtapa, cantidad_kg: 50 })).status).toBe(201);
  });

  it('rechaza una merma sin etapa que supere lo ingresado al proceso', async () => {
    const idProceso = await startProcess(50);

    const response = await addMerma(idProceso, { cantidad_kg: 60 });
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/La merma supera el peso ingresado al proceso/);
  });

  it('no permite bajar la entrada de una etapa por debajo de sus mermas', async () => {
    const idProceso = await startProcess(50);
    const idEtapa = await addStage(idProceso, 50);
    await addMerma(idProceso, { id_etapa: idEtapa, cantidad_kg: 40 });

    const response = await request(app)
      .put(`/api/produccion/procesos/${idProceso}/etapas/${idEtapa}`)
      .set('Authorization', authHeader)
      .send({ id_tipo_etapa: baseline.idTipoEtapa, fecha_inicio: now(), cantidad_personas: 2, cantidad_entrada_kg: 30 });
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/no puede ser menor que sus mermas/);
  });
});

describe('BUG-PRO-02 (TC-REQ003-008): justificacion de solo espacios', () => {
  const finalize = (idProceso, justificacion) =>
    request(app)
      .post(`/api/produccion/procesos/${idProceso}/finalizar`)
      .set('Authorization', authHeader)
      .send({ cantidad_producida_kg: 175, fecha_fin: now(), fecha_vencimiento: '2027-01-31', justificacion_diferencia: justificacion });

  it('trata "   " como justificacion vacia y rechaza el cierre con diferencia de 5 kg', async () => {
    const idProceso = await startProcess(200);
    await addMerma(idProceso, { cantidad_kg: 20 });

    const response = await finalize(idProceso, '   ');
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/Debes justificar la diferencia de 5.00 kg/);

    const [rows] = await pool.query('SELECT estado_proceso FROM procesos_produccion WHERE id_proceso = ?', [idProceso]);
    expect(rows[0].estado_proceso).not.toBe('Finalizado');
  });

  it('acepta una justificacion real y la guarda sin espacios sobrantes (TC-REQ003-005)', async () => {
    const idProceso = await startProcess(200);
    await addMerma(idProceso, { cantidad_kg: 20 });

    const response = await finalize(idProceso, '  Diferencia en pesaje manual.  ');
    expect(response.status).toBe(200);
    expect(response.body.justificacion_diferencia).toBe('Diferencia en pesaje manual.');
  });
});

describe('BUG-REP-02 (TC-REQ005-004): intervalo de fechas invertido', () => {
  it.each([
    '/api/pedidos/reportes/compras-por-cliente',
    '/api/pedidos/reportes/compras-por-producto',
    '/api/pedidos/reportes/mas-vendidos',
    '/api/pedidos/reportes/mejores-clientes',
    '/api/trazabilidad/filtrar',
  ])('%s responde 400 cuando desde > hasta', async (path) => {
    const response = await request(app)
      .get(`${path}?desde=2026-10-15&hasta=2026-10-10`)
      .set('Authorization', authHeader);
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/no puede ser posterior/);
  });

  it('acepta el mismo dia como inicio y fin (TC-REQ005-008)', async () => {
    const response = await request(app)
      .get('/api/pedidos/reportes/compras-por-cliente?desde=2026-10-05&hasta=2026-10-05')
      .set('Authorization', authHeader);
    expect(response.status).toBe(200);
  });
});
