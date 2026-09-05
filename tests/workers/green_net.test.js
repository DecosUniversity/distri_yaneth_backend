const { pool, resetDatabase, seedBaseline } = require('../helpers/db');
const { createActiveGreenSublot, createReadySublot } = require('../helpers/fixtures');
const { handlers } = require('../../src/workers/domains/green_net.worker.js');

let baseline;

beforeEach(async () => {
  await resetDatabase();
  baseline = await seedBaseline();
});

describe('greenNets.create - una caja', () => {
  it('empaca parte del peso: el sub-lote sigue Activo con el peso reducido', async () => {
    const { idSublote } = await createActiveGreenSublot({
      idProducto: baseline.idProductoMateriaPrima,
      idProveedor: baseline.idProveedor,
      pesoKg: 100,
    });

    const [caja] = await handlers['greenNets.create']({
      id_sublote: idSublote,
      id_producto: baseline.idProductoTerminado,
      cajas: [{ cantidad_redes: 15, peso_kg: 30 }],
      fecha_vencimiento: '2027-01-01',
      id_usuario: baseline.idUsuario,
    });

    expect(caja).not.toBeNull();
    expect(Number(caja.peso_kg)).toBe(30);
    expect(caja.cantidad_redes).toBe(15);

    const [sublotRows] = await pool.query('SELECT peso_kg, estado_registro FROM sublotes_maduracion WHERE id_sublote = ?', [
      idSublote,
    ]);
    expect(Number(sublotRows[0].peso_kg)).toBe(70);
    expect(sublotRows[0].estado_registro).toBe('Activo');
  });

  it('empaca todo el peso: el sub-lote pasa a Derivado a red', async () => {
    const { idSublote } = await createActiveGreenSublot({
      idProducto: baseline.idProductoMateriaPrima,
      idProveedor: baseline.idProveedor,
      pesoKg: 50,
    });

    await handlers['greenNets.create']({
      id_sublote: idSublote,
      id_producto: baseline.idProductoTerminado,
      cajas: [{ cantidad_redes: 25, peso_kg: 50 }],
      fecha_vencimiento: '2027-01-01',
      id_usuario: baseline.idUsuario,
    });

    const [sublotRows] = await pool.query('SELECT peso_kg, estado_registro FROM sublotes_maduracion WHERE id_sublote = ?', [
      idSublote,
    ]);
    expect(Number(sublotRows[0].peso_kg)).toBe(0);
    expect(sublotRows[0].estado_registro).toBe('Derivado a red');
  });

  it('rechaza empacar un sub-lote que no esta Verde', async () => {
    const { idSublote } = await createReadySublot({
      idProducto: baseline.idProductoMateriaPrima,
      idProveedor: baseline.idProveedor,
      pesoKg: 100,
    });

    await expect(
      handlers['greenNets.create']({
        id_sublote: idSublote,
        id_producto: baseline.idProductoTerminado,
        cajas: [{ cantidad_redes: 5, peso_kg: 10 }],
        fecha_vencimiento: '2027-01-01',
        id_usuario: baseline.idUsuario,
      })
    ).rejects.toThrow(/debe estar Verde y activo/);
  });

  it('rechaza empacar mas peso del disponible', async () => {
    const { idSublote } = await createActiveGreenSublot({
      idProducto: baseline.idProductoMateriaPrima,
      idProveedor: baseline.idProveedor,
      pesoKg: 20,
    });

    await expect(
      handlers['greenNets.create']({
        id_sublote: idSublote,
        id_producto: baseline.idProductoTerminado,
        cajas: [{ cantidad_redes: 10, peso_kg: 50 }],
        fecha_vencimiento: '2027-01-01',
        id_usuario: baseline.idUsuario,
      })
    ).rejects.toThrow(/supera el peso disponible/);
  });

  it('rechaza si no se envia ninguna caja', async () => {
    const { idSublote } = await createActiveGreenSublot({
      idProducto: baseline.idProductoMateriaPrima,
      idProveedor: baseline.idProveedor,
      pesoKg: 20,
    });

    await expect(
      handlers['greenNets.create']({
        id_sublote: idSublote,
        id_producto: baseline.idProductoTerminado,
        cajas: [],
        fecha_vencimiento: '2027-01-01',
        id_usuario: baseline.idUsuario,
      })
    ).rejects.toThrow(/al menos una caja/);
  });

  it('rechaza una caja con cantidad de redes invalida', async () => {
    const { idSublote } = await createActiveGreenSublot({
      idProducto: baseline.idProductoMateriaPrima,
      idProveedor: baseline.idProveedor,
      pesoKg: 20,
    });

    await expect(
      handlers['greenNets.create']({
        id_sublote: idSublote,
        id_producto: baseline.idProductoTerminado,
        cajas: [{ cantidad_redes: 0, peso_kg: 10 }],
        fecha_vencimiento: '2027-01-01',
        id_usuario: baseline.idUsuario,
      })
    ).rejects.toThrow(/cantidad de redes mayor a 0/);
  });

  it('reutiliza la misma existencia para un segundo empaque del mismo producto/proveedor', async () => {
    const sublot1 = await createActiveGreenSublot({
      idProducto: baseline.idProductoMateriaPrima,
      idProveedor: baseline.idProveedor,
      pesoKg: 20,
    });
    const sublot2 = await createActiveGreenSublot({
      idProducto: baseline.idProductoMateriaPrima,
      idProveedor: baseline.idProveedor,
      pesoKg: 15,
    });

    const [caja1] = await handlers['greenNets.create']({
      id_sublote: sublot1.idSublote,
      id_producto: baseline.idProductoTerminado,
      cajas: [{ cantidad_redes: 10, peso_kg: 20 }],
      fecha_vencimiento: '2027-01-01',
      id_usuario: baseline.idUsuario,
    });
    const [caja2] = await handlers['greenNets.create']({
      id_sublote: sublot2.idSublote,
      id_producto: baseline.idProductoTerminado,
      cajas: [{ cantidad_redes: 8, peso_kg: 15 }],
      fecha_vencimiento: '2027-01-01',
      id_usuario: baseline.idUsuario,
    });

    expect(caja1.id_existencia).toBe(caja2.id_existencia);

    const [movementRows] = await pool.query(
      "SELECT SUM(cantidad) AS total FROM movimientos_inventario WHERE id_existencia = ? AND tipo_movimiento = 'Entrada'",
      [caja1.id_existencia]
    );
    expect(Number(movementRows[0].total)).toBe(35);
  });
});

describe('greenNets.create - varias cajas en un solo envio', () => {
  it('registra varias cajas de una vez, cada una con su propia fila y movimiento', async () => {
    const { idSublote } = await createActiveGreenSublot({
      idProducto: baseline.idProductoMateriaPrima,
      idProveedor: baseline.idProveedor,
      pesoKg: 500,
    });

    const cajasCreadas = await handlers['greenNets.create']({
      id_sublote: idSublote,
      id_producto: baseline.idProductoTerminado,
      cajas: [
        { cantidad_redes: 50, peso_kg: 25 },
        { cantidad_redes: 50, peso_kg: 24.5 },
        { cantidad_redes: 50, peso_kg: 25.2 },
      ],
      fecha_vencimiento: '2027-01-01',
      id_usuario: baseline.idUsuario,
    });

    expect(cajasCreadas).toHaveLength(3);
    expect(cajasCreadas.map((c) => c.cantidad_redes)).toEqual([50, 50, 50]);

    const [redRows] = await pool.query('SELECT COUNT(*) AS total, SUM(cantidad_redes) AS totalRedes FROM redes_verde_detalle WHERE id_sublote = ?', [
      idSublote,
    ]);
    expect(Number(redRows[0].total)).toBe(3);
    expect(Number(redRows[0].totalRedes)).toBe(150);

    const [movementRows] = await pool.query(
      "SELECT COUNT(*) AS total FROM movimientos_inventario WHERE tipo_movimiento = 'Entrada' AND motivo LIKE ?",
      [`Red platano verde - sublote #${idSublote}%`]
    );
    expect(Number(movementRows[0].total)).toBe(3);

    const [sublotRows] = await pool.query('SELECT peso_kg FROM sublotes_maduracion WHERE id_sublote = ?', [idSublote]);
    expect(Number(sublotRows[0].peso_kg)).toBeCloseTo(500 - (25 + 24.5 + 25.2), 2);
  });

  it('si una caja del lote es invalida, no se registra ninguna (todo o nada)', async () => {
    const { idSublote } = await createActiveGreenSublot({
      idProducto: baseline.idProductoMateriaPrima,
      idProveedor: baseline.idProveedor,
      pesoKg: 100,
    });

    await expect(
      handlers['greenNets.create']({
        id_sublote: idSublote,
        id_producto: baseline.idProductoTerminado,
        cajas: [
          { cantidad_redes: 50, peso_kg: 25 },
          { cantidad_redes: 50, peso_kg: 0 }, // invalida
        ],
        fecha_vencimiento: '2027-01-01',
        id_usuario: baseline.idUsuario,
      })
    ).rejects.toThrow(/caja 2 debe tener un peso mayor a 0/);

    const [redRows] = await pool.query('SELECT COUNT(*) AS total FROM redes_verde_detalle WHERE id_sublote = ?', [idSublote]);
    expect(Number(redRows[0].total)).toBe(0);

    const [sublotRows] = await pool.query('SELECT peso_kg FROM sublotes_maduracion WHERE id_sublote = ?', [idSublote]);
    expect(Number(sublotRows[0].peso_kg)).toBe(100); // sin cambios
  });
});
