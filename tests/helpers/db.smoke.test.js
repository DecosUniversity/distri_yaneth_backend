const { pool, resetDatabase, seedBaseline } = require('./db');

describe('arnes de pruebas: conexion y seed', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('conecta a la base de datos de pruebas (no la real)', async () => {
    const [rows] = await pool.query('SELECT DATABASE() AS db');
    expect(rows[0].db).toBe('proyecto_graduacion_test');
  });

  it('siembra el catalogo minimo', async () => {
    const ids = await seedBaseline();
    expect(ids.idUsuario).toBeGreaterThan(0);

    const [users] = await pool.query('SELECT COUNT(*) AS total FROM usuarios');
    expect(users[0].total).toBe(1);
  });
});
