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

describe('POST /api/productos - un Producto Terminado exige un plan de etapas al crearse', () => {
  it('rechaza crear un Producto Terminado sin el campo etapas', async () => {
    const response = await request(app).post('/api/productos').set('Authorization', authHeader).send({
      nombre: 'Guacamole',
      tipo_producto: 'Producto Terminado',
      unidad_medida: 'Unidades',
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/al menos una etapa/);

    const [rows] = await pool.query('SELECT * FROM productos WHERE nombre = ?', ['Guacamole']);
    expect(rows).toHaveLength(0);
  });

  it('rechaza crear un Producto Terminado con etapas vacio', async () => {
    const response = await request(app).post('/api/productos').set('Authorization', authHeader).send({
      nombre: 'Guacamole',
      tipo_producto: 'Producto Terminado',
      unidad_medida: 'Unidades',
      etapas: [],
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/al menos una etapa/);
  });

  it('rechaza crear un Producto Terminado con un id_tipo_etapa que no existe', async () => {
    const response = await request(app).post('/api/productos').set('Authorization', authHeader).send({
      nombre: 'Guacamole',
      tipo_producto: 'Producto Terminado',
      unidad_medida: 'Unidades',
      etapas: [999999],
    });

    expect(response.status).toBe(404);
  });

  it('crea el producto y su plan de etapas de forma atomica cuando el payload es valido', async () => {
    const response = await request(app).post('/api/productos').set('Authorization', authHeader).send({
      nombre: 'Guacamole',
      tipo_producto: 'Producto Terminado',
      unidad_medida: 'Unidades',
      etapas: [baseline.idTipoEtapa],
    });

    expect(response.status).toBe(201);
    const idProducto = response.body.id_producto;

    const [requirementRows] = await pool.query(
      'SELECT id_tipo_etapa, orden FROM producto_etapas_requeridas WHERE id_producto = ?',
      [idProducto]
    );
    expect(requirementRows).toEqual([{ id_tipo_etapa: baseline.idTipoEtapa, orden: 1 }]);
  });

  it('no exige plan de etapas para tipos de producto distintos de Producto Terminado', async () => {
    const response = await request(app).post('/api/productos').set('Authorization', authHeader).send({
      nombre: 'Aguacate',
      tipo_producto: 'Materia Prima',
      unidad_medida: 'kg',
    });

    expect(response.status).toBe(201);

    const [requirementRows] = await pool.query('SELECT * FROM producto_etapas_requeridas WHERE id_producto = ?', [
      response.body.id_producto,
    ]);
    expect(requirementRows).toHaveLength(0);
  });
});
