const { pool, resetDatabase, seedBaseline } = require('../helpers/db');
const { createReadySublot } = require('../helpers/fixtures');
const { handlers } = require('../../src/workers/domains/production.worker.js');
const { handlers: productionOrderHandlers } = require('../../src/workers/domains/production_order.worker.js');

let baseline;

const startProcess = async (pesoKg = 100, { idOrden } = {}) => {
  const { idSublote } = await createReadySublot({
    idProducto: baseline.idProductoMateriaPrima,
    idProveedor: baseline.idProveedor,
    pesoKg,
  });

  return handlers['productionProcesses.create']({
    id_sublote: idSublote,
    id_producto_resultado: baseline.idProductoTerminado,
    id_orden: idOrden ?? null,
    cantidad_ingresada_kg: pesoKg,
    fecha_inicio: null,
    id_usuario_registro: baseline.idUsuario,
  });
};

const addMerma = async (idProceso, cantidadKg) =>
  handlers['productionProcesses.addMerma']({
    id: idProceso,
    id_etapa: null,
    id_tipo_merma: baseline.idTipoMerma,
    cantidad_kg: cantidadKg,
    id_usuario_modificacion: baseline.idUsuario,
  });

beforeEach(async () => {
  await resetDatabase();
  baseline = await seedBaseline();
});

describe('productionProcesses.finalize - balance de masa', () => {
  it('finaliza sin problema cuando ingresado - mermas = producido exacto', async () => {
    const process = await startProcess(100);
    await addMerma(process.id_proceso, 10);

    const finalized = await handlers['productionProcesses.finalize']({
      id: process.id_proceso,
      cantidad_producida_kg: 90,
      fecha_fin: new Date(),
      fecha_vencimiento: '2027-01-01',
      id_usuario_modificacion: baseline.idUsuario,
    });

    expect(finalized.estado_proceso).toBe('Finalizado');
    expect(Number(finalized.diferencia_kg)).toBeCloseTo(0, 2);
    expect(finalized.justificacion_diferencia).toBeNull();
  });

  it('rechaza finalizar si el peso no cuadra y no hay justificacion', async () => {
    const process = await startProcess(100);
    await addMerma(process.id_proceso, 10);

    await expect(
      handlers['productionProcesses.finalize']({
        id: process.id_proceso,
        cantidad_producida_kg: 80, // se esperaban 90 (100 - 10 de merma)
        fecha_fin: new Date(),
        id_usuario_modificacion: baseline.idUsuario,
      })
    ).rejects.toThrow(/El peso no cuadra/);

    // Debe seguir "En proceso": el rollback de la transaccion debe haber revertido todo.
    const [rows] = await pool.query('SELECT estado_proceso FROM procesos_produccion WHERE id_proceso = ?', [
      process.id_proceso,
    ]);
    expect(rows[0].estado_proceso).toBe('En proceso');
  });

  it('permite finalizar con diferencia si se justifica', async () => {
    const process = await startProcess(100);
    await addMerma(process.id_proceso, 10);

    const finalized = await handlers['productionProcesses.finalize']({
      id: process.id_proceso,
      cantidad_producida_kg: 80,
      fecha_fin: new Date(),
      fecha_vencimiento: '2027-01-01',
      justificacion_diferencia: 'Se quemo parte del lote en la fritura',
      id_usuario_modificacion: baseline.idUsuario,
    });

    expect(finalized.estado_proceso).toBe('Finalizado');
    expect(Number(finalized.diferencia_kg)).toBeCloseTo(10, 2);
    expect(finalized.justificacion_diferencia).toBe('Se quemo parte del lote en la fritura');
  });

  it('crea/actualiza la existencia de inventario con el producto terminado al finalizar', async () => {
    const process = await startProcess(100);

    await handlers['productionProcesses.finalize']({
      id: process.id_proceso,
      cantidad_producida_kg: 100,
      fecha_fin: new Date(),
      fecha_vencimiento: '2027-01-01',
      id_usuario_modificacion: baseline.idUsuario,
    });

    const [existencias] = await pool.query(
      'SELECT * FROM inventario_existencias WHERE id_proceso_origen = ? AND id_producto = ?',
      [process.id_proceso, baseline.idProductoTerminado]
    );
    expect(existencias).toHaveLength(1);

    const [movimientos] = await pool.query(
      "SELECT * FROM movimientos_inventario WHERE id_existencia = ? AND tipo_movimiento = 'Entrada'",
      [existencias[0].id_existencia]
    );
    expect(Number(movimientos[0].cantidad)).toBe(100);
  });

  it('rechaza finalizar dos veces el mismo proceso', async () => {
    const process = await startProcess(100);

    await handlers['productionProcesses.finalize']({
      id: process.id_proceso,
      cantidad_producida_kg: 100,
      fecha_fin: new Date(),
      fecha_vencimiento: '2027-01-01',
      id_usuario_modificacion: baseline.idUsuario,
    });

    await expect(
      handlers['productionProcesses.finalize']({
        id: process.id_proceso,
        cantidad_producida_kg: 50,
        fecha_fin: new Date(),
        id_usuario_modificacion: baseline.idUsuario,
      })
    ).rejects.toThrow(/ya fue finalizado/);
  });

  it('rechaza que lo producido supere lo ingresado', async () => {
    const process = await startProcess(100);

    await expect(
      handlers['productionProcesses.finalize']({
        id: process.id_proceso,
        cantidad_producida_kg: 150,
        fecha_fin: new Date(),
        id_usuario_modificacion: baseline.idUsuario,
      })
    ).rejects.toThrow(/no puede superar/);
  });
});

describe('productionProcesses.revert', () => {
  it('revierte un proceso sin etapas/mermas/insumos y restaura el peso del sub-lote', async () => {
    const process = await startProcess(100);

    const result = await handlers['productionProcesses.revert']({
      id: process.id_proceso,
      id_usuario_modificacion: baseline.idUsuario,
    });

    expect(result).toBe(true);

    const [processRows] = await pool.query('SELECT estado_registro FROM procesos_produccion WHERE id_proceso = ?', [
      process.id_proceso,
    ]);
    expect(processRows[0].estado_registro).toBe('Inactivo');

    const [sublotRows] = await pool.query(
      'SELECT peso_kg, estado_registro FROM sublotes_maduracion WHERE id_sublote = ?',
      [process.id_sublote]
    );
    expect(Number(sublotRows[0].peso_kg)).toBe(100);
    expect(sublotRows[0].estado_registro).toBe('Listo para produccion');
  });

  it('rechaza revertir sin declarar peso ni justificacion si ya hay una etapa registrada', async () => {
    const process = await startProcess(100);

    await handlers['productionProcesses.addStage']({
      id: process.id_proceso,
      id_tipo_etapa: baseline.idTipoEtapa,
      cantidad_personas: 2,
      fecha_inicio: new Date(),
      id_usuario_modificacion: baseline.idUsuario,
    });

    await expect(
      handlers['productionProcesses.revert']({ id: process.id_proceso, id_usuario_modificacion: baseline.idUsuario })
    ).rejects.toThrow(/Debes declarar el peso a revertir/);

    // El sub-lote no debe haberse tocado.
    const [sublotRows] = await pool.query('SELECT peso_kg FROM sublotes_maduracion WHERE id_sublote = ?', [
      process.id_sublote,
    ]);
    expect(Number(sublotRows[0].peso_kg)).toBe(0);
  });

  it('rechaza revertir con peso declarado pero sin justificacion', async () => {
    const process = await startProcess(100);
    await addMerma(process.id_proceso, 10);

    await expect(
      handlers['productionProcesses.revert']({
        id: process.id_proceso,
        peso_a_revertir: 90,
        id_usuario_modificacion: baseline.idUsuario,
      })
    ).rejects.toThrow(/Debes justificar la reversion/);
  });

  it('rechaza revertir si el peso declarado no cuadra con ingresado - mermas', async () => {
    const process = await startProcess(100);
    await addMerma(process.id_proceso, 10);

    await expect(
      handlers['productionProcesses.revert']({
        id: process.id_proceso,
        peso_a_revertir: 70, // deberian ser 90 (100 - 10 de merma)
        justificacion_reversion: 'Se cancela el lote',
        id_usuario_modificacion: baseline.idUsuario,
      })
    ).rejects.toThrow(/El peso no cuadra/);
  });

  it('permite revertir con etapas/mermas si el peso declarado cuadra y hay justificacion', async () => {
    const process = await startProcess(100);

    await handlers['productionProcesses.addStage']({
      id: process.id_proceso,
      id_tipo_etapa: baseline.idTipoEtapa,
      cantidad_personas: 2,
      fecha_inicio: new Date(),
      id_usuario_modificacion: baseline.idUsuario,
    });
    await addMerma(process.id_proceso, 10);

    const result = await handlers['productionProcesses.revert']({
      id: process.id_proceso,
      peso_a_revertir: 90, // 100 ingresado - 10 de merma
      justificacion_reversion: 'Se daño el equipo, no se continua con este lote',
      id_usuario_modificacion: baseline.idUsuario,
    });

    expect(result).toBe(true);

    const [processRows] = await pool.query(
      'SELECT estado_registro, justificacion_reversion FROM procesos_produccion WHERE id_proceso = ?',
      [process.id_proceso]
    );
    expect(processRows[0].estado_registro).toBe('Inactivo');
    expect(processRows[0].justificacion_reversion).toBe('Se daño el equipo, no se continua con este lote');

    const [sublotRows] = await pool.query(
      'SELECT peso_kg, estado_registro FROM sublotes_maduracion WHERE id_sublote = ?',
      [process.id_sublote]
    );
    expect(Number(sublotRows[0].peso_kg)).toBe(90);
    expect(sublotRows[0].estado_registro).toBe('Listo para produccion');
  });

  it('rechaza revertir un proceso ya finalizado', async () => {
    const process = await startProcess(100);

    await handlers['productionProcesses.finalize']({
      id: process.id_proceso,
      cantidad_producida_kg: 100,
      fecha_fin: new Date(),
      fecha_vencimiento: '2027-01-01',
      id_usuario_modificacion: baseline.idUsuario,
    });

    await expect(
      handlers['productionProcesses.revert']({ id: process.id_proceso, id_usuario_modificacion: baseline.idUsuario })
    ).rejects.toThrow(/ya fue finalizado y no puede revertirse/);
  });
});

describe('ordenes de produccion: guias a producir', () => {
  it('un proceso sin id_orden no toca ninguna orden', async () => {
    const process = await startProcess(50);
    expect(process.id_orden).toBeNull();
  });

  it('al crear un proceso con id_orden, la orden pasa de Pendiente a En Proceso', async () => {
    const order = await productionOrderHandlers['productionOrders.create']({
      id_producto: baseline.idProductoTerminado,
      cantidad_solicitada_kg: 50,
      fecha_solicitada: null,
      observaciones: null,
      id_usuario_creacion: baseline.idUsuario,
    });
    expect(order.estado).toBe('Pendiente');

    const process = await startProcess(50, { idOrden: order.id_orden });
    expect(process.id_orden).toBe(order.id_orden);

    const updatedOrder = await productionOrderHandlers['productionOrders.findById']({ id: order.id_orden });
    expect(updatedOrder.estado).toBe('En Proceso');
  });

  it('rechaza vincular un proceso a una orden de un producto distinto', async () => {
    const otherProduct = await pool.query(
      "INSERT INTO productos (nombre, unidad_medida, tipo_producto, estado_registro) VALUES ('Otro producto terminado', 'kg', 'Producto Terminado', 'Activo')"
    );
    const idOtroProducto = otherProduct[0].insertId;

    const order = await productionOrderHandlers['productionOrders.create']({
      id_producto: idOtroProducto,
      cantidad_solicitada_kg: 50,
      fecha_solicitada: null,
      observaciones: null,
      id_usuario_creacion: baseline.idUsuario,
    });

    await expect(startProcess(50, { idOrden: order.id_orden })).rejects.toThrow(
      'El producto del proceso no coincide con el producto de la orden de produccion'
    );
  });

  it('al finalizar el proceso, la orden acumula lo producido y se completa si alcanza lo solicitado', async () => {
    const order = await productionOrderHandlers['productionOrders.create']({
      id_producto: baseline.idProductoTerminado,
      cantidad_solicitada_kg: 40,
      fecha_solicitada: null,
      observaciones: null,
      id_usuario_creacion: baseline.idUsuario,
    });

    const process = await startProcess(50, { idOrden: order.id_orden });

    await handlers['productionProcesses.finalize']({
      id: process.id_proceso,
      cantidad_producida_kg: 45,
      fecha_fin: new Date(),
      fecha_vencimiento: '2027-01-01',
      justificacion_diferencia: 'Merma no categorizada para la prueba',
      id_usuario_modificacion: baseline.idUsuario,
    });

    const updatedOrder = await productionOrderHandlers['productionOrders.findById']({ id: order.id_orden });
    expect(Number(updatedOrder.cantidad_producida_kg)).toBe(45);
    expect(updatedOrder.estado).toBe('Completada');
  });

  it('si lo producido no alcanza lo solicitado, la orden se queda En Proceso', async () => {
    const order = await productionOrderHandlers['productionOrders.create']({
      id_producto: baseline.idProductoTerminado,
      cantidad_solicitada_kg: 100,
      fecha_solicitada: null,
      observaciones: null,
      id_usuario_creacion: baseline.idUsuario,
    });

    const process = await startProcess(50, { idOrden: order.id_orden });

    await handlers['productionProcesses.finalize']({
      id: process.id_proceso,
      cantidad_producida_kg: 45,
      fecha_fin: new Date(),
      fecha_vencimiento: '2027-01-01',
      justificacion_diferencia: 'Merma no categorizada para la prueba',
      id_usuario_modificacion: baseline.idUsuario,
    });

    const updatedOrder = await productionOrderHandlers['productionOrders.findById']({ id: order.id_orden });
    expect(Number(updatedOrder.cantidad_producida_kg)).toBe(45);
    expect(updatedOrder.estado).toBe('En Proceso');
  });

  it('cancela una orden Pendiente pero rechaza cancelar una que ya esta En Proceso', async () => {
    const order = await productionOrderHandlers['productionOrders.create']({
      id_producto: baseline.idProductoTerminado,
      cantidad_solicitada_kg: 30,
      fecha_solicitada: null,
      observaciones: null,
      id_usuario_creacion: baseline.idUsuario,
    });

    const otherOrder = await productionOrderHandlers['productionOrders.create']({
      id_producto: baseline.idProductoTerminado,
      cantidad_solicitada_kg: 30,
      fecha_solicitada: null,
      observaciones: null,
      id_usuario_creacion: baseline.idUsuario,
    });
    await startProcess(30, { idOrden: otherOrder.id_orden });

    const cancelled = await productionOrderHandlers['productionOrders.cancel']({
      id: order.id_orden,
      id_usuario_modificacion: baseline.idUsuario,
    });
    expect(cancelled.estado).toBe('Cancelada');

    const cannotCancel = await productionOrderHandlers['productionOrders.cancel']({
      id: otherOrder.id_orden,
      id_usuario_modificacion: baseline.idUsuario,
    });
    expect(cannotCancel).toBeNull();
  });
});
