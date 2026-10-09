const { pool, resetDatabase, seedBaseline } = require('../helpers/db');
const { createActiveGreenSublot, createReadySublot } = require('../helpers/fixtures');
const { handlers } = require('../../src/workers/domains/production.worker.js');

// El empaque de redes se estandarizo dentro de Produccion: un sub-lote Verde aun Activo (no
// solo uno Listo para produccion) puede iniciar un proceso, y una etapa puede traer un
// desglose de cajas (redes_verde_detalle -> etapas_empaque_detalle). Ver [[stage_requirements_feature]]
// para el resto del pipeline (mermas, insumos, balance de masa, finalizar) que aplica igual aqui.
let baseline;

beforeEach(async () => {
  await resetDatabase();
  baseline = await seedBaseline();
});

const startGreenProcess = async (pesoKg = 100, cantidadIngresada = pesoKg) => {
  const { idSublote } = await createActiveGreenSublot({
    idProducto: baseline.idProductoMateriaPrima,
    idProveedor: baseline.idProveedor,
    pesoKg,
  });

  return handlers['productionProcesses.create']({
    id_sublote: idSublote,
    id_producto_resultado: baseline.idProductoTerminado,
    cantidad_ingresada_kg: cantidadIngresada,
    id_usuario_registro: baseline.idUsuario,
  }).then((process) => ({ process, idSublote }));
};

describe('productionProcesses.create - acepta sub-lotes Verde y Activo (empaque en red)', () => {
  it('inicia un proceso con un sub-lote Verde/Activo, no solo Listo para produccion', async () => {
    const { process, idSublote } = await startGreenProcess(100, 30);

    expect(process).not.toBeNull();
    expect(process.estado_proceso).toBe('En proceso');

    const [sublotRows] = await pool.query('SELECT peso_kg, estado_registro FROM sublotes_maduracion WHERE id_sublote = ?', [
      idSublote,
    ]);
    expect(Number(sublotRows[0].peso_kg)).toBe(70);
    // Sigue Activo (no "madura" solo por empacar parte de el en red).
    expect(sublotRows[0].estado_registro).toBe('Activo');
  });

  it('si se consume todo el peso, el sub-lote Verde pasa a Enviado a produccion', async () => {
    const { idSublote } = await startGreenProcess(50, 50);

    const [sublotRows] = await pool.query('SELECT estado_registro FROM sublotes_maduracion WHERE id_sublote = ?', [idSublote]);
    expect(sublotRows[0].estado_registro).toBe('Enviado a produccion');
  });

  it('rechaza un sub-lote Activo que no esta Verde (ej. Sarazo, aun madurando)', async () => {
    const { idSublote } = await createActiveGreenSublot({
      idProducto: baseline.idProductoMateriaPrima,
      idProveedor: baseline.idProveedor,
      pesoKg: 50,
    });
    await pool.query("UPDATE sublotes_maduracion SET estado_maduracion = 'Sarazo' WHERE id_sublote = ?", [idSublote]);

    const process = await handlers['productionProcesses.create']({
      id_sublote: idSublote,
      id_producto_resultado: baseline.idProductoTerminado,
      cantidad_ingresada_kg: 20,
      id_usuario_registro: baseline.idUsuario,
    });

    expect(process).toBeNull();
  });

  it('un sub-lote Listo para produccion sigue funcionando igual que antes', async () => {
    const { idSublote } = await createReadySublot({
      idProducto: baseline.idProductoMateriaPrima,
      idProveedor: baseline.idProveedor,
      pesoKg: 80,
    });

    const process = await handlers['productionProcesses.create']({
      id_sublote: idSublote,
      id_producto_resultado: baseline.idProductoTerminado,
      cantidad_ingresada_kg: 80,
      id_usuario_registro: baseline.idUsuario,
    });

    expect(process).not.toBeNull();
  });
});

describe('productionProcesses.addStage / updateStage - desglose de cajas', () => {
  it('registra varias cajas al agregar una etapa, y las devuelve junto con la etapa', async () => {
    const { process } = await startGreenProcess(100);

    const stage = await handlers['productionProcesses.addStage']({
      id: process.id_proceso,
      id_tipo_etapa: baseline.idTipoEtapa,
      cantidad_personas: 2,
      fecha_inicio: new Date(),
      cajas: [
        { cantidad_redes: 50, peso_kg: 25 },
        { cantidad_redes: 50, peso_kg: 24.5 },
      ],
      id_usuario_modificacion: baseline.idUsuario,
    });

    expect(stage.cajas).toHaveLength(2);
    expect(stage.cajas.map((c) => c.cantidad_redes)).toEqual([50, 50]);

    const detail = await handlers['productionProcesses.findById']({ id: process.id_proceso });
    const etapa = detail.etapas.find((e) => e.id_etapa === stage.id_etapa);
    expect(etapa.cajas).toHaveLength(2);
  });

  it('addStage sin cajas no crea ningun desglose (etapa normal, sin empaque)', async () => {
    const { process } = await startGreenProcess(100);

    const stage = await handlers['productionProcesses.addStage']({
      id: process.id_proceso,
      id_tipo_etapa: baseline.idTipoEtapa,
      cantidad_personas: 2,
      fecha_inicio: new Date(),
      id_usuario_modificacion: baseline.idUsuario,
    });

    expect(stage.cajas).toEqual([]);
  });

  it('updateStage reemplaza el desglose de cajas cuando se envia', async () => {
    const { process } = await startGreenProcess(100);
    const stage = await handlers['productionProcesses.addStage']({
      id: process.id_proceso,
      id_tipo_etapa: baseline.idTipoEtapa,
      cantidad_personas: 2,
      fecha_inicio: new Date(),
      cajas: [{ cantidad_redes: 10, peso_kg: 20 }],
      id_usuario_modificacion: baseline.idUsuario,
    });

    const updated = await handlers['productionProcesses.updateStage']({
      id: process.id_proceso,
      id_etapa: stage.id_etapa,
      id_tipo_etapa: baseline.idTipoEtapa,
      cantidad_personas: 2,
      fecha_inicio: new Date(),
      cajas: [
        { cantidad_redes: 5, peso_kg: 9 },
        { cantidad_redes: 5, peso_kg: 9 },
      ],
      id_usuario_modificacion: baseline.idUsuario,
    });

    expect(updated.cajas).toHaveLength(2);
  });

  it('updateStage sin enviar cajas no borra el desglose ya registrado', async () => {
    const { process } = await startGreenProcess(100);
    const stage = await handlers['productionProcesses.addStage']({
      id: process.id_proceso,
      id_tipo_etapa: baseline.idTipoEtapa,
      cantidad_personas: 2,
      fecha_inicio: new Date(),
      cajas: [{ cantidad_redes: 10, peso_kg: 20 }],
      id_usuario_modificacion: baseline.idUsuario,
    });

    const updated = await handlers['productionProcesses.updateStage']({
      id: process.id_proceso,
      id_etapa: stage.id_etapa,
      id_tipo_etapa: baseline.idTipoEtapa,
      cantidad_personas: 3,
      fecha_inicio: new Date(),
      id_usuario_modificacion: baseline.idUsuario,
    });

    expect(updated.cantidad_personas).toBe(3);
    expect(updated.cajas).toHaveLength(1);
  });

  it('permite finalizar el proceso y genera inventario, igual que cualquier otro producto terminado', async () => {
    const { process } = await startGreenProcess(50, 50);

    await handlers['productionProcesses.addStage']({
      id: process.id_proceso,
      id_tipo_etapa: baseline.idTipoEtapa,
      cantidad_personas: 2,
      fecha_inicio: new Date(),
      cajas: [{ cantidad_redes: 25, peso_kg: 50 }],
      id_usuario_modificacion: baseline.idUsuario,
    });

    const finalized = await handlers['productionProcesses.finalize']({
      id: process.id_proceso,
      cantidad_producida_kg: 50,
      fecha_fin: new Date(),
      fecha_vencimiento: '2027-01-01',
      id_usuario_modificacion: baseline.idUsuario,
    });

    expect(finalized.estado_proceso).toBe('Finalizado');

    const [existencias] = await pool.query(
      'SELECT * FROM inventario_existencias WHERE id_proceso_origen = ? AND id_producto = ?',
      [process.id_proceso, baseline.idProductoTerminado]
    );
    expect(existencias).toHaveLength(1);
  });
});
