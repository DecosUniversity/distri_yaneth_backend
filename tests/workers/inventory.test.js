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
