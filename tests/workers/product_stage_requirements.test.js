const { pool, resetDatabase, seedBaseline } = require('../helpers/db');
const { createReadySublot } = require('../helpers/fixtures');
const { handlers } = require('../../src/workers/domains/production.worker.js');
const { handlers: stageTypeHandlers } = require('../../src/workers/domains/stage_type.worker.js');
const { handlers: requirementHandlers } = require('../../src/workers/domains/product_stage_requirement.worker.js');

let baseline;
let idSegundaEtapa;

const startProcess = async (pesoKg = 100) => {
  const { idSublote } = await createReadySublot({
    idProducto: baseline.idProductoMateriaPrima,
    idProveedor: baseline.idProveedor,
    pesoKg,
  });

  return handlers['productionProcesses.create']({
    id_sublote: idSublote,
    id_producto_resultado: baseline.idProductoTerminado,
    id_orden: null,
    cantidad_ingresada_kg: pesoKg,
    fecha_inicio: null,
    id_usuario_registro: baseline.idUsuario,
  });
};

const addStage = (idProceso, idTipoEtapa) =>
  handlers['productionProcesses.addStage']({
    id: idProceso,
    id_tipo_etapa: idTipoEtapa,
    cantidad_personas: 2,
    fecha_inicio: new Date(),
    id_usuario_modificacion: baseline.idUsuario,
  });

beforeEach(async () => {
  await resetDatabase();
  baseline = await seedBaseline();

  const segundaEtapa = await stageTypeHandlers['stageTypes.create']({
    nombre_etapa: 'Corte',
    id_usuario_modificacion: baseline.idUsuario,
  });
  idSegundaEtapa = segundaEtapa.id_tipo_etapa;
});

describe('productStageRequirements: receta de etapas por producto', () => {
  it('un producto sin receta definida no tiene requisitos', async () => {
    const requirements = await requirementHandlers['productStageRequirements.findByProduct']({
      id_producto: baseline.idProductoTerminado,
    });

    expect(requirements).toEqual([]);
  });

  it('replaceForProduct guarda la secuencia ordenada y reemplaza la anterior al volver a guardar', async () => {
    await requirementHandlers['productStageRequirements.replaceForProduct']({
      id_producto: baseline.idProductoTerminado,
      etapas: [baseline.idTipoEtapa, idSegundaEtapa],
      id_usuario_modificacion: baseline.idUsuario,
    });

    let requirements = await requirementHandlers['productStageRequirements.findByProduct']({
      id_producto: baseline.idProductoTerminado,
    });
    expect(requirements.map((r) => r.id_tipo_etapa)).toEqual([baseline.idTipoEtapa, idSegundaEtapa]);
    expect(requirements.map((r) => r.orden)).toEqual([1, 2]);

    // Reemplazar con el orden invertido: debe quedar solo la nueva secuencia, no acumular filas.
    await requirementHandlers['productStageRequirements.replaceForProduct']({
      id_producto: baseline.idProductoTerminado,
      etapas: [idSegundaEtapa, baseline.idTipoEtapa],
      id_usuario_modificacion: baseline.idUsuario,
    });

    requirements = await requirementHandlers['productStageRequirements.findByProduct']({
      id_producto: baseline.idProductoTerminado,
    });
    expect(requirements.map((r) => r.id_tipo_etapa)).toEqual([idSegundaEtapa, baseline.idTipoEtapa]);
  });
});

describe('productionProcesses.finalize - validacion de receta de etapas', () => {
  it('finaliza sin problema si el producto no tiene receta definida', async () => {
    const process = await startProcess(50);

    const finalized = await handlers['productionProcesses.finalize']({
      id: process.id_proceso,
      cantidad_producida_kg: 50,
      fecha_fin: new Date(),
      fecha_vencimiento: '2027-01-01',
      id_usuario_modificacion: baseline.idUsuario,
    });

    expect(finalized.estado_proceso).toBe('Finalizado');
  });

  it('bloquea finalizar si falta una etapa requerida por la receta', async () => {
    await requirementHandlers['productStageRequirements.replaceForProduct']({
      id_producto: baseline.idProductoTerminado,
      etapas: [baseline.idTipoEtapa, idSegundaEtapa],
      id_usuario_modificacion: baseline.idUsuario,
    });

    const process = await startProcess(50);
    await addStage(process.id_proceso, baseline.idTipoEtapa);

    await expect(
      handlers['productionProcesses.finalize']({
        id: process.id_proceso,
        cantidad_producida_kg: 50,
        fecha_fin: new Date(),
        fecha_vencimiento: '2027-01-01',
        id_usuario_modificacion: baseline.idUsuario,
      })
    ).rejects.toThrow(/Faltan etapas requeridas.*Corte/);

    const [rows] = await pool.query('SELECT estado_proceso FROM procesos_produccion WHERE id_proceso = ?', [
      process.id_proceso,
    ]);
    expect(rows[0].estado_proceso).toBe('En proceso');
  });

  it('bloquea registrar una etapa fuera de orden (ya no se puede ni crear, no solo falla al finalizar)', async () => {
    await requirementHandlers['productStageRequirements.replaceForProduct']({
      id_producto: baseline.idProductoTerminado,
      etapas: [baseline.idTipoEtapa, idSegundaEtapa],
      id_usuario_modificacion: baseline.idUsuario,
    });

    const process = await startProcess(50);
    // Intentar registrar Corte antes que Pelado debe rechazarse de inmediato.
    await expect(addStage(process.id_proceso, idSegundaEtapa)).rejects.toThrow(/Debes registrar primero/);
  });

  it('bloquea registrar una etapa con fecha_inicio anterior a la etapa previa del plan, aunque ya exista', async () => {
    await requirementHandlers['productStageRequirements.replaceForProduct']({
      id_producto: baseline.idProductoTerminado,
      etapas: [baseline.idTipoEtapa, idSegundaEtapa],
      id_usuario_modificacion: baseline.idUsuario,
    });

    const process = await startProcess(50);
    const pelado = await handlers['productionProcesses.addStage']({
      id: process.id_proceso,
      id_tipo_etapa: baseline.idTipoEtapa,
      cantidad_personas: 2,
      fecha_inicio: new Date('2027-01-01T12:00:00Z'),
      id_usuario_modificacion: baseline.idUsuario,
    });
    expect(pelado.id_tipo_etapa).toBe(baseline.idTipoEtapa);

    // Corte ya existe como siguiente paso del plan, pero con una fecha anterior a Pelado.
    await expect(
      handlers['productionProcesses.addStage']({
        id: process.id_proceso,
        id_tipo_etapa: idSegundaEtapa,
        cantidad_personas: 2,
        fecha_inicio: new Date('2027-01-01T11:00:00Z'),
        id_usuario_modificacion: baseline.idUsuario,
      })
    ).rejects.toThrow(/fecha de inicio de esta etapa no puede ser anterior/);
  });

  it('bloquea finalizar si las etapas quedaron en un orden distinto al de la receta por fecha_inicio', async () => {
    await requirementHandlers['productStageRequirements.replaceForProduct']({
      id_producto: baseline.idProductoTerminado,
      etapas: [baseline.idTipoEtapa, idSegundaEtapa],
      id_usuario_modificacion: baseline.idUsuario,
    });

    const process = await startProcess(50);
    await addStage(process.id_proceso, baseline.idTipoEtapa);
    await addStage(process.id_proceso, idSegundaEtapa);

    // Se fuerza el desorden directo en la base (ej. dato legado de antes de esta validacion),
    // para comprobar que finalize sigue siendo una segunda barrera de seguridad.
    await pool.query(
      `UPDATE produccion_etapas SET fecha_inicio = DATE_SUB(fecha_inicio, INTERVAL 1 DAY) WHERE id_proceso = ? AND id_tipo_etapa = ?`,
      [process.id_proceso, idSegundaEtapa]
    );

    await expect(
      handlers['productionProcesses.finalize']({
        id: process.id_proceso,
        cantidad_producida_kg: 50,
        fecha_fin: new Date(),
        fecha_vencimiento: '2027-01-01',
        id_usuario_modificacion: baseline.idUsuario,
      })
    ).rejects.toThrow(/no se completaron en el orden requerido/);
  });

  it('permite finalizar cuando se completan todas las etapas de la receta en el orden correcto', async () => {
    await requirementHandlers['productStageRequirements.replaceForProduct']({
      id_producto: baseline.idProductoTerminado,
      etapas: [baseline.idTipoEtapa, idSegundaEtapa],
      id_usuario_modificacion: baseline.idUsuario,
    });

    const process = await startProcess(50);
    await addStage(process.id_proceso, baseline.idTipoEtapa);
    await addStage(process.id_proceso, idSegundaEtapa);

    const finalized = await handlers['productionProcesses.finalize']({
      id: process.id_proceso,
      cantidad_producida_kg: 50,
      fecha_fin: new Date(),
      fecha_vencimiento: '2027-01-01',
      id_usuario_modificacion: baseline.idUsuario,
    });

    expect(finalized.estado_proceso).toBe('Finalizado');
  });
});

describe('productionProcesses.addStage / updateStage - solo etapas del plan del producto', () => {
  it('permite registrar cualquier etapa si el producto no tiene plan definido (producto legado)', async () => {
    const process = await startProcess(50);

    const stage = await addStage(process.id_proceso, idSegundaEtapa);
    expect(stage.id_tipo_etapa).toBe(idSegundaEtapa);
  });

  it('bloquea registrar una etapa que no forma parte del plan del producto', async () => {
    await requirementHandlers['productStageRequirements.replaceForProduct']({
      id_producto: baseline.idProductoTerminado,
      etapas: [baseline.idTipoEtapa],
      id_usuario_modificacion: baseline.idUsuario,
    });

    const process = await startProcess(50);

    await expect(addStage(process.id_proceso, idSegundaEtapa)).rejects.toThrow(
      /no forma parte del plan de proceso/
    );
  });

  it('permite registrar una etapa que si forma parte del plan del producto', async () => {
    await requirementHandlers['productStageRequirements.replaceForProduct']({
      id_producto: baseline.idProductoTerminado,
      etapas: [baseline.idTipoEtapa, idSegundaEtapa],
      id_usuario_modificacion: baseline.idUsuario,
    });

    const process = await startProcess(50);

    const stage = await addStage(process.id_proceso, baseline.idTipoEtapa);
    expect(stage.id_tipo_etapa).toBe(baseline.idTipoEtapa);
  });

  it('bloquea editar una etapa hacia un tipo que no forma parte del plan del producto', async () => {
    await requirementHandlers['productStageRequirements.replaceForProduct']({
      id_producto: baseline.idProductoTerminado,
      etapas: [baseline.idTipoEtapa],
      id_usuario_modificacion: baseline.idUsuario,
    });

    const process = await startProcess(50);
    const stage = await addStage(process.id_proceso, baseline.idTipoEtapa);

    await expect(
      handlers['productionProcesses.updateStage']({
        id: process.id_proceso,
        id_etapa: stage.id_etapa,
        id_tipo_etapa: idSegundaEtapa,
        cantidad_personas: 2,
        fecha_inicio: new Date(),
        id_usuario_modificacion: baseline.idUsuario,
      })
    ).rejects.toThrow(/no forma parte del plan de proceso/);
  });
});
