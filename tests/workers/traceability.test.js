const { pool, resetDatabase, seedBaseline } = require('../helpers/db');
const { handlers: entryHandlers } = require('../../src/workers/domains/entradas_mercancia.worker.js');
const { handlers: maturationHandlers } = require('../../src/workers/domains/maturation.worker.js');
const { handlers: greenNetHandlers } = require('../../src/workers/domains/green_net.worker.js');
const { handlers: productionHandlers } = require('../../src/workers/domains/production.worker.js');
const { handlers: orderHandlers } = require('../../src/workers/domains/order.worker.js');
const { handlers: traceHandlers } = require('../../src/workers/domains/traceability.worker.js');

let baseline;
let chain;

// Construye una cadena real completa: entrada -> lote -> dos sub-lotes hermanos (uno se
// empaca como red, el otro sigue a produccion), usando los handlers reales de cada dominio
// (no INSERTs a mano) para que la trazabilidad se pruebe sobre datos que de verdad podrian
// haberse generado desde la app. maturationSublots.close no exige estado_maduracion='Maduro',
// solo que el sub-lote este Activo, asi que un sub-lote Verde tambien puede cerrarse y pasar
// a produccion (asi lo hace la app real cuando el usuario decide no esperar el Brix).
const buildFullChain = async () => {
  const entrada = await entryHandlers['entries.create']({
    id_proveedor: baseline.idProveedor,
    id_producto: baseline.idProductoMateriaPrima,
    fecha_vencimiento: '2027-01-01',
    cantidad_disponible: 200,
    costo_unitario: 5,
    id_usuario_receptor: baseline.idUsuario,
  });

  const [loteRows] = await pool.query('SELECT id_lote_mp FROM lotes_materia_prima WHERE id_entrada_origen = ?', [
    entrada.id_entrada,
  ]);
  const idLoteMp = loteRows[0].id_lote_mp;

  const subloteOrigen = await maturationHandlers['maturationLots.accept']({
    id: idLoteMp,
    estado_maduracion: 'Verde',
    id_usuario_modificacion: baseline.idUsuario,
  });

  const { nuevo: subloteParaRed } = await maturationHandlers['maturationSublots.split']({
    id: subloteOrigen.id_sublote,
    peso_kg: 50,
    id_usuario_modificacion: baseline.idUsuario,
  });

  const [red] = await greenNetHandlers['greenNets.create']({
    id_sublote: subloteParaRed.id_sublote,
    id_producto: baseline.idProductoTerminado,
    cajas: [{ cantidad_redes: 25, peso_kg: 50 }],
    fecha_vencimiento: '2027-01-01',
    id_usuario: baseline.idUsuario,
  });

  const subloteParaProduccion = await maturationHandlers['maturationSublots.close']({
    id: subloteOrigen.id_sublote,
    peso_medido_kg: 150,
    id_usuario_modificacion: baseline.idUsuario,
  });

  const proceso = await productionHandlers['productionProcesses.create']({
    id_sublote: subloteParaProduccion.id_sublote,
    id_producto_resultado: baseline.idProductoTerminado,
    cantidad_ingresada_kg: 150,
    fecha_inicio: null,
    id_usuario_registro: baseline.idUsuario,
  });

  const finalizado = await productionHandlers['productionProcesses.finalize']({
    id: proceso.id_proceso,
    cantidad_producida_kg: 150,
    fecha_fin: new Date(),
    fecha_vencimiento: '2027-06-01',
    id_usuario_modificacion: baseline.idUsuario,
  });

  const [existenciaRows] = await pool.query('SELECT id_existencia FROM inventario_existencias WHERE id_proceso_origen = ?', [
    proceso.id_proceso,
  ]);
  const idExistenciaProducida = existenciaRows[0].id_existencia;

  return {
    entrada,
    idLoteMp,
    subloteRed: subloteParaRed,
    subloteProduccion: subloteParaProduccion,
    red,
    proceso: finalizado,
    idExistenciaProducida,
  };
};

beforeEach(async () => {
  await resetDatabase();
  baseline = await seedBaseline();
  chain = await buildFullChain();
});

describe('traceability.trace', () => {
  it('por codigo de lote arma el arbol completo: lote, dos sub-lotes, red y proceso', async () => {
    const result = await traceHandlers['traceability.trace']({ codigo: chain.entrada.codigo_lote });

    expect(result.raiz.id_entrada).toBe(chain.entrada.id_entrada);
    expect(result.raiz.lotes).toHaveLength(1);
    expect(result.raiz.lotes[0].sublotes).toHaveLength(2);

    const subloteRedNode = result.raiz.lotes[0].sublotes.find((s) => s.id_sublote === chain.subloteRed.id_sublote);
    expect(subloteRedNode.redes).toHaveLength(1);
    expect(subloteRedNode.redes[0].id_red).toBe(chain.red.id_red);

    const subloteProduccionNode = result.raiz.lotes[0].sublotes.find((s) => s.id_sublote === chain.subloteProduccion.id_sublote);
    expect(subloteProduccionNode.procesos).toHaveLength(1);
    expect(subloteProduccionNode.procesos[0].id_proceso).toBe(chain.proceso.id_proceso);
    expect(subloteProduccionNode.procesos[0].existencias).toHaveLength(1);
  });

  it('desde tipo sublote resuelve hasta la misma entrada raiz', async () => {
    const result = await traceHandlers['traceability.trace']({ tipo: 'sublote', id: chain.subloteProduccion.id_sublote });
    expect(result.raiz.id_entrada).toBe(chain.entrada.id_entrada);
  });

  it('desde tipo red resuelve hasta la misma entrada raiz', async () => {
    const result = await traceHandlers['traceability.trace']({ tipo: 'red', id: chain.red.id_red });
    expect(result.raiz.id_entrada).toBe(chain.entrada.id_entrada);
  });

  it('desde tipo proceso resuelve hasta la misma entrada raiz', async () => {
    const result = await traceHandlers['traceability.trace']({ tipo: 'proceso', id: chain.proceso.id_proceso });
    expect(result.raiz.id_entrada).toBe(chain.entrada.id_entrada);
  });

  it('desde la existencia del producto terminado resuelve hasta la entrada raiz (via proceso)', async () => {
    const result = await traceHandlers['traceability.trace']({ tipo: 'existencia', id: chain.idExistenciaProducida });
    expect(result.raiz.id_entrada).toBe(chain.entrada.id_entrada);
  });

  it('el nodo de existencia muestra a que pedido/cliente se entrego una unidad de ese lote', async () => {
    const order = await orderHandlers['orders.create']({
      id_cliente: baseline.idCliente,
      observaciones: null,
      id_usuario_creacion: baseline.idUsuario,
      lineas: [{ id_producto: baseline.idProductoTerminado, cantidad: 20, id_existencia: chain.idExistenciaProducida }],
    });

    const result = await traceHandlers['traceability.trace']({ tipo: 'existencia', id: chain.idExistenciaProducida });

    const subloteProduccionNode = result.raiz.lotes[0].sublotes.find(
      (s) => s.id_sublote === chain.subloteProduccion.id_sublote
    );
    const existenciaNode = subloteProduccionNode.procesos[0].existencias.find(
      (e) => e.id_existencia === chain.idExistenciaProducida
    );

    expect(existenciaNode.pedidos).toHaveLength(1);
    expect(existenciaNode.pedidos[0].id_pedido).toBe(order.id_pedido);
    expect(existenciaNode.pedidos[0].nombre_comercial).toBe('Cliente de Pruebas');
    expect(Number(existenciaNode.pedidos[0].cantidad)).toBe(20);
  });

  it('lanza error con un codigo de trazabilidad inexistente', async () => {
    await expect(traceHandlers['traceability.trace']({ codigo: 'ZZZ-999999-999' })).rejects.toThrow(
      /No existe ninguna entrada/
    );
  });

  it('devuelve existencia_huerfana cuando la existencia no tiene origen vinculado', async () => {
    const [result] = await pool.query(
      `INSERT INTO inventario_existencias (id_producto, id_proveedor, fecha_vencimiento, cantidad_disponible, estado_registro)
       VALUES (?, NULL, '2027-01-01', 10, 'Activo')`,
      [baseline.idProductoTerminado]
    );

    const trace = await traceHandlers['traceability.trace']({ tipo: 'existencia', id: result.insertId });
    expect(trace.raiz).toBeNull();
    expect(trace.existencia_huerfana.id_existencia).toBe(result.insertId);
  });
});

describe('traceability.search', () => {
  it('coincidencia exacta de codigo devuelve solo la entrada', async () => {
    const results = await traceHandlers['traceability.search']({ q: chain.entrada.codigo_lote });
    expect(results).toHaveLength(1);
    expect(results[0].tipo).toBe('entrada');
    expect(results[0].id).toBe(chain.entrada.id_entrada);
  });

  it('busqueda numerica encuentra coincidencias en varios tipos por su ID', async () => {
    const results = await traceHandlers['traceability.search']({ q: String(chain.subloteProduccion.id_sublote) });
    expect(results.some((row) => row.tipo === 'sublote' && row.id === chain.subloteProduccion.id_sublote)).toBe(true);
  });
});

describe('traceability.searchByFilters', () => {
  it('area produccion devuelve el proceso activo y no el ya finalizado', async () => {
    // El proceso de la cadena principal ya se finalizo; creamos uno nuevo "En proceso" para este caso.
    const entrada2 = await entryHandlers['entries.create']({
      id_proveedor: baseline.idProveedor,
      id_producto: baseline.idProductoMateriaPrima,
      fecha_vencimiento: '2027-01-01',
      cantidad_disponible: 100,
      id_usuario_receptor: baseline.idUsuario,
    });
    const [loteRows] = await pool.query('SELECT id_lote_mp FROM lotes_materia_prima WHERE id_entrada_origen = ?', [
      entrada2.id_entrada,
    ]);
    const sublote2 = await maturationHandlers['maturationLots.accept']({
      id: loteRows[0].id_lote_mp,
      estado_maduracion: 'Maduro', // directo a "Listo para produccion", sin paso de cierre
      id_usuario_modificacion: baseline.idUsuario,
    });
    const procesoActivo = await productionHandlers['productionProcesses.create']({
      id_sublote: sublote2.id_sublote,
      id_producto_resultado: baseline.idProductoTerminado,
      cantidad_ingresada_kg: 50,
      fecha_inicio: null,
      id_usuario_registro: baseline.idUsuario,
    });

    const results = await traceHandlers['traceability.searchByFilters']({ areas: ['produccion'] });
    const ids = results.map((row) => row.id);

    expect(ids).toContain(procesoActivo.id_proceso);
    expect(ids).not.toContain(chain.proceso.id_proceso); // ya finalizado, no debe salir en "activos"
  });

  it('area redes devuelve la red empacada', async () => {
    const results = await traceHandlers['traceability.searchByFilters']({ areas: ['redes'] });
    expect(results.some((row) => row.tipo === 'red' && row.id === chain.red.id_red)).toBe(true);
  });

  it('rechaza un area invalida', async () => {
    await expect(traceHandlers['traceability.searchByFilters']({ areas: ['no-existe'] })).rejects.toThrow(/area invalida/);
  });
});
