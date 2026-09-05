const { pool } = require('../../config/db');
const {
  USERS_TABLE,
  PROVIDERS_TABLE,
  PRODUCTS_TABLE,
  ENTRIES_TABLE,
  INVENTORY_TABLE,
  MOVEMENTS_TABLE,
  RAW_MATERIAL_LOTS_TABLE,
  MATURATION_SUBLOT_TABLE,
  MATURATION_CONTROL_TABLE,
  GREEN_NET_TABLE,
  CAT_MERMA_TABLE,
  CAT_STAGE_TABLE,
  PRODUCTION_TABLE,
  PRODUCTION_STAGE_TABLE,
  PRODUCTION_MERMA_TABLE,
  PRODUCTION_INSUMO_TABLE,
  CLIENTS_TABLE,
  ORDERS_TABLE,
  ORDER_DETAIL_TABLE,
  ROUTES_TABLE,
  ROUTE_ORDERS_TABLE,
  ACTIVE_STATE,
  SUBLOT_ACTIVE_STATE,
  SUBLOT_READY_STATE,
  PRODUCTION_ACTIVE_STATE,
  FINISHED_PRODUCT_TYPE,
  ORDER_ENTREGADO_STATE,
} = require('../shared/constants');

const entradaQuery = `SELECT e.id_entrada, e.id_proveedor, p.nombre_empresa AS proveedor_nombre, e.fecha_recepcion, e.documento_referencia, e.costo_unitario, e.costo_total, e.id_usuario_receptor, u.nombre_completo AS receptor_nombre, e.estado_registro, e.codigo_lote FROM ${ENTRIES_TABLE} e LEFT JOIN ${PROVIDERS_TABLE} p ON p.id_proveedor = e.id_proveedor LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = e.id_usuario_receptor WHERE e.id_entrada = ?`;

const entradaByCodigoQuery = `SELECT e.id_entrada, e.id_proveedor, p.nombre_empresa AS proveedor_nombre, e.fecha_recepcion, e.documento_referencia, e.costo_unitario, e.costo_total, e.id_usuario_receptor, u.nombre_completo AS receptor_nombre, e.estado_registro, e.codigo_lote FROM ${ENTRIES_TABLE} e LEFT JOIN ${PROVIDERS_TABLE} p ON p.id_proveedor = e.id_proveedor LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = e.id_usuario_receptor WHERE e.codigo_lote = ?`;

const lotesByEntradaQuery = `SELECT l.id_lote_mp, l.id_producto, pr.nombre AS producto_nombre, l.id_proveedor, prov.nombre_empresa AS proveedor_nombre, l.fecha_recepcion, l.cantidad_unidades, l.peso_inicial_kg, l.estado_maduracion, l.estado_registro FROM ${RAW_MATERIAL_LOTS_TABLE} l LEFT JOIN ${PRODUCTS_TABLE} pr ON pr.id_producto = l.id_producto LEFT JOIN ${PROVIDERS_TABLE} prov ON prov.id_proveedor = l.id_proveedor WHERE l.id_entrada_origen = ? ORDER BY l.id_lote_mp ASC`;

const sublotesByLoteQuery = `SELECT s.id_sublote, s.codigo_sublote, s.peso_inicial_kg, s.peso_kg, s.peso_neto_maduracion_kg, s.perdida_maduracion_kg, s.cantidad_unidades, s.estado_maduracion, s.estado_registro, s.observaciones, s.fecha_creacion FROM ${MATURATION_SUBLOT_TABLE} s WHERE s.id_lote_mp = ? ORDER BY s.codigo_sublote ASC`;

const controlesBySubloteQuery = `SELECT c.id_control, c.fecha_medicion, c.grados_brix, c.peso_medido_kg, c.porcentaje_materia_seca, c.temperatura_cuarto, c.observaciones FROM ${MATURATION_CONTROL_TABLE} c WHERE c.id_sublote = ? ORDER BY c.fecha_medicion ASC`;

const redesBySubloteQuery = `SELECT r.id_red, r.id_existencia, r.peso_kg, r.cantidad_redes, r.fecha_empaque, r.id_usuario, u.nombre_completo AS usuario_nombre FROM ${GREEN_NET_TABLE} r LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = r.id_usuario WHERE r.id_sublote = ? ORDER BY r.id_red ASC`;

const procesosBySubloteQuery = `SELECT p.id_proceso, p.id_producto_resultado, pr.nombre AS producto_resultado_nombre, p.cantidad_ingresada_kg, p.cantidad_producida_kg, p.rendimiento_porcentaje, p.estado_proceso, p.fecha_inicio, p.fecha_fin, p.cuarto_congelado, p.ubicacion_cuarto_congelado, p.observaciones, p.diferencia_kg, p.justificacion_diferencia, p.estado_registro FROM ${PRODUCTION_TABLE} p LEFT JOIN ${PRODUCTS_TABLE} pr ON pr.id_producto = p.id_producto_resultado WHERE p.id_sublote = ? ORDER BY p.id_proceso ASC`;

const etapasByProcesoQuery = `SELECT e.id_etapa, e.id_tipo_etapa, cte.nombre_etapa, e.cantidad_personas, e.personal_asignado, e.fecha_inicio, e.fecha_fin, e.cantidad_entrada_kg, e.cantidad_salida_kg, e.merma_kg, e.observaciones FROM ${PRODUCTION_STAGE_TABLE} e LEFT JOIN ${CAT_STAGE_TABLE} cte ON cte.id_tipo_etapa = e.id_tipo_etapa WHERE e.id_proceso = ? AND e.estado_registro = '${ACTIVE_STATE}' ORDER BY e.fecha_inicio ASC`;

const mermasByProcesoQuery = `SELECT m.id_merma, m.id_etapa, m.id_tipo_merma, ctm.nombre_merma, m.cantidad_kg, m.observaciones, m.fecha_registro FROM ${PRODUCTION_MERMA_TABLE} m LEFT JOIN ${CAT_MERMA_TABLE} ctm ON ctm.id_tipo_merma = m.id_tipo_merma WHERE m.id_proceso = ? AND m.estado_registro = '${ACTIVE_STATE}' ORDER BY m.fecha_registro ASC`;

const insumosByProcesoQuery = `SELECT i.id_consumo, i.id_etapa, i.id_producto, prd.nombre AS producto_nombre, i.cantidad, i.unidad_medida, i.observaciones, i.fecha_registro FROM ${PRODUCTION_INSUMO_TABLE} i LEFT JOIN ${PRODUCTS_TABLE} prd ON prd.id_producto = i.id_producto WHERE i.id_proceso = ? AND i.estado_registro = '${ACTIVE_STATE}' ORDER BY i.fecha_registro ASC`;

const existenciaByIdQuery = `SELECT ie.id_existencia, ie.id_producto, pr.nombre AS producto_nombre, ie.id_proveedor, prov.nombre_empresa AS proveedor_nombre, ie.id_proceso_origen, ie.id_entrada_origen, ie.fecha_entrada, ie.fecha_vencimiento, ie.cantidad_disponible, ie.costo_unitario, ie.estado_registro FROM ${INVENTORY_TABLE} ie LEFT JOIN ${PRODUCTS_TABLE} pr ON pr.id_producto = ie.id_producto LEFT JOIN ${PROVIDERS_TABLE} prov ON prov.id_proveedor = ie.id_proveedor WHERE ie.id_existencia = ?`;

const existenciasByProcesoQuery = `SELECT ie.id_existencia, ie.id_producto, pr.nombre AS producto_nombre, ie.id_proveedor, prov.nombre_empresa AS proveedor_nombre, ie.fecha_entrada, ie.fecha_vencimiento, ie.cantidad_disponible, ie.costo_unitario, ie.estado_registro FROM ${INVENTORY_TABLE} ie LEFT JOIN ${PRODUCTS_TABLE} pr ON pr.id_producto = ie.id_producto LEFT JOIN ${PROVIDERS_TABLE} prov ON prov.id_proveedor = ie.id_proveedor WHERE ie.id_proceso_origen = ? ORDER BY ie.id_existencia ASC`;

const existenciasByEntradaQuery = `SELECT ie.id_existencia, ie.id_producto, pr.nombre AS producto_nombre, ie.fecha_entrada, ie.fecha_vencimiento, ie.cantidad_disponible, ie.costo_unitario, ie.estado_registro FROM ${INVENTORY_TABLE} ie LEFT JOIN ${PRODUCTS_TABLE} pr ON pr.id_producto = ie.id_producto WHERE ie.id_entrada_origen = ? ORDER BY ie.id_existencia ASC`;

const movimientosByExistenciaQuery = `SELECT m.id_movimiento, m.tipo_movimiento, m.cantidad, m.motivo, m.fecha_movimiento, m.id_usuario, u.nombre_completo AS usuario_nombre FROM ${MOVEMENTS_TABLE} m LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = m.id_usuario WHERE m.id_existencia = ? ORDER BY m.fecha_movimiento ASC, m.id_movimiento ASC`;

// Hacia adelante: a que pedido/cliente se entrego una unidad de esta existencia (lote).
const pedidosByExistenciaQuery = `SELECT d.id_detalle, d.id_pedido, d.cantidad, d.estado_entrega, d.cantidad_entregada, o.estado AS pedido_estado, o.fecha_creacion, o.fecha_entrega, o.id_cliente, c.nombre_comercial FROM ${ORDER_DETAIL_TABLE} d INNER JOIN ${ORDERS_TABLE} o ON o.id_pedido = d.id_pedido LEFT JOIN ${CLIENTS_TABLE} c ON c.id_cliente = o.id_cliente WHERE d.id_existencia = ? ORDER BY d.id_detalle ASC`;

const redByExistenciaQuery = `SELECT r.id_red, r.id_sublote FROM ${GREEN_NET_TABLE} r WHERE r.id_existencia = ? LIMIT 1`;

const buildExistenciaNode = async (existenciaRow) => {
  const [movimientos] = await pool.query(movimientosByExistenciaQuery, [existenciaRow.id_existencia]);
  const [pedidos] = await pool.query(pedidosByExistenciaQuery, [existenciaRow.id_existencia]);
  return { ...existenciaRow, movimientos, pedidos };
};

const buildProcesoNode = async (procesoRow) => {
  const [etapas] = await pool.query(etapasByProcesoQuery, [procesoRow.id_proceso]);
  const [mermas] = await pool.query(mermasByProcesoQuery, [procesoRow.id_proceso]);
  const [insumos] = await pool.query(insumosByProcesoQuery, [procesoRow.id_proceso]);
  const [existenciaRows] = await pool.query(existenciasByProcesoQuery, [procesoRow.id_proceso]);
  const existencias = await Promise.all(existenciaRows.map(buildExistenciaNode));

  return { ...procesoRow, etapas, mermas, insumos, existencias };
};

const buildRedNode = async (redRow) => {
  const [existenciaRows] = await pool.query(existenciaByIdQuery, [redRow.id_existencia]);
  const existencia = existenciaRows.length > 0 ? await buildExistenciaNode(existenciaRows[0]) : null;
  return { ...redRow, existencia };
};

const buildSubloteNode = async (subloteRow) => {
  const [controles] = await pool.query(controlesBySubloteQuery, [subloteRow.id_sublote]);
  const [redRows] = await pool.query(redesBySubloteQuery, [subloteRow.id_sublote]);
  const [procesoRows] = await pool.query(procesosBySubloteQuery, [subloteRow.id_sublote]);

  const redes = await Promise.all(redRows.map(buildRedNode));
  const procesos = await Promise.all(procesoRows.map(buildProcesoNode));

  return { ...subloteRow, controles, redes, procesos };
};

const buildLoteNode = async (loteRow) => {
  const [subloteRows] = await pool.query(sublotesByLoteQuery, [loteRow.id_lote_mp]);
  const sublotes = await Promise.all(subloteRows.map(buildSubloteNode));
  return { ...loteRow, sublotes };
};

const buildEntradaTree = async (idEntrada) => {
  const [entradaRows] = await pool.query(entradaQuery, [idEntrada]);

  if (entradaRows.length === 0) {
    return null;
  }

  const [loteRows] = await pool.query(lotesByEntradaQuery, [idEntrada]);
  const [existenciaDirectaRows] = await pool.query(existenciasByEntradaQuery, [idEntrada]);

  const lotes = await Promise.all(loteRows.map(buildLoteNode));
  const existenciasDirectas = await Promise.all(existenciaDirectaRows.map(buildExistenciaNode));

  return { ...entradaRows[0], lotes, existencias_directas: existenciasDirectas };
};

const resolveEntradaIdFromExistencia = async (idExistencia) => {
  const [rows] = await pool.query(existenciaByIdQuery, [idExistencia]);

  if (rows.length === 0) {
    return { idEntrada: null, existencia: null };
  }

  const existencia = rows[0];

  if (existencia.id_entrada_origen) {
    return { idEntrada: existencia.id_entrada_origen, existencia };
  }

  if (existencia.id_proceso_origen) {
    const [procesoRows] = await pool.query(
      `SELECT s.id_lote_mp FROM ${PRODUCTION_TABLE} p LEFT JOIN ${MATURATION_SUBLOT_TABLE} s ON s.id_sublote = p.id_sublote WHERE p.id_proceso = ?`,
      [existencia.id_proceso_origen]
    );

    if (procesoRows.length > 0 && procesoRows[0].id_lote_mp) {
      const [loteRows] = await pool.query(
        `SELECT id_entrada_origen FROM ${RAW_MATERIAL_LOTS_TABLE} WHERE id_lote_mp = ?`,
        [procesoRows[0].id_lote_mp]
      );
      return { idEntrada: loteRows[0]?.id_entrada_origen ?? null, existencia };
    }

    return { idEntrada: null, existencia };
  }

  const [redRows] = await pool.query(redByExistenciaQuery, [idExistencia]);

  if (redRows.length > 0) {
    const [subloteRows] = await pool.query(
      `SELECT id_lote_mp FROM ${MATURATION_SUBLOT_TABLE} WHERE id_sublote = ?`,
      [redRows[0].id_sublote]
    );

    if (subloteRows.length > 0) {
      const [loteRows] = await pool.query(
        `SELECT id_entrada_origen FROM ${RAW_MATERIAL_LOTS_TABLE} WHERE id_lote_mp = ?`,
        [subloteRows[0].id_lote_mp]
      );
      return { idEntrada: loteRows[0]?.id_entrada_origen ?? null, existencia };
    }
  }

  return { idEntrada: null, existencia };
};

const resolveEntradaId = async (tipo, id) => {
  switch (tipo) {
    case 'entrada':
      return Number(id);
    case 'lote': {
      const [rows] = await pool.query(`SELECT id_entrada_origen FROM ${RAW_MATERIAL_LOTS_TABLE} WHERE id_lote_mp = ?`, [id]);
      return rows[0]?.id_entrada_origen ?? null;
    }
    case 'sublote': {
      const [rows] = await pool.query(
        `SELECT l.id_entrada_origen FROM ${MATURATION_SUBLOT_TABLE} s LEFT JOIN ${RAW_MATERIAL_LOTS_TABLE} l ON l.id_lote_mp = s.id_lote_mp WHERE s.id_sublote = ?`,
        [id]
      );
      return rows[0]?.id_entrada_origen ?? null;
    }
    case 'proceso': {
      const [rows] = await pool.query(
        `SELECT l.id_entrada_origen FROM ${PRODUCTION_TABLE} p LEFT JOIN ${MATURATION_SUBLOT_TABLE} s ON s.id_sublote = p.id_sublote LEFT JOIN ${RAW_MATERIAL_LOTS_TABLE} l ON l.id_lote_mp = s.id_lote_mp WHERE p.id_proceso = ?`,
        [id]
      );
      return rows[0]?.id_entrada_origen ?? null;
    }
    case 'red': {
      const [rows] = await pool.query(
        `SELECT l.id_entrada_origen FROM ${GREEN_NET_TABLE} r LEFT JOIN ${MATURATION_SUBLOT_TABLE} s ON s.id_sublote = r.id_sublote LEFT JOIN ${RAW_MATERIAL_LOTS_TABLE} l ON l.id_lote_mp = s.id_lote_mp WHERE r.id_red = ?`,
        [id]
      );
      return rows[0]?.id_entrada_origen ?? null;
    }
    case 'existencia': {
      const { idEntrada } = await resolveEntradaIdFromExistencia(id);
      return idEntrada;
    }
    case 'movimiento': {
      const [rows] = await pool.query(`SELECT id_existencia FROM ${MOVEMENTS_TABLE} WHERE id_movimiento = ?`, [id]);

      if (rows.length === 0 || !rows[0].id_existencia) {
        return null;
      }

      const { idEntrada } = await resolveEntradaIdFromExistencia(rows[0].id_existencia);
      return idEntrada;
    }
    default:
      return null;
  }
};

const formatDateLabel = (value) => {
  if (!value) {
    return 'sin fecha';
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
};

const AREA_SEARCHERS = {
  maduracion: async ({ desde, hasta }) => {
    const conditions = [`s.estado_registro IN ('${SUBLOT_ACTIVE_STATE}', '${SUBLOT_READY_STATE}')`];
    const params = [];

    if (desde) {
      conditions.push('l.fecha_recepcion >= ?');
      params.push(desde);
    }

    if (hasta) {
      conditions.push('l.fecha_recepcion <= ?');
      params.push(hasta);
    }

    const [rows] = await pool.query(
      `SELECT s.id_sublote, s.codigo_sublote, s.estado_registro, s.peso_kg, s.estado_maduracion, l.fecha_recepcion, pr.nombre AS producto_nombre, ent.codigo_lote
       FROM ${MATURATION_SUBLOT_TABLE} s
       LEFT JOIN ${RAW_MATERIAL_LOTS_TABLE} l ON l.id_lote_mp = s.id_lote_mp
       LEFT JOIN ${PRODUCTS_TABLE} pr ON pr.id_producto = l.id_producto
       LEFT JOIN ${ENTRIES_TABLE} ent ON ent.id_entrada = l.id_entrada_origen
       WHERE ${conditions.join(' AND ')}
       ORDER BY l.fecha_recepcion DESC LIMIT 100`,
      params
    );

    return rows.map((row) => ({
      area: 'maduracion',
      tipo: 'sublote',
      id: row.id_sublote,
      etiqueta: `Sub-lote #${row.id_sublote} (${row.codigo_sublote}) - ${row.producto_nombre || 'Producto sin nombre'} - ${row.codigo_lote || 'sin codigo'}`,
      fecha: formatDateLabel(row.fecha_recepcion),
      detalle: `Maduracion: ${row.estado_maduracion} | Estado: ${row.estado_registro} | Peso: ${row.peso_kg} kg`,
    }));
  },

  produccion: async ({ desde, hasta }) => {
    const conditions = [`p.estado_proceso = '${PRODUCTION_ACTIVE_STATE}'`, `p.estado_registro = '${ACTIVE_STATE}'`];
    const params = [];

    if (desde) {
      conditions.push('p.fecha_inicio >= ?');
      params.push(desde);
    }

    if (hasta) {
      conditions.push('p.fecha_inicio <= ?');
      params.push(hasta);
    }

    const [rows] = await pool.query(
      `SELECT p.id_proceso, p.fecha_inicio, p.cantidad_ingresada_kg, pr.nombre AS producto_resultado_nombre, ent.codigo_lote
       FROM ${PRODUCTION_TABLE} p
       LEFT JOIN ${MATURATION_SUBLOT_TABLE} s ON s.id_sublote = p.id_sublote
       LEFT JOIN ${RAW_MATERIAL_LOTS_TABLE} l ON l.id_lote_mp = s.id_lote_mp
       LEFT JOIN ${ENTRIES_TABLE} ent ON ent.id_entrada = l.id_entrada_origen
       LEFT JOIN ${PRODUCTS_TABLE} pr ON pr.id_producto = p.id_producto_resultado
       WHERE ${conditions.join(' AND ')}
       ORDER BY p.fecha_inicio DESC LIMIT 100`,
      params
    );

    return rows.map((row) => ({
      area: 'produccion',
      tipo: 'proceso',
      id: row.id_proceso,
      etiqueta: `Proceso #${row.id_proceso} - ${row.producto_resultado_nombre || 'Producto sin definir'} - ${row.codigo_lote || 'sin codigo'}`,
      fecha: formatDateLabel(row.fecha_inicio),
      detalle: `Ingresado: ${row.cantidad_ingresada_kg} kg`,
    }));
  },

  redes: async ({ desde, hasta }) => {
    const conditions = ['1 = 1'];
    const params = [];

    if (desde) {
      conditions.push('r.fecha_empaque >= ?');
      params.push(desde);
    }

    if (hasta) {
      conditions.push('r.fecha_empaque <= ?');
      params.push(hasta);
    }

    const [rows] = await pool.query(
      `SELECT r.id_red, r.fecha_empaque, r.peso_kg, r.cantidad_redes, pr.nombre AS producto_nombre, ent.codigo_lote
       FROM ${GREEN_NET_TABLE} r
       LEFT JOIN ${MATURATION_SUBLOT_TABLE} s ON s.id_sublote = r.id_sublote
       LEFT JOIN ${RAW_MATERIAL_LOTS_TABLE} l ON l.id_lote_mp = s.id_lote_mp
       LEFT JOIN ${ENTRIES_TABLE} ent ON ent.id_entrada = l.id_entrada_origen
       LEFT JOIN ${INVENTORY_TABLE} ie ON ie.id_existencia = r.id_existencia
       LEFT JOIN ${PRODUCTS_TABLE} pr ON pr.id_producto = ie.id_producto
       WHERE ${conditions.join(' AND ')}
       ORDER BY r.fecha_empaque DESC LIMIT 100`,
      params
    );

    return rows.map((row) => ({
      area: 'redes',
      tipo: 'red',
      id: row.id_red,
      etiqueta: `Caja #${row.id_red} - ${row.producto_nombre || 'Producto sin nombre'} - ${row.codigo_lote || 'sin codigo'}`,
      fecha: formatDateLabel(row.fecha_empaque),
      detalle: `${row.cantidad_redes ?? '-'} redes | Peso: ${row.peso_kg} kg`,
    }));
  },

  inventario: async ({ desde, hasta }) => {
    const conditions = [`ie.estado_registro = '${ACTIVE_STATE}'`, `pr.tipo_producto = '${FINISHED_PRODUCT_TYPE}'`];
    const params = [];

    if (desde) {
      conditions.push('ie.fecha_vencimiento >= ?');
      params.push(desde);
    }

    if (hasta) {
      conditions.push('ie.fecha_vencimiento <= ?');
      params.push(hasta);
    }

    const [rows] = await pool.query(
      `SELECT ie.id_existencia, ie.fecha_vencimiento, ie.cantidad_disponible, pr.nombre AS producto_nombre
       FROM ${INVENTORY_TABLE} ie
       LEFT JOIN ${PRODUCTS_TABLE} pr ON pr.id_producto = ie.id_producto
       WHERE ${conditions.join(' AND ')}
       ORDER BY ie.fecha_vencimiento ASC LIMIT 100`,
      params
    );

    return rows.map((row) => ({
      area: 'inventario',
      tipo: 'existencia',
      id: row.id_existencia,
      etiqueta: `Existencia #${row.id_existencia} - ${row.producto_nombre || 'Producto sin nombre'}`,
      fecha: formatDateLabel(row.fecha_vencimiento),
      detalle: `Disponible: ${row.cantidad_disponible}`,
    }));
  },

  pedidos: async ({ desde, hasta }) => {
    const conditions = [`o.estado = '${ORDER_ENTREGADO_STATE}'`, `o.estado_registro = '${ACTIVE_STATE}'`];
    const params = [];

    if (desde) {
      conditions.push('COALESCE(ru.fecha_llegada, o.fecha_modificacion) >= ?');
      params.push(desde);
    }

    if (hasta) {
      conditions.push('COALESCE(ru.fecha_llegada, o.fecha_modificacion) <= ?');
      params.push(hasta);
    }

    const [rows] = await pool.query(
      `SELECT o.id_pedido, o.fecha_modificacion, c.nombre_comercial, ru.fecha_llegada, ru.id_ruta
       FROM ${ORDERS_TABLE} o
       LEFT JOIN ${CLIENTS_TABLE} c ON c.id_cliente = o.id_cliente
       LEFT JOIN ${ROUTE_ORDERS_TABLE} rp ON rp.id_pedido = o.id_pedido
       LEFT JOIN ${ROUTES_TABLE} ru ON ru.id_ruta = rp.id_ruta
       WHERE ${conditions.join(' AND ')}
       ORDER BY COALESCE(ru.fecha_llegada, o.fecha_modificacion) DESC LIMIT 100`,
      params
    );

    return rows.map((row) => ({
      area: 'pedidos',
      tipo: 'pedido',
      id: row.id_pedido,
      etiqueta: `Pedido #${row.id_pedido} - ${row.nombre_comercial || 'Cliente sin nombre'}`,
      fecha: formatDateLabel(row.fecha_llegada || row.fecha_modificacion),
      detalle: row.id_ruta ? `Entregado en ruta #${row.id_ruta}` : 'Entregado',
    }));
  },
};

const handlers = {
  'traceability.trace': async ({ codigo, tipo, id }) => {
    let idEntrada = null;

    if (codigo) {
      const [codigoRows] = await pool.query(entradaByCodigoQuery, [String(codigo).trim()]);

      if (codigoRows.length === 0) {
        throw new Error('No existe ninguna entrada con ese codigo de trazabilidad');
      }

      idEntrada = codigoRows[0].id_entrada;
    } else if (tipo && id !== undefined && id !== null) {
      idEntrada = await resolveEntradaId(tipo, id);

      if (idEntrada === null && tipo === 'existencia') {
        const { existencia } = await resolveEntradaIdFromExistencia(id);

        if (existencia) {
          const node = await buildExistenciaNode(existencia);
          return { raiz: null, existencia_huerfana: node };
        }
      }
    } else {
      throw new Error('Se requiere un codigo o un tipo+id para trazar');
    }

    if (idEntrada === null || Number.isNaN(idEntrada)) {
      throw new Error('No se pudo determinar el origen (entrada de mercancia) para este registro');
    }

    const tree = await buildEntradaTree(idEntrada);

    if (!tree) {
      throw new Error('No se encontro la entrada de mercancia de origen');
    }

    return { raiz: tree };
  },
  'traceability.search': async ({ q }) => {
    const term = String(q || '').trim();

    if (!term) {
      return [];
    }

    const [exactCodeRows] = await pool.query(entradaByCodigoQuery, [term]);

    if (exactCodeRows.length > 0) {
      return [
        {
          tipo: 'entrada',
          id: exactCodeRows[0].id_entrada,
          etiqueta: `Entrada #${exactCodeRows[0].id_entrada} - ${exactCodeRows[0].codigo_lote} - ${exactCodeRows[0].proveedor_nombre || 'Sin proveedor'}`,
        },
      ];
    }

    const results = [];
    const isNumeric = /^\d+$/.test(term);

    if (isNumeric) {
      const numericId = Number(term);

      const [entradaRows] = await pool.query(entradaQuery, [numericId]);
      entradaRows.forEach((row) =>
        results.push({
          tipo: 'entrada',
          id: row.id_entrada,
          etiqueta: `Entrada #${row.id_entrada} - ${row.codigo_lote || 'sin codigo'} - ${row.proveedor_nombre || 'Sin proveedor'}`,
        })
      );

      const [loteRows] = await pool.query(
        `SELECT id_lote_mp, id_producto FROM ${RAW_MATERIAL_LOTS_TABLE} WHERE id_lote_mp = ?`,
        [numericId]
      );
      loteRows.forEach((row) => results.push({ tipo: 'lote', id: row.id_lote_mp, etiqueta: `Lote MP #${row.id_lote_mp}` }));

      const [subloteRows] = await pool.query(
        `SELECT id_sublote, codigo_sublote FROM ${MATURATION_SUBLOT_TABLE} WHERE id_sublote = ?`,
        [numericId]
      );
      subloteRows.forEach((row) =>
        results.push({ tipo: 'sublote', id: row.id_sublote, etiqueta: `Sub-lote #${row.id_sublote} (${row.codigo_sublote})` })
      );

      const [procesoRows] = await pool.query(`SELECT id_proceso FROM ${PRODUCTION_TABLE} WHERE id_proceso = ?`, [numericId]);
      procesoRows.forEach((row) => results.push({ tipo: 'proceso', id: row.id_proceso, etiqueta: `Proceso de produccion #${row.id_proceso}` }));

      const [redRows] = await pool.query(`SELECT id_red FROM ${GREEN_NET_TABLE} WHERE id_red = ?`, [numericId]);
      redRows.forEach((row) => results.push({ tipo: 'red', id: row.id_red, etiqueta: `Red verde #${row.id_red}` }));

      const [existenciaRows] = await pool.query(`SELECT id_existencia FROM ${INVENTORY_TABLE} WHERE id_existencia = ?`, [numericId]);
      existenciaRows.forEach((row) => results.push({ tipo: 'existencia', id: row.id_existencia, etiqueta: `Existencia #${row.id_existencia}` }));

      return results;
    }

    const likeTerm = `%${term}%`;

    const [entradaRows] = await pool.query(
      `SELECT e.id_entrada, e.documento_referencia, e.codigo_lote, p.nombre_empresa AS proveedor_nombre FROM ${ENTRIES_TABLE} e LEFT JOIN ${PROVIDERS_TABLE} p ON p.id_proveedor = e.id_proveedor WHERE e.documento_referencia LIKE ? OR e.codigo_lote LIKE ? OR p.nombre_empresa LIKE ? ORDER BY e.id_entrada DESC LIMIT 25`,
      [likeTerm, likeTerm, likeTerm]
    );
    entradaRows.forEach((row) =>
      results.push({
        tipo: 'entrada',
        id: row.id_entrada,
        etiqueta: `Entrada #${row.id_entrada} - ${row.codigo_lote || 'sin codigo'} - ${row.proveedor_nombre || 'Sin proveedor'}`,
      })
    );

    const [productLoteRows] = await pool.query(
      `SELECT l.id_lote_mp, l.id_entrada_origen, pr.nombre AS producto_nombre FROM ${RAW_MATERIAL_LOTS_TABLE} l LEFT JOIN ${PRODUCTS_TABLE} pr ON pr.id_producto = l.id_producto WHERE pr.nombre LIKE ? ORDER BY l.id_lote_mp DESC LIMIT 25`,
      [likeTerm]
    );
    productLoteRows.forEach((row) =>
      results.push({ tipo: 'lote', id: row.id_lote_mp, etiqueta: `Lote MP #${row.id_lote_mp} - ${row.producto_nombre || ''}` })
    );

    return results;
  },
  'traceability.searchByFilters': async ({ areas, desde, hasta }) => {
    const requestedAreas = Array.isArray(areas) && areas.length > 0 ? areas : Object.keys(AREA_SEARCHERS);
    const invalidArea = requestedAreas.find((area) => !AREA_SEARCHERS[area]);

    if (invalidArea) {
      throw new Error(`area invalida: ${invalidArea}, debe ser una de: ${Object.keys(AREA_SEARCHERS).join(', ')}`);
    }

    const resultsByArea = await Promise.all(
      requestedAreas.map(async (area) => AREA_SEARCHERS[area]({ desde: desde || null, hasta: hasta || null }))
    );

    return resultsByArea.flat();
  },
};

module.exports = {
  handlers,
};
