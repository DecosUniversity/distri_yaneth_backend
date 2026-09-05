const { pool, resetDatabase, seedBaseline } = require('../helpers/db');
const { recordAudit, AUDIT_ACTION_CREATE, AUDIT_ACTION_UPDATE } = require('../../src/workers/shared/audit.js');
const { handlers } = require('../../src/workers/domains/audit.worker.js');

let baseline;

beforeEach(async () => {
  await resetDatabase();
  baseline = await seedBaseline();
});

describe('audit.worker query handlers', () => {
  it('audit.findAll deserializa las columnas JSON de vuelta a objetos', async () => {
    await recordAudit(pool, {
      table: 'proveedores',
      recordId: 7,
      action: AUDIT_ACTION_CREATE,
      before: null,
      after: { nombre_empresa: 'Finca X' },
      userId: baseline.idUsuario,
    });

    const rows = await handlers['audit.findAll']();
    const row = rows.find((item) => item.tabla_afectada === 'proveedores' && item.id_registro_afectado === '7');

    expect(row).toBeDefined();
    expect(typeof row.valores_nuevos).toBe('object');
    expect(row.valores_nuevos.nombre_empresa).toBe('Finca X');
    expect(row.usuario_nombre).toBe('Admin Pruebas');
  });

  it('audit.findByTable filtra solo la tabla pedida', async () => {
    await recordAudit(pool, { table: 'proveedores', recordId: 1, action: AUDIT_ACTION_CREATE, before: null, after: {}, userId: baseline.idUsuario });
    await recordAudit(pool, { table: 'clientes', recordId: 1, action: AUDIT_ACTION_CREATE, before: null, after: {}, userId: baseline.idUsuario });

    const rows = await handlers['audit.findByTable']({ tabla: 'clientes' });
    expect(rows.every((row) => row.tabla_afectada === 'clientes')).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('audit.findByRecord filtra por tabla + id de registro exacto', async () => {
    await recordAudit(pool, { table: 'proveedores', recordId: 1, action: AUDIT_ACTION_CREATE, before: null, after: { v: 1 }, userId: baseline.idUsuario });
    await recordAudit(pool, { table: 'proveedores', recordId: 1, action: AUDIT_ACTION_UPDATE, before: { v: 1 }, after: { v: 2 }, userId: baseline.idUsuario });
    await recordAudit(pool, { table: 'proveedores', recordId: 2, action: AUDIT_ACTION_CREATE, before: null, after: { v: 1 }, userId: baseline.idUsuario });

    const rows = await handlers['audit.findByRecord']({ tabla: 'proveedores', id: 1 });
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.id_registro_afectado === '1')).toBe(true);
  });

  it('audit.findTables devuelve la lista de tablas distintas con auditoria', async () => {
    await recordAudit(pool, { table: 'proveedores', recordId: 1, action: AUDIT_ACTION_CREATE, before: null, after: {}, userId: baseline.idUsuario });
    await recordAudit(pool, { table: 'clientes', recordId: 1, action: AUDIT_ACTION_CREATE, before: null, after: {}, userId: baseline.idUsuario });

    const tables = await handlers['audit.findTables']();
    expect(tables).toEqual(expect.arrayContaining(['proveedores', 'clientes']));
  });
});
