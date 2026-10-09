const { pool, resetDatabase, seedBaseline } = require('../helpers/db');
const { createReadySublot } = require('../helpers/fixtures');
const { handlers } = require('../../src/workers/domains/production.worker.js');

let baseline;

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

const pad = (value) => String(value).padStart(2, '0');

// Suma horas a un "YYYY-MM-DD HH:MM:SS" operando con componentes locales en ambos
// extremos (nunca via toISOString, que convierte a UTC y descuadra la resta contra
// un fecha_inicio que se guarda tal cual, sin conversion de zona horaria).
const addHoursToDateTimeString = (dateTimeString, hours) => {
  const [datePart, timePart] = dateTimeString.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);
  const start = new Date(year, month - 1, day, hour, minute, second);
  const end = new Date(start.getTime() + hours * 60 * 60 * 1000);

  return `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())} ${pad(end.getHours())}:${pad(end.getMinutes())}:${pad(end.getSeconds())}`;
};

// Crea una etapa y le cierra fecha_fin de una vez (el reporte de productividad solo cuenta
// etapas ya cerradas), con una duracion exacta en horas para poder verificar el calculo.
const addClosedStage = async (idProceso, { cantidadPersonas, horas, fechaInicio }) => {
  const stage = await handlers['productionProcesses.addStage']({
    id: idProceso,
    id_tipo_etapa: baseline.idTipoEtapa,
    cantidad_personas: cantidadPersonas,
    personal_asignado: 'Operador de prueba',
    fecha_inicio: fechaInicio,
    cantidad_entrada_kg: null,
    id_usuario_modificacion: baseline.idUsuario,
  });

  return handlers['productionProcesses.updateStage']({
    id: idProceso,
    id_etapa: stage.id_etapa,
    id_tipo_etapa: baseline.idTipoEtapa,
    cantidad_personas: cantidadPersonas,
    personal_asignado: 'Operador de prueba',
    fecha_inicio: fechaInicio,
    fecha_fin: addHoursToDateTimeString(fechaInicio, horas),
    cantidad_entrada_kg: null,
    id_usuario_modificacion: baseline.idUsuario,
  });
};

beforeEach(async () => {
  await resetDatabase();
  baseline = await seedBaseline();
});

describe('productionProcesses.reportProductividad', () => {
  it('calcula kg por hora-persona a partir de las etapas cerradas de procesos finalizados', async () => {
    const process = await startProcess(100);

    // 2 personas x 5 horas = 10 horas-persona.
    await addClosedStage(process.id_proceso, { cantidadPersonas: 2, horas: 5, fechaInicio: '2027-03-10 08:00:00' });

    await handlers['productionProcesses.finalize']({
      id: process.id_proceso,
      cantidad_producida_kg: 50,
      fecha_fin: '2027-03-10 13:00:00',
      fecha_vencimiento: '2027-06-01',
      justificacion_diferencia: 'Merma normal del proceso',
      id_usuario_modificacion: baseline.idUsuario,
    });

    const report = await handlers['productionProcesses.reportProductividad']({ agrupacion: 'mensual' });

    expect(report).toHaveLength(1);
    const row = report[0];
    expect(row.periodo).toBe('2027-03');
    expect(row.id_producto).toBe(baseline.idProductoTerminado);
    expect(Number(row.total_procesos)).toBe(1);
    expect(Number(row.total_kg_producido)).toBeCloseTo(50, 2);
    expect(Number(row.total_horas_persona)).toBeCloseTo(10, 2);
    expect(Number(row.kg_por_hora_persona)).toBeCloseTo(5, 2);
  });

  it('agrupa por producto sin desglosar por periodo cuando agrupacion="producto"', async () => {
    const process = await startProcess(100);
    await addClosedStage(process.id_proceso, { cantidadPersonas: 1, horas: 2, fechaInicio: '2027-03-10 08:00:00' });

    await handlers['productionProcesses.finalize']({
      id: process.id_proceso,
      cantidad_producida_kg: 20,
      fecha_fin: '2027-03-10 10:00:00',
      fecha_vencimiento: '2027-06-01',
      justificacion_diferencia: 'Merma normal del proceso',
      id_usuario_modificacion: baseline.idUsuario,
    });

    const report = await handlers['productionProcesses.reportProductividad']({ agrupacion: 'producto' });

    expect(report).toHaveLength(1);
    expect(report[0].periodo).toBeNull();
    expect(report[0].producto_nombre).toBeTruthy();
  });

  it('no cuenta procesos que aun no han finalizado', async () => {
    const process = await startProcess(100);
    await addClosedStage(process.id_proceso, { cantidadPersonas: 2, horas: 3, fechaInicio: '2027-03-10 08:00:00' });

    const report = await handlers['productionProcesses.reportProductividad']({ agrupacion: 'mensual' });

    expect(report).toHaveLength(0);
  });
});
