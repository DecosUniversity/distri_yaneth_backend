const { pool } = require('../../config/db');
const {
  USERS_TABLE,
  INVENTORY_TABLE,
  MOVEMENTS_TABLE,
  PRODUCTS_TABLE,
  ENTRIES_TABLE,
  RAW_MATERIAL_LOTS_TABLE,
  MATURATION_SUBLOT_TABLE,
  CAT_MERMA_TABLE,
  CAT_STAGE_TABLE,
  PRODUCTION_TABLE,
  PRODUCTION_STAGE_TABLE,
  PRODUCTION_MERMA_TABLE,
  PRODUCTION_INSUMO_TABLE,
  PRODUCTION_COLD_ROOM_TABLE,
  PRODUCTION_ORDERS_TABLE,
  ACTIVE_STATE,
  INACTIVE_STATE,
  PRODUCTION_ACTIVE_STATE,
  PRODUCTION_FINISHED_STATE,
  PRODUCTION_ORDER_PENDIENTE_STATE,
  PRODUCTION_ORDER_EN_PROCESO_STATE,
  PRODUCTION_ORDER_COMPLETADA_STATE,
  SUBLOT_READY_STATE,
  SUBLOT_SENT_STATE,
  BALANCE_TOLERANCE_KG,
} = require('../shared/constants');
const { normalizeNullableText } = require('../shared/helpers');
const { AUDIT_ACTION_CREATE, AUDIT_ACTION_UPDATE, AUDIT_ACTION_DELETE, recordAudit } = require('../shared/audit');

const productionProcessBaseQuery = `SELECT p.id_proceso, p.id_sublote, p.id_producto_resultado, p.id_orden, p.cantidad_ingresada_kg, p.cantidad_producida_kg, p.rendimiento_porcentaje, p.estado_proceso, p.fecha_inicio, p.fecha_fin, p.cuarto_congelado, p.ubicacion_cuarto_congelado, p.observaciones, p.diferencia_kg, p.justificacion_diferencia, p.id_usuario_registro, u.nombre_completo AS usuario_nombre, p.fecha_modificacion, p.id_usuario_modificacion, um.nombre_completo AS usuario_modificacion_nombre, s.codigo_sublote, s.peso_kg AS sublote_peso_disponible, s.peso_neto_maduracion_kg, s.estado_maduracion, l.id_lote_mp, l.id_proveedor AS id_proveedor_origen, l.id_entrada_origen AS id_entrada_origen, l.id_producto AS id_producto_origen, lp.nombre AS lote_producto_nombre, ent.codigo_lote, pr.nombre AS producto_resultado_nombre, pr.unidad_medida AS producto_resultado_unidad FROM ${PRODUCTION_TABLE} p LEFT JOIN ${MATURATION_SUBLOT_TABLE} s ON s.id_sublote = p.id_sublote LEFT JOIN ${RAW_MATERIAL_LOTS_TABLE} l ON l.id_lote_mp = s.id_lote_mp LEFT JOIN ${PRODUCTS_TABLE} lp ON lp.id_producto = l.id_producto LEFT JOIN ${ENTRIES_TABLE} ent ON ent.id_entrada = l.id_entrada_origen LEFT JOIN ${PRODUCTS_TABLE} pr ON pr.id_producto = p.id_producto_resultado LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = p.id_usuario_registro LEFT JOIN ${USERS_TABLE} um ON um.id_usuario = p.id_usuario_modificacion WHERE p.estado_registro <> '${INACTIVE_STATE}'`;

const productionProcessListQuery = `SELECT base.*, COALESCE(etapas.total_etapas, 0) AS total_etapas, COALESCE(etapas.etapa_actual, '-') AS etapa_actual, COALESCE(mermas.total_merma_kg, 0) AS total_merma_kg, COALESCE(insumos.total_insumos, 0) AS total_insumos, COALESCE(cuartos.total_cuartos, 0) AS total_cuartos FROM (${productionProcessBaseQuery}) base LEFT JOIN (SELECT pe.id_proceso, COUNT(*) AS total_etapas, MAX(cte.nombre_etapa) AS etapa_actual FROM ${PRODUCTION_STAGE_TABLE} pe LEFT JOIN ${CAT_STAGE_TABLE} cte ON cte.id_tipo_etapa = pe.id_tipo_etapa WHERE pe.estado_registro = '${ACTIVE_STATE}' GROUP BY pe.id_proceso) etapas ON etapas.id_proceso = base.id_proceso LEFT JOIN (SELECT id_proceso, SUM(cantidad_kg) AS total_merma_kg FROM ${PRODUCTION_MERMA_TABLE} WHERE estado_registro = '${ACTIVE_STATE}' GROUP BY id_proceso) mermas ON mermas.id_proceso = base.id_proceso LEFT JOIN (SELECT id_proceso, COUNT(*) AS total_insumos FROM ${PRODUCTION_INSUMO_TABLE} WHERE estado_registro = '${ACTIVE_STATE}' GROUP BY id_proceso) insumos ON insumos.id_proceso = base.id_proceso LEFT JOIN (SELECT id_proceso, COUNT(*) AS total_cuartos FROM ${PRODUCTION_COLD_ROOM_TABLE} WHERE estado_registro = '${ACTIVE_STATE}' GROUP BY id_proceso) cuartos ON cuartos.id_proceso = base.id_proceso ORDER BY base.fecha_inicio DESC, base.id_proceso DESC`;

const productionStageQueries = {
  findByProcess: `SELECT e.id_etapa, e.id_proceso, e.id_tipo_etapa, cte.nombre_etapa, e.cantidad_personas, e.personal_asignado, e.fecha_inicio, e.fecha_fin, e.cantidad_entrada_kg, e.cantidad_salida_kg, e.merma_kg, e.observaciones, e.estado_registro, e.fecha_creacion, e.fecha_modificacion, e.id_usuario_modificacion, um.nombre_completo AS usuario_modificacion_nombre FROM ${PRODUCTION_STAGE_TABLE} e LEFT JOIN ${CAT_STAGE_TABLE} cte ON cte.id_tipo_etapa = e.id_tipo_etapa LEFT JOIN ${USERS_TABLE} um ON um.id_usuario = e.id_usuario_modificacion WHERE e.id_proceso = ? AND e.estado_registro = '${ACTIVE_STATE}' ORDER BY e.fecha_inicio ASC, e.id_etapa ASC`,
  findById: `SELECT e.id_etapa, e.id_proceso, e.id_tipo_etapa, cte.nombre_etapa, e.cantidad_personas, e.personal_asignado, e.fecha_inicio, e.fecha_fin, e.cantidad_entrada_kg, e.cantidad_salida_kg, e.merma_kg, e.observaciones, e.estado_registro, e.fecha_creacion, e.fecha_modificacion, e.id_usuario_modificacion, um.nombre_completo AS usuario_modificacion_nombre FROM ${PRODUCTION_STAGE_TABLE} e LEFT JOIN ${CAT_STAGE_TABLE} cte ON cte.id_tipo_etapa = e.id_tipo_etapa LEFT JOIN ${USERS_TABLE} um ON um.id_usuario = e.id_usuario_modificacion WHERE e.id_etapa = ?`,
};

const productionReportQueries = {
  mermasPorCategoria: `SELECT ctm.id_tipo_merma, ctm.nombre_merma, SUM(m.cantidad_kg) AS total_kg FROM ${PRODUCTION_MERMA_TABLE} m INNER JOIN ${CAT_MERMA_TABLE} ctm ON ctm.id_tipo_merma = m.id_tipo_merma WHERE m.estado_registro = '${ACTIVE_STATE}' GROUP BY ctm.id_tipo_merma, ctm.nombre_merma ORDER BY total_kg DESC`,
  produccionPorProducto: `SELECT pr.id_producto, pr.nombre AS producto_nombre, SUM(p.cantidad_producida_kg) AS total_kg FROM ${PRODUCTION_TABLE} p INNER JOIN ${PRODUCTS_TABLE} pr ON pr.id_producto = p.id_producto_resultado WHERE p.estado_registro = '${ACTIVE_STATE}' AND p.estado_proceso = '${PRODUCTION_FINISHED_STATE}' GROUP BY pr.id_producto, pr.nombre ORDER BY total_kg DESC`,
};

const productionMermaQueries = {
  findByProcess: `SELECT m.id_merma, m.id_proceso, m.id_etapa, m.id_tipo_merma, ctm.nombre_merma, m.cantidad_kg, m.observaciones, m.fecha_registro, m.estado_registro, m.fecha_creacion, m.fecha_modificacion, m.id_usuario_modificacion, um.nombre_completo AS usuario_modificacion_nombre FROM ${PRODUCTION_MERMA_TABLE} m LEFT JOIN ${CAT_MERMA_TABLE} ctm ON ctm.id_tipo_merma = m.id_tipo_merma LEFT JOIN ${USERS_TABLE} um ON um.id_usuario = m.id_usuario_modificacion WHERE m.id_proceso = ? AND m.estado_registro = '${ACTIVE_STATE}' ORDER BY m.fecha_registro DESC, m.id_merma DESC`,
  findById: `SELECT m.id_merma, m.id_proceso, m.id_etapa, m.id_tipo_merma, ctm.nombre_merma, m.cantidad_kg, m.observaciones, m.fecha_registro, m.estado_registro, m.fecha_creacion, m.fecha_modificacion, m.id_usuario_modificacion, um.nombre_completo AS usuario_modificacion_nombre FROM ${PRODUCTION_MERMA_TABLE} m LEFT JOIN ${CAT_MERMA_TABLE} ctm ON ctm.id_tipo_merma = m.id_tipo_merma LEFT JOIN ${USERS_TABLE} um ON um.id_usuario = m.id_usuario_modificacion WHERE m.id_merma = ?`,
};

const productionInsumoQueries = {
  findByProcess: `SELECT i.id_consumo, i.id_proceso, i.id_etapa, i.id_producto, prd.nombre AS producto_nombre, i.cantidad, i.unidad_medida, i.observaciones, i.fecha_registro, i.estado_registro, i.fecha_creacion, i.fecha_modificacion, i.id_usuario_modificacion, um.nombre_completo AS usuario_modificacion_nombre FROM ${PRODUCTION_INSUMO_TABLE} i LEFT JOIN ${PRODUCTS_TABLE} prd ON prd.id_producto = i.id_producto LEFT JOIN ${USERS_TABLE} um ON um.id_usuario = i.id_usuario_modificacion WHERE i.id_proceso = ? AND i.estado_registro = '${ACTIVE_STATE}' ORDER BY i.fecha_registro DESC, i.id_consumo DESC`,
  findById: `SELECT i.id_consumo, i.id_proceso, i.id_etapa, i.id_producto, prd.nombre AS producto_nombre, i.cantidad, i.unidad_medida, i.observaciones, i.fecha_registro, i.estado_registro, i.fecha_creacion, i.fecha_modificacion, i.id_usuario_modificacion, um.nombre_completo AS usuario_modificacion_nombre FROM ${PRODUCTION_INSUMO_TABLE} i LEFT JOIN ${PRODUCTS_TABLE} prd ON prd.id_producto = i.id_producto LEFT JOIN ${USERS_TABLE} um ON um.id_usuario = i.id_usuario_modificacion WHERE i.id_consumo = ?`,
};

const productionColdRoomQueries = {
  findByProcess: `SELECT c.id_ingreso_cuarto, c.id_proceso, c.fecha_ingreso, c.ubicacion_cuarto, c.cantidad_kg, c.observaciones, c.estado_registro, c.fecha_creacion, c.fecha_modificacion, c.id_usuario_modificacion, um.nombre_completo AS usuario_modificacion_nombre FROM ${PRODUCTION_COLD_ROOM_TABLE} c LEFT JOIN ${USERS_TABLE} um ON um.id_usuario = c.id_usuario_modificacion WHERE c.id_proceso = ? AND c.estado_registro = '${ACTIVE_STATE}' ORDER BY c.fecha_ingreso DESC, c.id_ingreso_cuarto DESC`,
  findById: `SELECT c.id_ingreso_cuarto, c.id_proceso, c.fecha_ingreso, c.ubicacion_cuarto, c.cantidad_kg, c.observaciones, c.estado_registro, c.fecha_creacion, c.fecha_modificacion, c.id_usuario_modificacion, um.nombre_completo AS usuario_modificacion_nombre FROM ${PRODUCTION_COLD_ROOM_TABLE} c LEFT JOIN ${USERS_TABLE} um ON um.id_usuario = c.id_usuario_modificacion WHERE c.id_ingreso_cuarto = ?`,
};

const productionProcessQueries = {
  findById: `SELECT id_proceso, id_sublote, id_producto_resultado, id_orden, cantidad_ingresada_kg, cantidad_producida_kg, rendimiento_porcentaje, estado_proceso, fecha_inicio, fecha_fin, cuarto_congelado, ubicacion_cuarto_congelado, observaciones, justificacion_reversion, id_usuario_registro, estado_registro FROM ${PRODUCTION_TABLE} WHERE id_proceso = ? AND estado_registro <> '${INACTIVE_STATE}'`,
  findOrderForUpdate: `SELECT id_orden, id_producto, cantidad_solicitada_kg, cantidad_producida_kg, estado, estado_registro FROM ${PRODUCTION_ORDERS_TABLE} WHERE id_orden = ? AND estado_registro = '${ACTIVE_STATE}' FOR UPDATE`,
  findSublotForUpdate: `SELECT id_sublote, id_lote_mp, peso_kg, peso_neto_maduracion_kg, estado_registro, estado_maduracion FROM ${MATURATION_SUBLOT_TABLE} WHERE id_sublote = ? FOR UPDATE`,
  findInsumoExistencia: `SELECT ie.id_existencia, COALESCE(stock.cantidad_disponible, 0) AS cantidad_disponible FROM ${INVENTORY_TABLE} ie LEFT JOIN (SELECT id_existencia, SUM(CASE WHEN tipo_movimiento = 'Entrada' THEN cantidad WHEN tipo_movimiento IN ('Salida', 'Ajuste', 'Desperdicio') THEN -cantidad ELSE 0 END) AS cantidad_disponible FROM ${MOVEMENTS_TABLE} WHERE estado_registro = '${ACTIVE_STATE}' GROUP BY id_existencia) stock ON stock.id_existencia = ie.id_existencia WHERE ie.id_producto = ? AND ie.estado_registro = '${ACTIVE_STATE}' ORDER BY ie.fecha_vencimiento ASC, ie.id_existencia ASC FOR UPDATE`,
};

const loadProductionProcessDetail = async (connection, id) => {
  const [processRows] = await connection.query(productionProcessBaseQuery + ' AND p.id_proceso = ? LIMIT 1', [id]);

  if (processRows.length === 0) {
    return null;
  }

  const [etapas] = await connection.query(productionStageQueries.findByProcess, [id]);
  const [mermas] = await connection.query(productionMermaQueries.findByProcess, [id]);
  const [insumos] = await connection.query(productionInsumoQueries.findByProcess, [id]);
  const [cuartosFrio] = await connection.query(productionColdRoomQueries.findByProcess, [id]);

  const process = processRows[0];
  const totalMermaKg = mermas.reduce((sum, item) => sum + (Number(item.cantidad_kg) || 0), 0);
  const totalInsumos = insumos.reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0);

  return {
    ...process,
    total_merma_kg: totalMermaKg,
    total_insumos: totalInsumos,
    etapas,
    mermas,
    insumos,
    cuartos_frio: cuartosFrio,
  };
};

const recomputeStageMermaAndSalida = async (connection, idEtapa, userId) => {
  if (idEtapa === null || idEtapa === undefined || idEtapa === '') {
    return;
  }

  const [beforeRows] = await connection.query(productionStageQueries.findById, [idEtapa]);

  const [mermaRows] = await connection.query(
    `SELECT COALESCE(SUM(cantidad_kg), 0) AS total FROM ${PRODUCTION_MERMA_TABLE} WHERE id_etapa = ? AND estado_registro = '${ACTIVE_STATE}'`,
    [idEtapa]
  );
  const mermaTotal = Number(mermaRows[0]?.total || 0);

  const [stageRows] = await connection.query(
    `SELECT cantidad_entrada_kg FROM ${PRODUCTION_STAGE_TABLE} WHERE id_etapa = ?`,
    [idEtapa]
  );

  if (stageRows.length === 0) {
    return;
  }

  const entrada = stageRows[0].cantidad_entrada_kg;
  const salida = entrada === null || entrada === undefined ? null : Math.max(0, Number(entrada) - mermaTotal);

  await connection.query(
    `UPDATE ${PRODUCTION_STAGE_TABLE} SET merma_kg = ?, cantidad_salida_kg = ? WHERE id_etapa = ?`,
    [mermaTotal, salida, idEtapa]
  );

  const [afterRows] = await connection.query(productionStageQueries.findById, [idEtapa]);

  await recordAudit(connection, {
    table: PRODUCTION_STAGE_TABLE,
    recordId: idEtapa,
    action: AUDIT_ACTION_UPDATE,
    before: beforeRows[0] || null,
    after: afterRows[0] || null,
    userId,
  });
};

const handlers = {
  'productionProcesses.findAll': async () => {
    const [rows] = await pool.query(productionProcessListQuery);
    return rows;
  },
  'productionProcesses.reportMermasPorCategoria': async () => {
    const [rows] = await pool.query(productionReportQueries.mermasPorCategoria);
    return rows;
  },
  'productionProcesses.reportProduccionPorProducto': async () => {
    const [rows] = await pool.query(productionReportQueries.produccionPorProducto);
    return rows;
  },
  'productionProcesses.findById': async ({ id }) => {
    return loadProductionProcessDetail(pool, id);
  },
  'productionProcesses.create': async ({
    id_sublote,
    id_producto_resultado,
    id_orden,
    cantidad_ingresada_kg,
    fecha_inicio,
    cuarto_congelado,
    ubicacion_cuarto_congelado,
    observaciones,
    id_usuario_registro,
  }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [sublotRows] = await connection.query(productionProcessQueries.findSublotForUpdate, [id_sublote]);
      if (sublotRows.length === 0 || sublotRows[0].estado_registro !== SUBLOT_READY_STATE) {
        await connection.rollback();
        return null;
      }

      const sublot = sublotRows[0];
      const availableKg = Number(sublot.peso_kg);
      const requestedKg = Number(cantidad_ingresada_kg);

      if (!Number.isFinite(requestedKg) || requestedKg <= 0 || requestedKg > availableKg) {
        await connection.rollback();
        throw new Error('La cantidad ingresada supera el peso disponible del sub-lote');
      }

      let orderRow = null;

      if (id_orden) {
        const [orderRows] = await connection.query(productionProcessQueries.findOrderForUpdate, [id_orden]);

        if (orderRows.length === 0) {
          await connection.rollback();
          throw new Error('La orden de produccion seleccionada no existe');
        }

        orderRow = orderRows[0];

        if (![PRODUCTION_ORDER_PENDIENTE_STATE, PRODUCTION_ORDER_EN_PROCESO_STATE].includes(orderRow.estado)) {
          await connection.rollback();
          throw new Error('La orden de produccion ya no esta disponible (Completada o Cancelada)');
        }

        if (Number(orderRow.id_producto) !== Number(id_producto_resultado)) {
          await connection.rollback();
          throw new Error('El producto del proceso no coincide con el producto de la orden de produccion');
        }
      }

      const nextWeight = availableKg - requestedKg;
      const nextState = nextWeight <= 0 ? SUBLOT_SENT_STATE : SUBLOT_READY_STATE;

      await connection.query(
        `UPDATE ${MATURATION_SUBLOT_TABLE} SET peso_kg = ?, estado_registro = ?, id_usuario_modificacion = ? WHERE id_sublote = ?`,
        [nextWeight, nextState, id_usuario_registro ?? null, id_sublote]
      );

      const [updatedSublotRows] = await connection.query(productionProcessQueries.findSublotForUpdate, [id_sublote]);

      await recordAudit(connection, {
        table: MATURATION_SUBLOT_TABLE,
        recordId: id_sublote,
        action: AUDIT_ACTION_UPDATE,
        before: sublot,
        after: updatedSublotRows[0] || null,
        userId: id_usuario_registro,
      });

      const [result] = await connection.query(
        `INSERT INTO ${PRODUCTION_TABLE} (id_sublote, id_producto_resultado, id_orden, cantidad_ingresada_kg, estado_proceso, fecha_inicio, cuarto_congelado, ubicacion_cuarto_congelado, observaciones, id_usuario_registro, estado_registro, id_usuario_modificacion) VALUES (?, ?, ?, ?, ?, COALESCE(?, NOW()), ?, ?, ?, ?, ?, ?)`,
        [
          id_sublote,
          id_producto_resultado,
          id_orden || null,
          requestedKg,
          PRODUCTION_ACTIVE_STATE,
          fecha_inicio ?? null,
          normalizeNullableText(cuarto_congelado),
          normalizeNullableText(ubicacion_cuarto_congelado),
          normalizeNullableText(observaciones),
          id_usuario_registro ?? null,
          ACTIVE_STATE,
          id_usuario_registro ?? null,
        ]
      );

      const [createdProcessRows] = await connection.query(productionProcessQueries.findById, [result.insertId]);

      await recordAudit(connection, {
        table: PRODUCTION_TABLE,
        recordId: result.insertId,
        action: AUDIT_ACTION_CREATE,
        before: null,
        after: createdProcessRows[0] || null,
        userId: id_usuario_registro,
      });

      if (orderRow && orderRow.estado === PRODUCTION_ORDER_PENDIENTE_STATE) {
        await connection.query(`UPDATE ${PRODUCTION_ORDERS_TABLE} SET estado = ?, id_usuario_modificacion = ? WHERE id_orden = ?`, [
          PRODUCTION_ORDER_EN_PROCESO_STATE,
          id_usuario_registro ?? null,
          id_orden,
        ]);
      }

      await connection.commit();
      return loadProductionProcessDetail(connection, result.insertId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'productionProcesses.addStage': async ({
    id,
    id_tipo_etapa,
    cantidad_personas,
    personal_asignado,
    fecha_inicio,
    cantidad_entrada_kg,
    observaciones,
    id_usuario_modificacion,
  }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [processRows] = await connection.query(productionProcessQueries.findById, [id]);
      if (processRows.length === 0 || processRows[0].estado_proceso === PRODUCTION_FINISHED_STATE) {
        await connection.rollback();
        return null;
      }

      const [result] = await connection.query(
        `INSERT INTO ${PRODUCTION_STAGE_TABLE} (id_proceso, id_tipo_etapa, cantidad_personas, personal_asignado, fecha_inicio, cantidad_entrada_kg, observaciones, estado_registro, id_usuario_modificacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          id_tipo_etapa,
          cantidad_personas,
          normalizeNullableText(personal_asignado),
          fecha_inicio,
          cantidad_entrada_kg ?? null,
          normalizeNullableText(observaciones),
          ACTIVE_STATE,
          id_usuario_modificacion ?? null,
        ]
      );

      const [createdStageRows] = await connection.query(productionStageQueries.findById, [result.insertId]);

      await recordAudit(connection, {
        table: PRODUCTION_STAGE_TABLE,
        recordId: result.insertId,
        action: AUDIT_ACTION_CREATE,
        before: null,
        after: createdStageRows[0] || null,
        userId: id_usuario_modificacion,
      });

      await connection.commit();
      return createdStageRows[0] || null;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'productionProcesses.updateStage': async ({
    id,
    id_etapa,
    id_tipo_etapa,
    cantidad_personas,
    personal_asignado,
    fecha_inicio,
    fecha_fin,
    cantidad_entrada_kg,
    observaciones,
    id_usuario_modificacion,
  }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [beforeRows] = await connection.query(productionStageQueries.findById, [id_etapa]);

      const [result] = await connection.query(
        `UPDATE ${PRODUCTION_STAGE_TABLE} SET id_tipo_etapa = ?, cantidad_personas = ?, personal_asignado = ?, fecha_inicio = ?, fecha_fin = ?, cantidad_entrada_kg = ?, observaciones = ?, id_usuario_modificacion = ? WHERE id_etapa = ? AND id_proceso = ? AND estado_registro = '${ACTIVE_STATE}'`,
        [
          id_tipo_etapa,
          cantidad_personas ?? null,
          normalizeNullableText(personal_asignado),
          fecha_inicio,
          fecha_fin ?? null,
          cantidad_entrada_kg ?? null,
          normalizeNullableText(observaciones),
          id_usuario_modificacion ?? null,
          id_etapa,
          id,
        ]
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        return null;
      }

      const [afterDirectRows] = await connection.query(productionStageQueries.findById, [id_etapa]);

      await recordAudit(connection, {
        table: PRODUCTION_STAGE_TABLE,
        recordId: id_etapa,
        action: AUDIT_ACTION_UPDATE,
        before: beforeRows[0] || null,
        after: afterDirectRows[0] || null,
        userId: id_usuario_modificacion,
      });

      // La merma y la salida se derivan siempre de las mermas categorizadas registradas
      // para esta etapa (produccion_mermas), nunca de lo que envie el cliente.
      await recomputeStageMermaAndSalida(connection, id_etapa, id_usuario_modificacion);

      await connection.commit();

      const [rows] = await pool.query(productionStageQueries.findById, [id_etapa]);
      return rows[0] || null;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'productionProcesses.addMerma': async ({ id, id_etapa, id_tipo_merma, cantidad_kg, observaciones, id_usuario_modificacion }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [processRows] = await connection.query(productionProcessQueries.findById, [id]);
      if (processRows.length === 0 || processRows[0].estado_proceso === PRODUCTION_FINISHED_STATE) {
        await connection.rollback();
        return null;
      }

      const [result] = await connection.query(
        `INSERT INTO ${PRODUCTION_MERMA_TABLE} (id_proceso, id_etapa, id_tipo_merma, cantidad_kg, observaciones, estado_registro, id_usuario_modificacion) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, id_etapa ?? null, id_tipo_merma, cantidad_kg, normalizeNullableText(observaciones), ACTIVE_STATE, id_usuario_modificacion ?? null]
      );

      const [createdMermaRows] = await connection.query(productionMermaQueries.findById, [result.insertId]);

      await recordAudit(connection, {
        table: PRODUCTION_MERMA_TABLE,
        recordId: result.insertId,
        action: AUDIT_ACTION_CREATE,
        before: null,
        after: createdMermaRows[0] || null,
        userId: id_usuario_modificacion,
      });

      // Si la merma pertenece a una etapa, su merma_kg/cantidad_salida_kg se actualizan
      // solos, sin necesidad de volver a abrir y guardar el formulario de la etapa.
      await recomputeStageMermaAndSalida(connection, id_etapa, id_usuario_modificacion);

      await connection.commit();
      return createdMermaRows[0] || null;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'productionProcesses.addInsumo': async ({ id, id_etapa, id_producto, cantidad, unidad_medida, observaciones, id_usuario_modificacion }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [processRows] = await connection.query(productionProcessQueries.findById, [id]);
      if (processRows.length === 0 || processRows[0].estado_proceso === PRODUCTION_FINISHED_STATE) {
        await connection.rollback();
        return null;
      }

      const requestedQty = Number(cantidad);
      const [existenciaRows] = await connection.query(productionProcessQueries.findInsumoExistencia, [id_producto]);
      const existencia = existenciaRows.find((row) => Number(row.cantidad_disponible) >= requestedQty);

      if (!existencia) {
        await connection.rollback();
        throw new Error('No hay suficiente inventario disponible para el insumo seleccionado');
      }

      await connection.query(
        `INSERT INTO ${MOVEMENTS_TABLE} (id_existencia, tipo_movimiento, cantidad, motivo, id_usuario, estado_registro) VALUES (?, 'Salida', ?, ?, ?, ?)`,
        [existencia.id_existencia, requestedQty, `Consumo en produccion #${id}`, id_usuario_modificacion ?? null, ACTIVE_STATE]
      );

      const [result] = await connection.query(
        `INSERT INTO ${PRODUCTION_INSUMO_TABLE} (id_proceso, id_etapa, id_producto, cantidad, unidad_medida, observaciones, estado_registro, id_usuario_modificacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, id_etapa ?? null, id_producto, requestedQty, unidad_medida, normalizeNullableText(observaciones), ACTIVE_STATE, id_usuario_modificacion ?? null]
      );

      const [createdInsumoRows] = await connection.query(productionInsumoQueries.findById, [result.insertId]);

      await recordAudit(connection, {
        table: PRODUCTION_INSUMO_TABLE,
        recordId: result.insertId,
        action: AUDIT_ACTION_CREATE,
        before: null,
        after: createdInsumoRows[0] || null,
        userId: id_usuario_modificacion,
      });

      await connection.commit();
      return createdInsumoRows[0] || null;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'productionProcesses.addColdRoomEntry': async ({ id, fecha_ingreso, ubicacion_cuarto, cantidad_kg, observaciones, id_usuario_modificacion }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [processRows] = await connection.query(productionProcessQueries.findById, [id]);
      if (processRows.length === 0 || processRows[0].estado_proceso === PRODUCTION_FINISHED_STATE) {
        await connection.rollback();
        return null;
      }

      const [result] = await connection.query(
        `INSERT INTO ${PRODUCTION_COLD_ROOM_TABLE} (id_proceso, fecha_ingreso, ubicacion_cuarto, cantidad_kg, observaciones, estado_registro, id_usuario_modificacion) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, fecha_ingreso, ubicacion_cuarto, cantidad_kg, normalizeNullableText(observaciones), ACTIVE_STATE, id_usuario_modificacion ?? null]
      );

      const [createdColdRoomRows] = await connection.query(productionColdRoomQueries.findById, [result.insertId]);

      await recordAudit(connection, {
        table: PRODUCTION_COLD_ROOM_TABLE,
        recordId: result.insertId,
        action: AUDIT_ACTION_CREATE,
        before: null,
        after: createdColdRoomRows[0] || null,
        userId: id_usuario_modificacion,
      });

      const processBefore = processRows[0];

      await connection.query(
        `UPDATE ${PRODUCTION_TABLE} SET cuarto_congelado = COALESCE(?, cuarto_congelado), ubicacion_cuarto_congelado = COALESCE(?, ubicacion_cuarto_congelado), id_usuario_modificacion = ? WHERE id_proceso = ?`,
        [ubicacion_cuarto, ubicacion_cuarto, id_usuario_modificacion ?? null, id]
      );

      const [updatedProcessRows] = await connection.query(productionProcessQueries.findById, [id]);

      await recordAudit(connection, {
        table: PRODUCTION_TABLE,
        recordId: id,
        action: AUDIT_ACTION_UPDATE,
        before: processBefore,
        after: updatedProcessRows[0] || null,
        userId: id_usuario_modificacion,
      });

      await connection.commit();
      return createdColdRoomRows[0] || null;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'productionProcesses.finalize': async ({
    id,
    cantidad_producida_kg,
    fecha_fin,
    fecha_vencimiento,
    cuarto_congelado,
    ubicacion_cuarto_congelado,
    observaciones,
    costo_unitario,
    justificacion_diferencia,
    id_usuario_modificacion,
  }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [processRows] = await connection.query(productionProcessQueries.findById, [id]);
      if (processRows.length === 0) {
        await connection.rollback();
        return null;
      }

      const process = processRows[0];

      if (process.estado_proceso === PRODUCTION_FINISHED_STATE) {
        await connection.rollback();
        throw new Error('El proceso ya fue finalizado');
      }

      const inputKg = Number(process.cantidad_ingresada_kg || 0);
      const outputKg = Number(cantidad_producida_kg || 0);

      if (!Number.isFinite(outputKg) || outputKg < 0) {
        await connection.rollback();
        throw new Error('La cantidad producida no es valida');
      }

      if (outputKg > inputKg) {
        await connection.rollback();
        throw new Error('La cantidad producida no puede superar la cantidad ingresada');
      }

      const rendimiento = inputKg > 0 ? (outputKg / inputKg) * 100 : 0;

      const [mermaTotalRows] = await connection.query(
        `SELECT COALESCE(SUM(cantidad_kg), 0) AS total FROM ${PRODUCTION_MERMA_TABLE} WHERE id_proceso = ? AND estado_registro = '${ACTIVE_STATE}'`,
        [id]
      );
      const totalMermaKg = Number(mermaTotalRows[0]?.total || 0);
      const expectedOutputKg = inputKg - totalMermaKg;
      const differenceKg = Number((expectedOutputKg - outputKg).toFixed(2));
      const justification = normalizeNullableText(justificacion_diferencia);

      if (Math.abs(differenceKg) > BALANCE_TOLERANCE_KG && !justification) {
        await connection.rollback();
        throw new Error(
          `El peso no cuadra: ingresado (${inputKg.toFixed(2)} kg) - mermas (${totalMermaKg.toFixed(2)} kg) = ${expectedOutputKg.toFixed(2)} kg, pero se reporto ${outputKg.toFixed(2)} kg. Debes justificar la diferencia de ${differenceKg.toFixed(2)} kg.`
        );
      }

      await connection.query(
        `UPDATE ${PRODUCTION_TABLE} SET cantidad_producida_kg = ?, rendimiento_porcentaje = ?, estado_proceso = '${PRODUCTION_FINISHED_STATE}', fecha_fin = ?, cuarto_congelado = COALESCE(?, cuarto_congelado), ubicacion_cuarto_congelado = COALESCE(?, ubicacion_cuarto_congelado), observaciones = COALESCE(?, observaciones), diferencia_kg = ?, justificacion_diferencia = ?, id_usuario_modificacion = ? WHERE id_proceso = ?`,
        [
          outputKg,
          rendimiento,
          fecha_fin,
          normalizeNullableText(cuarto_congelado),
          normalizeNullableText(ubicacion_cuarto_congelado),
          normalizeNullableText(observaciones),
          differenceKg,
          justification,
          id_usuario_modificacion ?? null,
          id,
        ]
      );

      const [finalizedProcessRows] = await connection.query(productionProcessQueries.findById, [id]);

      await recordAudit(connection, {
        table: PRODUCTION_TABLE,
        recordId: id,
        action: AUDIT_ACTION_UPDATE,
        before: process,
        after: finalizedProcessRows[0] || null,
        userId: id_usuario_modificacion,
      });

      if (process.id_orden) {
        const [orderRows] = await connection.query(productionProcessQueries.findOrderForUpdate, [process.id_orden]);

        if (orderRows.length > 0) {
          const orderBefore = orderRows[0];

          const [totalRows] = await connection.query(
            `SELECT COALESCE(SUM(cantidad_producida_kg), 0) AS total FROM ${PRODUCTION_TABLE} WHERE id_orden = ? AND estado_registro = '${ACTIVE_STATE}'`,
            [process.id_orden]
          );
          const totalProducido = Number(totalRows[0]?.total || 0);
          const nextEstado =
            totalProducido >= Number(orderBefore.cantidad_solicitada_kg)
              ? PRODUCTION_ORDER_COMPLETADA_STATE
              : orderBefore.estado;

          await connection.query(
            `UPDATE ${PRODUCTION_ORDERS_TABLE} SET cantidad_producida_kg = ?, estado = ?, id_usuario_modificacion = ? WHERE id_orden = ?`,
            [totalProducido, nextEstado, id_usuario_modificacion ?? null, process.id_orden]
          );
        }
      }

      if (outputKg > 0) {
        const [lotRows] = await connection.query(
          `SELECT l.id_proveedor FROM ${MATURATION_SUBLOT_TABLE} s LEFT JOIN ${RAW_MATERIAL_LOTS_TABLE} l ON l.id_lote_mp = s.id_lote_mp WHERE s.id_sublote = ? LIMIT 1`,
          [process.id_sublote]
        );
        const supplierId = lotRows[0]?.id_proveedor ?? null;

        const [existingInventoryRows] = await connection.query(
          `SELECT id_existencia FROM ${INVENTORY_TABLE} WHERE id_proceso_origen = ? AND id_producto = ? AND estado_registro = '${ACTIVE_STATE}' LIMIT 1`,
          [id, process.id_producto_resultado]
        );

        let existenceId;

        if (existingInventoryRows.length > 0) {
          existenceId = existingInventoryRows[0].id_existencia;

          const [inventoryBeforeRows] = await connection.query(
            `SELECT * FROM ${INVENTORY_TABLE} WHERE id_existencia = ?`,
            [existenceId]
          );

          await connection.query(
            `UPDATE ${INVENTORY_TABLE} SET id_proveedor = ?, fecha_vencimiento = ?, costo_unitario = COALESCE(?, costo_unitario), estado_registro = '${ACTIVE_STATE}', id_usuario_modificacion = ? WHERE id_existencia = ?`,
            [supplierId, fecha_vencimiento, costo_unitario ?? null, id_usuario_modificacion ?? null, existenceId]
          );

          const [inventoryAfterRows] = await connection.query(
            `SELECT * FROM ${INVENTORY_TABLE} WHERE id_existencia = ?`,
            [existenceId]
          );

          await recordAudit(connection, {
            table: INVENTORY_TABLE,
            recordId: existenceId,
            action: AUDIT_ACTION_UPDATE,
            before: inventoryBeforeRows[0] || null,
            after: inventoryAfterRows[0] || null,
            userId: id_usuario_modificacion,
          });
        } else {
          const [existenceResult] = await connection.query(
            `INSERT INTO ${INVENTORY_TABLE} (id_producto, id_proveedor, id_proceso_origen, id_entrada_origen, fecha_vencimiento, cantidad_disponible, costo_unitario, estado_registro, id_usuario_modificacion) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
            [process.id_producto_resultado, supplierId, id, fecha_vencimiento, 0, costo_unitario ?? null, ACTIVE_STATE, id_usuario_modificacion ?? null]
          );
          existenceId = existenceResult.insertId;

          const [inventoryCreatedRows] = await connection.query(
            `SELECT * FROM ${INVENTORY_TABLE} WHERE id_existencia = ?`,
            [existenceId]
          );

          await recordAudit(connection, {
            table: INVENTORY_TABLE,
            recordId: existenceId,
            action: AUDIT_ACTION_CREATE,
            before: null,
            after: inventoryCreatedRows[0] || null,
            userId: id_usuario_modificacion,
          });
        }

        await connection.query(
          `INSERT INTO ${MOVEMENTS_TABLE} (id_existencia, tipo_movimiento, cantidad, motivo, id_usuario, estado_registro) VALUES (?, 'Entrada', ?, ?, ?, ?)`,
          [existenceId, outputKg, `Produccion finalizada #${id}`, id_usuario_modificacion ?? process.id_usuario_registro ?? null, ACTIVE_STATE]
        );
      }

      await connection.commit();
      return loadProductionProcessDetail(connection, id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'productionProcesses.remove': async ({ id, id_usuario_modificacion }) => {
    const [beforeRows] = await pool.query(productionProcessQueries.findById, [id]);

    const [result] = await pool.query(
      `UPDATE ${PRODUCTION_TABLE} SET estado_registro = '${INACTIVE_STATE}', id_usuario_modificacion = ? WHERE id_proceso = ? AND estado_registro <> '${INACTIVE_STATE}'`,
      [id_usuario_modificacion ?? null, id]
    );

    if (result.affectedRows > 0) {
      await recordAudit(pool, {
        table: PRODUCTION_TABLE,
        recordId: id,
        action: AUDIT_ACTION_DELETE,
        before: beforeRows[0] || null,
        after: null,
        userId: id_usuario_modificacion,
      });
    }

    return result.affectedRows > 0;
  },
  'productionProcesses.revert': async ({ id, peso_a_revertir, justificacion_reversion, id_usuario_modificacion }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [processRows] = await connection.query(
        `SELECT id_proceso, id_sublote, cantidad_ingresada_kg, estado_proceso FROM ${PRODUCTION_TABLE} WHERE id_proceso = ? AND estado_registro = '${ACTIVE_STATE}' FOR UPDATE`,
        [id]
      );

      if (processRows.length === 0) {
        await connection.rollback();
        return null;
      }

      const process = processRows[0];

      if (process.estado_proceso === PRODUCTION_FINISHED_STATE) {
        await connection.rollback();
        throw new Error('El proceso ya fue finalizado y no puede revertirse');
      }

      const [stageCountRows] = await connection.query(
        `SELECT COUNT(*) AS total FROM ${PRODUCTION_STAGE_TABLE} WHERE id_proceso = ? AND estado_registro = '${ACTIVE_STATE}'`,
        [id]
      );

      const [mermaTotalRows] = await connection.query(
        `SELECT COUNT(*) AS total, COALESCE(SUM(cantidad_kg), 0) AS totalKg FROM ${PRODUCTION_MERMA_TABLE} WHERE id_proceso = ? AND estado_registro = '${ACTIVE_STATE}'`,
        [id]
      );

      const [insumoCountRows] = await connection.query(
        `SELECT COUNT(*) AS total FROM ${PRODUCTION_INSUMO_TABLE} WHERE id_proceso = ? AND estado_registro = '${ACTIVE_STATE}'`,
        [id]
      );

      const hasWork =
        Number(stageCountRows[0].total) > 0 ||
        Number(mermaTotalRows[0].total) > 0 ||
        Number(insumoCountRows[0].total) > 0;

      const inputKg = Number(process.cantidad_ingresada_kg || 0);
      const totalMermaKg = Number(mermaTotalRows[0].totalKg || 0);
      const expectedRemainingKg = inputKg - totalMermaKg;

      let restoreKg = inputKg;
      let justification = null;

      // Si ya hubo trabajo (etapas, mermas o insumos), revertir ya no es un click
      // simple: hay que declarar cuanto peso se devuelve y justificar por que se
      // cancela, y ese peso declarado debe cuadrar con ingresado - mermas. Si no
      // cuadra, es señal de que ya se produjo algo y este proceso debe finalizarse
      // en vez de revertirse.
      if (hasWork) {
        const declaredKg =
          peso_a_revertir === undefined || peso_a_revertir === null || peso_a_revertir === ''
            ? NaN
            : Number(peso_a_revertir);

        if (!Number.isFinite(declaredKg) || declaredKg < 0) {
          await connection.rollback();
          throw new Error(
            'Debes declarar el peso a revertir cuando el proceso ya tiene etapas, mermas o insumos registrados'
          );
        }

        justification = normalizeNullableText(justificacion_reversion);

        if (!justification) {
          await connection.rollback();
          throw new Error('Debes justificar la reversion cuando el proceso ya tiene trabajo registrado');
        }

        const differenceKg = Number((expectedRemainingKg - declaredKg).toFixed(2));

        if (Math.abs(differenceKg) > BALANCE_TOLERANCE_KG) {
          await connection.rollback();
          throw new Error(
            `El peso no cuadra: ingresado (${inputKg.toFixed(2)} kg) - mermas (${totalMermaKg.toFixed(2)} kg) = ${expectedRemainingKg.toFixed(2)} kg, pero declaraste ${declaredKg.toFixed(2)} kg. Si ya se produjo algo, finaliza el proceso en vez de revertirlo; si fue merma adicional, registrala primero.`
          );
        }

        restoreKg = declaredKg;
      }

      const [sublotRows] = await connection.query(
        `SELECT id_sublote, peso_kg FROM ${MATURATION_SUBLOT_TABLE} WHERE id_sublote = ? FOR UPDATE`,
        [process.id_sublote]
      );

      if (sublotRows.length > 0) {
        const restoredWeight = Number(sublotRows[0].peso_kg) + restoreKg;

        await connection.query(
          `UPDATE ${MATURATION_SUBLOT_TABLE} SET peso_kg = ?, estado_registro = '${SUBLOT_READY_STATE}', id_usuario_modificacion = ? WHERE id_sublote = ?`,
          [restoredWeight, id_usuario_modificacion ?? null, process.id_sublote]
        );

        const [restoredSublotRows] = await connection.query(
          `SELECT id_sublote, peso_kg, estado_registro FROM ${MATURATION_SUBLOT_TABLE} WHERE id_sublote = ?`,
          [process.id_sublote]
        );

        await recordAudit(connection, {
          table: MATURATION_SUBLOT_TABLE,
          recordId: process.id_sublote,
          action: AUDIT_ACTION_UPDATE,
          before: sublotRows[0],
          after: restoredSublotRows[0] || null,
          userId: id_usuario_modificacion,
        });
      }

      const [fullProcessBeforeRows] = await connection.query(productionProcessQueries.findById, [id]);

      await connection.query(
        `UPDATE ${PRODUCTION_TABLE} SET estado_registro = '${INACTIVE_STATE}', justificacion_reversion = ?, id_usuario_modificacion = ? WHERE id_proceso = ?`,
        [justification, id_usuario_modificacion ?? null, id]
      );

      await recordAudit(connection, {
        table: PRODUCTION_TABLE,
        recordId: id,
        action: AUDIT_ACTION_DELETE,
        before: fullProcessBeforeRows[0] || null,
        after: null,
        userId: id_usuario_modificacion,
      });

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
};

module.exports = {
  handlers,
};
