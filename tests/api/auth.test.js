const request = require('supertest');
const { resetDatabase, seedBaseline } = require('../helpers/db');
const { startTestServer, stopTestServer } = require('../helpers/apiServer');
const { signToken } = require('../helpers/authToken');

let app;
let baseline;

beforeAll(async () => {
  app = await startTestServer();
});

afterAll(async () => {
  await stopTestServer();
});

beforeEach(async () => {
  await resetDatabase();
  baseline = await seedBaseline();
});

describe('POST /api/users/login', () => {
  it('inicia sesion con credenciales correctas y devuelve un token', async () => {
    const response = await request(app).post('/api/users/login').send({ username: 'admin.test', password: 'x' });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
    expect(response.body.user?.rol).toBe('Administrador');
  });

  it('rechaza una contrasena incorrecta', async () => {
    const response = await request(app).post('/api/users/login').send({ username: 'admin.test', password: 'incorrecta' });
    expect(response.status).toBe(401);
  });

  it('rechaza un usuario que no existe', async () => {
    const response = await request(app).post('/api/users/login').send({ username: 'no.existe', password: 'x' });
    expect(response.status).toBe(401);
  });

  it('rechaza login sin username o password', async () => {
    const response = await request(app).post('/api/users/login').send({ username: 'admin.test' });
    expect(response.status).toBe(400);
  });
});

describe('proteccion de rutas', () => {
  it('rechaza una peticion sin token con 401', async () => {
    const response = await request(app).get('/api/proveedores');
    expect(response.status).toBe(401);
  });

  it('rechaza un token invalido con 401', async () => {
    const response = await request(app).get('/api/proveedores').set('Authorization', 'Bearer token-invalido');
    expect(response.status).toBe(401);
  });

  it('rechaza un rol sin permiso para el modulo con 403', async () => {
    const pilotToken = signToken({ sub: baseline.idUsuario, rol: 'Piloto' });
    const response = await request(app).get('/api/produccion/procesos').set('Authorization', `Bearer ${pilotToken}`);
    expect(response.status).toBe(403);
  });

  it('permite el acceso con un rol autorizado', async () => {
    const adminToken = signToken({ sub: baseline.idUsuario, rol: 'Administrador' });
    const response = await request(app).get('/api/produccion/procesos').set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});
