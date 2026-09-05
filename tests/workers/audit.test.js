const { pool, resetDatabase, seedBaseline } = require('../helpers/db');
const { recordAudit, AUDIT_ACTION_CREATE, AUDIT_ACTION_UPDATE, AUDIT_ACTION_DELETE } = require('../../src/workers/shared/audit.js');
const { handlers: providerHandlers } = require('../../src/workers/domains/provider.worker.js');
const { handlers: userHandlers } = require('../../src/workers/domains/user.worker.js');

let baseline;

beforeEach(async () => {
  await resetDatabase();
  baseline = await seedBaseline();
});

describe('recordAudit', () => {
  it('guarda accion, before/after serializados y el usuario que hizo el cambio', async () => {
    await recordAudit(pool, {
      table: 'proveedores',
      recordId: 42,
      action: AUDIT_ACTION_UPDATE,
      before: { nombre_empresa: 'Antes' },
      after: { nombre_empresa: 'Despues' },
      userId: baseline.idUsuario,
    });

    const [rows] = await pool.query('SELECT * FROM auditoria_cambios WHERE tabla_afectada = ? AND id_registro_afectado = ?', [
      'proveedores',
      '42',
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].accion).toBe('Actualizacion');
    expect(rows[0].id_usuario).toBe(baseline.idUsuario);
    expect(JSON.parse(rows[0].valores_anteriores)).toEqual({ nombre_empresa: 'Antes' });
    expect(JSON.parse(rows[0].valores_nuevos)).toEqual({ nombre_empresa: 'Despues' });
  });

  it('guarda NULL en before para una creacion y en after para una eliminacion', async () => {
    await recordAudit(pool, {
      table: 'proveedores',
      recordId: 1,
      action: AUDIT_ACTION_CREATE,
      before: null,
      after: { nombre_empresa: 'Nuevo' },
      userId: baseline.idUsuario,
    });
    await recordAudit(pool, {
      table: 'proveedores',
      recordId: 1,
      action: AUDIT_ACTION_DELETE,
      before: { nombre_empresa: 'Nuevo' },
      after: null,
      userId: baseline.idUsuario,
    });

    const [rows] = await pool.query(
      "SELECT accion, valores_anteriores, valores_nuevos FROM auditoria_cambios WHERE tabla_afectada = 'proveedores' AND id_registro_afectado = '1' ORDER BY id_auditoria ASC"
    );

    expect(rows[0].accion).toBe('Creacion');
    expect(rows[0].valores_anteriores).toBeNull();
    expect(rows[1].accion).toBe('Eliminacion');
    expect(rows[1].valores_nuevos).toBeNull();
  });
});

describe('auditoria de escritura real (proveedores)', () => {
  it('crear/actualizar/eliminar un proveedor deja su rastro completo en auditoria_cambios', async () => {
    const created = await providerHandlers['providers.create']({
      nombre_empresa: 'Finca Auditada',
      id_usuario_modificacion: baseline.idUsuario,
    });

    await providerHandlers['providers.update']({
      id: created.id_proveedor,
      nombre_empresa: 'Finca Auditada Renombrada',
      id_usuario_modificacion: baseline.idUsuario,
    });

    await providerHandlers['providers.remove']({ id: created.id_proveedor, id_usuario_modificacion: baseline.idUsuario });

    const [rows] = await pool.query(
      "SELECT accion, valores_anteriores, valores_nuevos FROM auditoria_cambios WHERE tabla_afectada = 'proveedores' AND id_registro_afectado = ? ORDER BY id_auditoria ASC",
      [String(created.id_proveedor)]
    );

    expect(rows.map((row) => row.accion)).toEqual(['Creacion', 'Actualizacion', 'Eliminacion']);
    expect(JSON.parse(rows[1].valores_anteriores).nombre_empresa).toBe('Finca Auditada');
    expect(JSON.parse(rows[1].valores_nuevos).nombre_empresa).toBe('Finca Auditada Renombrada');
    expect(JSON.parse(rows[2].valores_anteriores).nombre_empresa).toBe('Finca Auditada Renombrada');
    expect(rows[2].valores_nuevos).toBeNull();
  });
});

describe('auditoria de usuarios no filtra el hash de contrasena', () => {
  it('no guarda password_hash en el historial al crear o actualizar un usuario', async () => {
    const created = await userHandlers['users.create']({
      nombre_completo: 'Usuario Auditado',
      username: 'usuario.auditado',
      password_hash: 'super-secreto-hash',
      rol: 'Piloto',
      id_usuario_modificacion: baseline.idUsuario,
    });

    const [rows] = await pool.query(
      "SELECT valores_nuevos FROM auditoria_cambios WHERE tabla_afectada = 'usuarios' AND id_registro_afectado = ? AND accion = 'Creacion'",
      [String(created.id_usuario)]
    );

    expect(rows).toHaveLength(1);
    const afterSnapshot = JSON.parse(rows[0].valores_nuevos);
    expect(afterSnapshot.password_hash).toBeUndefined();
    expect(afterSnapshot.username).toBe('usuario.auditado');
  });
});
