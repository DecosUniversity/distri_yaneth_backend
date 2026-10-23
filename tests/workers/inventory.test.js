const { pool, resetDatabase, seedBaseline } = require('../helpers/db');
const { handlers } = require('../../src/workers/domains/inventory.worker.js');

let baseline;

beforeEach(async () => {
  await resetDatabase();
  baseline = await seedBaseline();
});

describe('inventory.findAll', () => {
  it('calcula el stock neto a partir de los movimientos (Entrada - Salida/Ajuste/Desperdicio)', async () => {
    const [existenciaResult] = await pool.query(
      `INSERT INTO inventario_existencias (id_producto, id_proveedor, fecha_vencimiento, cantidad_disponible, estado_registro)
       VALUES (?, ?, '2027-01-01', 0, 'Activo')`,
      [baseline.idProductoTerminado, baseline.idProveedor]
    );
    const idExistencia = existenciaResult.insertId;

    const insertMovement = (tipo, cantidad) =>
      pool.query(
        `INSERT INTO movimientos_inventario (id_existencia, tipo_movimiento, cantidad, motivo, estado_registro) VALUES (?, ?, ?, 'Prueba', 'Activo')`,
        [idExistencia, tipo, cantidad]
      );

    await insertMovement('Entrada', 100);
    await insertMovement('Salida', 20);
    await insertMovement('Ajuste', 5);
    await insertMovement('Desperdicio', 10);

    const rows = await handlers['inventory.findAll']();
    const row = rows.find((item) => item.id_existencia === idExistencia);

    expect(row).toBeDefined();
    expect(Number(row.cantidad_disponible)).toBe(65); // 100 - 20 - 5 - 10
  });

  it('incluye la fruta para produccion (sub-lotes activos) como una fila aparte', async () => {
    const [lotResult] = await pool.query(
      `INSERT INTO lotes_materia_prima (id_producto, id_proveedor, fecha_recepcion, peso_inicial_kg, estado_maduracion, estado_registro)
       VALUES (?, ?, CURRENT_DATE, 80, 'Verde', 'Activo')`,
      [baseline.idProductoMateriaPrima, baseline.idProveedor]
    );
    await pool.query(
      `INSERT INTO sublotes_maduracion (id_lote_mp, codigo_sublote, peso_inicial_kg, peso_kg, estado_maduracion, estado_registro)
       VALUES (?, 'A', 80, 80, 'Verde', 'Activo')`,
      [lotResult.insertId]
    );

    const rows = await handlers['inventory.findAll']();
    const frutaRow = rows.find((item) => item.id_lote_mp === lotResult.insertId);

    expect(frutaRow).toBeDefined();
    expect(frutaRow.tipo_producto).toBe('Fruta para produccion');
    expect(Number(frutaRow.cantidad_disponible)).toBe(80);
  });
});

describe('caducidad: inventory.expirationReport e inventory.writeOffExpired', () => {
  // Fechas relativas a hoy calculadas por la base de datos, para no depender del dia en que corre la prueba.
  const createExistencia = async ({ diasVencimiento, costo = 5 }) => {
    const [result] = await pool.query(
      `INSERT INTO inventario_existencias (id_producto, fecha_vencimiento, cantidad_disponible, costo_unitario, estado_registro)
       VALUES (?, DATE_ADD(CURDATE(), INTERVAL ? DAY), 0, ?, 'Activo')`,
      [baseline.idProductoTerminado, diasVencimiento, costo]
    );
    return result.insertId;
  };

  const insertMovement = (idExistencia, tipo, cantidad, diasDesdeHoy) =>
    pool.query(
      `INSERT INTO movimientos_inventario (id_existencia, tipo_movimiento, cantidad, motivo, fecha_movimiento, estado_registro)
       VALUES (?, ?, ?, 'Prueba', DATE_ADD(NOW(), INTERVAL ? DAY), 'Activo')`,
      [idExistencia, tipo, cantidad, diasDesdeHoy]
    );

  const totalLoss = (report) => report.perdida_mensual.reduce((sum, row) => sum + row.valor, 0);

  it('separa vencidos y por vencer, y mide la perdida con el saldo que quedo al vencer', async () => {
    // Vencio hace 10 dias con 70 sin despachar y luego se dio de baja: sigue contando como perdida.
    const idDadoDeBaja = await createExistencia({ diasVencimiento: -10 });
    await insertMovement(idDadoDeBaja, 'Entrada', 100, -40);
    await insertMovement(idDadoDeBaja, 'Salida', 30, -20);
    await insertMovement(idDadoDeBaja, 'Desperdicio', 70, -2);

    const idVencido = await createExistencia({ diasVencimiento: -5 });
    await insertMovement(idVencido, 'Entrada', 20, -30);

    const idPorVencer = await createExistencia({ diasVencimiento: 10 });
    await insertMovement(idPorVencer, 'Entrada', 15, -1);

    const idVigente = await createExistencia({ diasVencimiento: 90 });
    await insertMovement(idVigente, 'Entrada', 50, -1);

    const report = await handlers['inventory.expirationReport']({ months: 6 });

    expect(report.resumen.vencido).toEqual({ existencias: 1, valor: 100 }); // 20 x Q5
    expect(report.resumen.por_vencer).toEqual({ existencias: 1, valor: 75 }); // 15 x Q5
    expect(report.en_riesgo.map((row) => row.id_existencia)).toEqual([idVencido, idPorVencer]);
    expect(report.perdida_mensual).toHaveLength(6);
    expect(totalLoss(report)).toBe(450); // (70 + 20) x Q5; el vigente y el por vencer no son perdida
    expect(report.perdida_por_producto).toEqual([
      expect.objectContaining({ id_producto: baseline.idProductoTerminado, cantidad: 90, valor: 450 }),
    ]);
  });

  it('no cuenta como perdida lo que vencio pero se uso despues (p. ej. materia prima aceptada tarde)', async () => {
    const idUsadoTarde = await createExistencia({ diasVencimiento: -6 });
    await insertMovement(idUsadoTarde, 'Entrada', 100, -20);
    await insertMovement(idUsadoTarde, 'Salida', 30, -2); // salio despues de vencer: se uso

    const report = await handlers['inventory.expirationReport']({ months: 6 });

    expect(totalLoss(report)).toBe(350); // solo los 70 que nunca se usaron, x Q5
    expect(report.resumen.vencido).toEqual({ existencias: 1, valor: 350 });
  });

  it('da de baja todo el saldo de una existencia vencida y lo registra en auditoria', async () => {
    const idVencido = await createExistencia({ diasVencimiento: -3 });
    await insertMovement(idVencido, 'Entrada', 40, -15);

    const result = await handlers['inventory.writeOffExpired']({ id_existencia: idVencido, id_usuario: baseline.idUsuario });

    expect(result.cantidad_baja).toBe(40);

    const rows = await handlers['inventory.findAll']();
    expect(Number(rows.find((item) => item.id_existencia === idVencido).cantidad_disponible)).toBe(0);

    const [movements] = await pool.query(
      "SELECT motivo, id_usuario FROM movimientos_inventario WHERE id_existencia = ? AND tipo_movimiento = 'Desperdicio'",
      [idVencido]
    );
    expect(movements).toEqual([{ motivo: 'Baja por vencimiento', id_usuario: baseline.idUsuario }]);

    const [audit] = await pool.query(
      "SELECT id_usuario FROM auditoria_cambios WHERE tabla_afectada = 'movimientos_inventario' AND id_registro_afectado = ?",
      [String(result.id_movimiento)]
    );
    expect(audit).toHaveLength(1);

    // La baja no borra la perdida: se midio con el saldo al vencer.
    const report = await handlers['inventory.expirationReport']({ months: 6 });
    expect(totalLoss(report)).toBe(200);
    expect(report.en_riesgo).toHaveLength(0);
  });

  it('rechaza dar de baja una existencia vigente o sin stock', async () => {
    const idVigente = await createExistencia({ diasVencimiento: 5 });
    await insertMovement(idVigente, 'Entrada', 10, -1);

    await expect(
      handlers['inventory.writeOffExpired']({ id_existencia: idVigente, id_usuario: baseline.idUsuario })
    ).rejects.toThrow('Solo se puede dar de baja una existencia vencida');

    const idSinStock = await createExistencia({ diasVencimiento: -5 });
    await insertMovement(idSinStock, 'Entrada', 10, -20);
    await insertMovement(idSinStock, 'Salida', 10, -10);

    await expect(
      handlers['inventory.writeOffExpired']({ id_existencia: idSinStock, id_usuario: baseline.idUsuario })
    ).rejects.toThrow('La existencia no tiene stock para dar de baja');

    expect(await handlers['inventory.writeOffExpired']({ id_existencia: 999999, id_usuario: baseline.idUsuario })).toBeNull();
  });

  it('inventory.findByProduct no ofrece existencias vencidas', async () => {
    const idVencido = await createExistencia({ diasVencimiento: -1 });
    await insertMovement(idVencido, 'Entrada', 10, -10);
    const idVigente = await createExistencia({ diasVencimiento: 0 }); // vence hoy: aun se puede despachar
    await insertMovement(idVigente, 'Entrada', 10, -1);

    const rows = await handlers['inventory.findByProduct']({ id_producto: baseline.idProductoTerminado });
    expect(rows.map((row) => row.id_existencia)).toEqual([idVigente]);
  });
});
