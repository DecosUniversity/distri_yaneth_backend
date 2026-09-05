const { pool, resetDatabase, seedBaseline } = require('../helpers/db');
const { handlers } = require('../../src/workers/domains/entradas_mercancia.worker.js');

let baseline;

beforeEach(async () => {
  await resetDatabase();
  baseline = await seedBaseline();
});

describe('entries.create - materia prima', () => {
  it('genera un codigo_lote legible y crea el lote de materia prima', async () => {
    const created = await handlers['entries.create']({
      id_proveedor: baseline.idProveedor,
      id_producto: baseline.idProductoMateriaPrima,
      fecha_vencimiento: '2027-01-01',
      cantidad_disponible: 100,
      costo_unitario: 5,
      documento_referencia: 'FAC-001',
      id_usuario_receptor: baseline.idUsuario,
    });

    expect(created).not.toBeNull();
    expect(created.codigo_lote).toMatch(/^[A-Z]{3}-\d{6}-\d{3}$/);

    const [lotRows] = await pool.query(
      'SELECT id_lote_mp, peso_inicial_kg, estado_registro FROM lotes_materia_prima WHERE id_entrada_origen = ?',
      [created.id_entrada]
    );
    expect(lotRows).toHaveLength(1);
    expect(Number(lotRows[0].peso_inicial_kg)).toBe(100);
    expect(lotRows[0].estado_registro).toBe('Pendiente');
  });

  it('usa la sumatoria de pesos de las unidades cuando se proporcionan', async () => {
    const created = await handlers['entries.create']({
      id_proveedor: baseline.idProveedor,
      id_producto: baseline.idProductoMateriaPrima,
      fecha_vencimiento: '2027-01-01',
      cantidad_disponible: 999, // debe ser ignorado a favor de la suma de unidades
      costo_unitario: null,
      documento_referencia: null,
      id_usuario_receptor: baseline.idUsuario,
      unidades: [{ peso: 10.5 }, { peso: 8.2 }, { peso: 9.3 }],
    });

    const [lotRows] = await pool.query(
      'SELECT cantidad_unidades, peso_inicial_kg FROM lotes_materia_prima WHERE id_entrada_origen = ?',
      [created.id_entrada]
    );
    expect(lotRows[0].cantidad_unidades).toBe(3);
    expect(Number(lotRows[0].peso_inicial_kg)).toBeCloseTo(28, 2);

    const [unitRows] = await pool.query('SELECT * FROM entrada_unidades WHERE id_entrada = ? ORDER BY id ASC', [
      created.id_entrada,
    ]);
    expect(unitRows).toHaveLength(3);
    expect(unitRows[0].unidad_codigo).toBe(`${created.id_entrada}-1`);
  });

  it('no crea lote de materia prima para producto terminado', async () => {
    const created = await handlers['entries.create']({
      id_proveedor: baseline.idProveedor,
      id_producto: baseline.idProductoTerminado,
      fecha_vencimiento: '2027-01-01',
      cantidad_disponible: 50,
      costo_unitario: 12,
      documento_referencia: null,
      id_usuario_receptor: baseline.idUsuario,
    });

    const [lotRows] = await pool.query('SELECT * FROM lotes_materia_prima WHERE id_entrada_origen = ?', [
      created.id_entrada,
    ]);
    expect(lotRows).toHaveLength(0);

    const [existenciaRows] = await pool.query('SELECT cantidad_disponible FROM inventario_existencias WHERE id_entrada_origen = ?', [
      created.id_entrada,
    ]);
    expect(existenciaRows).toHaveLength(1);
  });

  it('reutiliza la existencia y recalcula el costo promedio en una segunda entrada del mismo producto/proveedor', async () => {
    await handlers['entries.create']({
      id_proveedor: baseline.idProveedor,
      id_producto: baseline.idProductoTerminado,
      fecha_vencimiento: '2027-01-01',
      cantidad_disponible: 10,
      costo_unitario: 10,
      id_usuario_receptor: baseline.idUsuario,
    });

    const second = await handlers['entries.create']({
      id_proveedor: baseline.idProveedor,
      id_producto: baseline.idProductoTerminado,
      fecha_vencimiento: '2027-01-01',
      cantidad_disponible: 10,
      costo_unitario: 20,
      id_usuario_receptor: baseline.idUsuario,
    });

    const [existenciaRows] = await pool.query('SELECT COUNT(*) AS total FROM inventario_existencias WHERE id_producto = ? AND id_proveedor = ?', [
      baseline.idProductoTerminado,
      baseline.idProveedor,
    ]);
    expect(Number(existenciaRows[0].total)).toBe(1); // una sola existencia reutilizada, no dos

    const [movementRows] = await pool.query(
      "SELECT id_existencia FROM movimientos_inventario WHERE motivo = ?",
      [`Entrada de mercancia #${second.id_entrada}`]
    );
    const existenciaId = movementRows[0].id_existencia;

    const [avgRows] = await pool.query('SELECT costo_unitario FROM inventario_existencias WHERE id_existencia = ?', [
      existenciaId,
    ]);
    // promedio ponderado: (10*10 + 20*10) / 20 = 15
    expect(Number(avgRows[0].costo_unitario)).toBeCloseTo(15, 2);
  });
});

describe('entries.remove', () => {
  it('revierte movimientos, deja la existencia en cero y desactiva la entrada y el lote', async () => {
    const created = await handlers['entries.create']({
      id_proveedor: baseline.idProveedor,
      id_producto: baseline.idProductoMateriaPrima,
      fecha_vencimiento: '2027-01-01',
      cantidad_disponible: 100,
      costo_unitario: 5,
      id_usuario_receptor: baseline.idUsuario,
    });

    const result = await handlers['entries.remove']({ id: created.id_entrada, id_usuario_modificacion: baseline.idUsuario });
    expect(result).toBe(true);

    const [entryRows] = await pool.query('SELECT estado_registro FROM entradas_mercancia WHERE id_entrada = ?', [
      created.id_entrada,
    ]);
    expect(entryRows[0].estado_registro).toBe('Inactivo');

    const [lotRows] = await pool.query('SELECT estado_registro FROM lotes_materia_prima WHERE id_entrada_origen = ?', [
      created.id_entrada,
    ]);
    expect(lotRows[0].estado_registro).toBe('Inactivo');

    const [existenciaRows] = await pool.query(
      'SELECT cantidad_disponible, estado_registro FROM inventario_existencias WHERE id_producto = ? AND id_proveedor = ?',
      [baseline.idProductoMateriaPrima, baseline.idProveedor]
    );
    expect(Number(existenciaRows[0].cantidad_disponible)).toBe(0);
    expect(existenciaRows[0].estado_registro).toBe('Inactivo');
  });

  it('retorna false si la entrada no existe o ya esta inactiva', async () => {
    const result = await handlers['entries.remove']({ id: 999999, id_usuario_modificacion: baseline.idUsuario });
    expect(result).toBe(false);
  });
});
