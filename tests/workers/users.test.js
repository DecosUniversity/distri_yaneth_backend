const { pool, resetDatabase, seedBaseline } = require('../helpers/db');
const { handlers } = require('../../src/workers/domains/user.worker.js');

let baseline;

beforeEach(async () => {
  await resetDatabase();
  baseline = await seedBaseline();
});

describe('users CRUD', () => {
  it('crea, encuentra por username, actualiza, resetea password y desactiva', async () => {
    const created = await handlers['users.create']({
      nombre_completo: 'Usuario Prueba',
      username: 'usuario.prueba',
      password_hash: 'hash-original',
      rol: 'Piloto',
      id_usuario_modificacion: baseline.idUsuario,
    });
    expect(created.username).toBe('usuario.prueba');

    const foundByUsername = await handlers['users.findByUsername']({ username: 'usuario.prueba' });
    expect(foundByUsername.id_usuario).toBe(created.id_usuario);

    const updated = await handlers['users.update']({
      id: created.id_usuario,
      nombre_completo: 'Usuario Renombrado',
      username: 'usuario.prueba',
      password_hash: 'hash-original',
      rol: 'Logistica',
      id_usuario_modificacion: baseline.idUsuario,
    });
    expect(updated.nombre_completo).toBe('Usuario Renombrado');
    expect(updated.rol).toBe('Logistica');

    const reset = await handlers['users.resetPassword']({
      id: created.id_usuario,
      password_hash: 'hash-nuevo',
      id_usuario_modificacion: baseline.idUsuario,
    });
    expect(reset.id_usuario).toBe(created.id_usuario);

    const [passwordRows] = await pool.query('SELECT password_hash FROM usuarios WHERE id_usuario = ?', [created.id_usuario]);
    expect(passwordRows[0].password_hash).toBe('hash-nuevo');

    const removed = await handlers['users.remove']({ id: created.id_usuario, id_usuario_modificacion: baseline.idUsuario });
    expect(removed).toBe(true);

    const [rows] = await pool.query('SELECT estado_registro FROM usuarios WHERE id_usuario = ?', [created.id_usuario]);
    expect(rows[0].estado_registro).toBe('Inactivo');

    // Un usuario Inactivo ya no debe poder autenticarse por username.
    const afterRemove = await handlers['users.findByUsername']({ username: 'usuario.prueba' });
    expect(afterRemove).toBeNull();
  });

  it('no permite reutilizar un username ya existente (constraint de la BD)', async () => {
    await handlers['users.create']({
      nombre_completo: 'Primero',
      username: 'duplicado',
      password_hash: 'x',
      rol: 'Piloto',
      id_usuario_modificacion: baseline.idUsuario,
    });

    await expect(
      handlers['users.create']({
        nombre_completo: 'Segundo',
        username: 'duplicado',
        password_hash: 'x',
        rol: 'Piloto',
        id_usuario_modificacion: baseline.idUsuario,
      })
    ).rejects.toThrow();
  });
});
