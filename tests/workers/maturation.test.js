const { pool, resetDatabase, seedBaseline } = require('../helpers/db');
const { handlers } = require('../../src/workers/domains/maturation.worker.js');

let baseline;

const createPendingLot = async (pesoInicialKg = 100) =>
  handlers['maturationLots.create']({
    id_producto: baseline.idProductoMateriaPrima,
    id_proveedor: baseline.idProveedor,
    id_entrada_origen: null,
    fecha_recepcion: '2026-08-01',
    cantidad_unidades: 20,
    peso_inicial_kg: pesoInicialKg,
    id_usuario_modificacion: baseline.idUsuario,
  });

const seedExistencia = async (cantidadDisponible) => {
  const [result] = await pool.query(
    `INSERT INTO inventario_existencias (id_producto, id_proveedor, fecha_vencimiento, cantidad_disponible, estado_registro)
     VALUES (?, ?, '2027-01-01', ?, 'Activo')`,
    [baseline.idProductoMateriaPrima, baseline.idProveedor, cantidadDisponible]
  );
  await pool.query(
    `INSERT INTO movimientos_inventario (id_existencia, tipo_movimiento, cantidad, motivo, estado_registro) VALUES (?, 'Entrada', ?, 'Siembra de prueba', 'Activo')`,
    [result.insertId, cantidadDisponible]
  );
  return result.insertId;
};

beforeEach(async () => {
  await resetDatabase();
  baseline = await seedBaseline();
});

describe('maturationLots.accept', () => {
  it('acepta como Maduro y crea el sub-lote directo a Listo para produccion', async () => {
    const lot = await createPendingLot(100);
    await seedExistencia(100);

    const sublote = await handlers['maturationLots.accept']({
      id: lot.id_lote_mp,
      estado_maduracion: 'Maduro',
      id_usuario_modificacion: baseline.idUsuario,
    });

    expect(sublote).not.toBeNull();
    expect(sublote.estado_registro).toBe('Listo para produccion');
    expect(Number(sublote.peso_neto_maduracion_kg)).toBe(100);
    expect(Number(sublote.perdida_maduracion_kg)).toBe(0);

    const [existenciaRows] = await pool.query(
      'SELECT id_existencia FROM inventario_existencias WHERE id_producto = ? AND id_proveedor = ?',
      [baseline.idProductoMateriaPrima, baseline.idProveedor]
    );
    const [salidaRows] = await pool.query(
      "SELECT cantidad FROM movimientos_inventario WHERE id_existencia = ? AND tipo_movimiento = 'Salida'",
      [existenciaRows[0].id_existencia]
    );
    expect(salidaRows).toHaveLength(1);
    expect(Number(salidaRows[0].cantidad)).toBe(100);
  });

  it('acepta como Verde y crea el sub-lote activo (sin peso neto todavia)', async () => {
    const lot = await createPendingLot(50);

    const sublote = await handlers['maturationLots.accept']({
      id: lot.id_lote_mp,
      estado_maduracion: 'Verde',
      id_usuario_modificacion: baseline.idUsuario,
    });

    expect(sublote.estado_registro).toBe('Activo');
    expect(sublote.peso_neto_maduracion_kg).toBeNull();
  });

  it('rechaza aceptar un lote que ya no esta Pendiente', async () => {
    const lot = await createPendingLot(50);
    await handlers['maturationLots.accept']({
      id: lot.id_lote_mp,
      estado_maduracion: 'Verde',
      id_usuario_modificacion: baseline.idUsuario,
    });

    const result = await handlers['maturationLots.accept']({
      id: lot.id_lote_mp,
      estado_maduracion: 'Verde',
      id_usuario_modificacion: baseline.idUsuario,
    });

    expect(result).toBeNull();
  });
});

describe('maturationSublots.split', () => {
  it('fracciona el peso y las unidades proporcionalmente', async () => {
    const lot = await createPendingLot(100);
    const sublote = await handlers['maturationLots.accept']({
      id: lot.id_lote_mp,
      estado_maduracion: 'Verde',
      id_usuario_modificacion: baseline.idUsuario,
    });

    const { origen, nuevo } = await handlers['maturationSublots.split']({
      id: sublote.id_sublote,
      peso_kg: 40,
      id_usuario_modificacion: baseline.idUsuario,
    });

    expect(Number(origen.peso_kg)).toBe(60);
    expect(Number(nuevo.peso_kg)).toBe(40);
    expect(nuevo.codigo_sublote).toBe('A2');
    // 20 unidades originales -> 40/100 = 40% -> 8 unidades al nuevo, 12 al origen
    expect(origen.cantidad_unidades).toBe(12);
    expect(nuevo.cantidad_unidades).toBe(8);
  });

  it('rechaza fraccionar mas peso del disponible', async () => {
    const lot = await createPendingLot(50);
    const sublote = await handlers['maturationLots.accept']({
      id: lot.id_lote_mp,
      estado_maduracion: 'Verde',
      id_usuario_modificacion: baseline.idUsuario,
    });

    await expect(
      handlers['maturationSublots.split']({ id: sublote.id_sublote, peso_kg: 999, id_usuario_modificacion: baseline.idUsuario })
    ).rejects.toThrow(/supera el peso disponible/);
  });
});

describe('maturationSublots.close', () => {
  it('cierra la maduracion con el peso medido y calcula la perdida', async () => {
    const lot = await createPendingLot(100);
    const sublote = await handlers['maturationLots.accept']({
      id: lot.id_lote_mp,
      estado_maduracion: 'Verde',
      id_usuario_modificacion: baseline.idUsuario,
    });

    const closed = await handlers['maturationSublots.close']({
      id: sublote.id_sublote,
      peso_medido_kg: 92,
      id_usuario_modificacion: baseline.idUsuario,
    });

    expect(closed.estado_registro).toBe('Listo para produccion');
    expect(Number(closed.peso_neto_maduracion_kg)).toBe(92);
    expect(Number(closed.perdida_maduracion_kg)).toBe(8);
  });

  it('rechaza cerrar si el peso medido supera el peso disponible', async () => {
    const lot = await createPendingLot(50);
    const sublote = await handlers['maturationLots.accept']({
      id: lot.id_lote_mp,
      estado_maduracion: 'Verde',
      id_usuario_modificacion: baseline.idUsuario,
    });

    await expect(
      handlers['maturationSublots.close']({ id: sublote.id_sublote, peso_medido_kg: 999, id_usuario_modificacion: baseline.idUsuario })
    ).rejects.toThrow(/no puede ser mayor al peso disponible/);
  });
});

describe('maturationControls.create', () => {
  it('promueve automaticamente el sub-lote cuando el brix alcanza el umbral', async () => {
    const lot = await createPendingLot(100);
    const sublote = await handlers['maturationLots.accept']({
      id: lot.id_lote_mp,
      estado_maduracion: 'Verde',
      id_usuario_modificacion: baseline.idUsuario,
    });

    const control = await handlers['maturationControls.create']({
      id_sublote: sublote.id_sublote,
      grados_brix: 22, // MATURATION_BRIX_THRESHOLD en .env.test
      peso_medido_kg: 88,
      id_usuario_modificacion: baseline.idUsuario,
    });

    expect(control.sublote_promovido).toBe(true);

    const [sublotRows] = await pool.query('SELECT estado_registro FROM sublotes_maduracion WHERE id_sublote = ?', [
      sublote.id_sublote,
    ]);
    expect(sublotRows[0].estado_registro).toBe('Listo para produccion');
  });

  it('no promueve el sub-lote si el brix no alcanza el umbral', async () => {
    const lot = await createPendingLot(100);
    const sublote = await handlers['maturationLots.accept']({
      id: lot.id_lote_mp,
      estado_maduracion: 'Verde',
      id_usuario_modificacion: baseline.idUsuario,
    });

    const control = await handlers['maturationControls.create']({
      id_sublote: sublote.id_sublote,
      grados_brix: 15,
      peso_medido_kg: 95,
      id_usuario_modificacion: baseline.idUsuario,
    });

    expect(control.sublote_promovido).toBe(false);

    const [sublotRows] = await pool.query('SELECT estado_registro FROM sublotes_maduracion WHERE id_sublote = ?', [
      sublote.id_sublote,
    ]);
    expect(sublotRows[0].estado_registro).toBe('Activo');
  });
});
