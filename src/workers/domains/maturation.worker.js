const { pool } = require('../../config/db');
const {
  USERS_TABLE,
  PROVIDERS_TABLE,
  INVENTORY_TABLE,
  MOVEMENTS_TABLE,
  PRODUCTS_TABLE,
  RAW_MATERIAL_LOTS_TABLE,
  MATURATION_SUBLOT_TABLE,
  MATURATION_CONTROL_TABLE,
  ACTIVE_STATE,
  INACTIVE_STATE,
  PENDING_STATE,
  SUBLOT_ACTIVE_STATE,
  SUBLOT_READY_STATE,
  MATURE_RIPENESS_STATE,
  MATURATION_BRIX_THRESHOLD,
} = require('../shared/constants');
const { normalizeNullableText } = require('../shared/helpers');
const { AUDIT_ACTION_CREATE, AUDIT_ACTION_UPDATE, AUDIT_ACTION_DELETE, recordAudit } = require('../shared/audit');

const maturationLotQueries = {
  findAll: `SELECT l.id_lote_mp, l.id_producto, p.nombre AS producto_nombre, l.id_proveedor, pr.nombre_empresa AS proveedor_nombre, l.id_entrada_origen, l.fecha_recepcion, l.cantidad_unidades, l.peso_inicial_kg, COALESCE(sub.peso_disponible_kg, 0) AS peso_disponible_kg, l.estado_maduracion, l.estado_registro, l.fecha_modificacion, l.id_usuario_modificacion, um.nombre_completo AS usuario_modificacion_nombre FROM ${RAW_MATERIAL_LOTS_TABLE} l LEFT JOIN ${PRODUCTS_TABLE} p ON p.id_producto = l.id_producto LEFT JOIN ${PROVIDERS_TABLE} pr ON pr.id_proveedor = l.id_proveedor LEFT JOIN ${USERS_TABLE} um ON um.id_usuario = l.id_usuario_modificacion LEFT JOIN (SELECT id_lote_mp, SUM(peso_kg) AS peso_disponible_kg FROM ${MATURATION_SUBLOT_TABLE} GROUP BY id_lote_mp) sub ON sub.id_lote_mp = l.id_lote_mp WHERE l.estado_registro <> '${INACTIVE_STATE}' ORDER BY l.fecha_recepcion DESC, l.id_lote_mp DESC`,
  findById: `SELECT l.id_lote_mp, l.id_producto, p.nombre AS producto_nombre, l.id_proveedor, pr.nombre_empresa AS proveedor_nombre, l.id_entrada_origen, l.fecha_recepcion, l.cantidad_unidades, l.peso_inicial_kg, COALESCE(sub.peso_disponible_kg, 0) AS peso_disponible_kg, l.estado_maduracion, l.estado_registro, l.fecha_modificacion, l.id_usuario_modificacion, um.nombre_completo AS usuario_modificacion_nombre FROM ${RAW_MATERIAL_LOTS_TABLE} l LEFT JOIN ${PRODUCTS_TABLE} p ON p.id_producto = l.id_producto LEFT JOIN ${PROVIDERS_TABLE} pr ON pr.id_proveedor = l.id_proveedor LEFT JOIN ${USERS_TABLE} um ON um.id_usuario = l.id_usuario_modificacion LEFT JOIN (SELECT id_lote_mp, SUM(peso_kg) AS peso_disponible_kg FROM ${MATURATION_SUBLOT_TABLE} GROUP BY id_lote_mp) sub ON sub.id_lote_mp = l.id_lote_mp WHERE l.id_lote_mp = ? AND l.estado_registro <> '${INACTIVE_STATE}'`,
  findForUpdate: `SELECT id_lote_mp, id_producto, id_proveedor, peso_inicial_kg, cantidad_unidades, estado_maduracion, estado_registro FROM ${RAW_MATERIAL_LOTS_TABLE} WHERE id_lote_mp = ? AND estado_registro <> '${INACTIVE_STATE}' FOR UPDATE`,
};

const maturationSublotBaseQuery = `SELECT s.id_sublote, s.id_lote_mp, s.codigo_sublote, s.peso_inicial_kg, s.peso_kg, s.peso_neto_maduracion_kg, s.perdida_maduracion_kg, s.cantidad_unidades, s.estado_maduracion, s.estado_registro, s.observaciones, s.fecha_creacion, s.fecha_modificacion, s.id_usuario_modificacion, um.nombre_completo AS usuario_modificacion_nombre, l.id_producto, p.nombre AS producto_nombre, l.id_proveedor, pr.nombre_empresa AS proveedor_nombre FROM ${MATURATION_SUBLOT_TABLE} s LEFT JOIN ${RAW_MATERIAL_LOTS_TABLE} l ON l.id_lote_mp = s.id_lote_mp LEFT JOIN ${PRODUCTS_TABLE} p ON p.id_producto = l.id_producto LEFT JOIN ${PROVIDERS_TABLE} pr ON pr.id_proveedor = l.id_proveedor LEFT JOIN ${USERS_TABLE} um ON um.id_usuario = s.id_usuario_modificacion`;

const maturationSublotQueries = {
  findAll: `${maturationSublotBaseQuery} WHERE s.estado_registro <> '${INACTIVE_STATE}' ORDER BY s.fecha_creacion DESC, s.id_sublote DESC`,
  findById: `${maturationSublotBaseQuery} WHERE s.id_sublote = ?`,
  findByLot: `${maturationSublotBaseQuery} WHERE s.id_lote_mp = ? ORDER BY s.codigo_sublote ASC`,
  findReadyForProduction: `${maturationSublotBaseQuery} WHERE s.estado_registro = '${SUBLOT_READY_STATE}' ORDER BY s.fecha_modificacion ASC`,
  findForUpdate: `SELECT id_sublote, id_lote_mp, codigo_sublote, peso_inicial_kg, peso_kg, peso_neto_maduracion_kg, perdida_maduracion_kg, cantidad_unidades, estado_maduracion, estado_registro FROM ${MATURATION_SUBLOT_TABLE} WHERE id_sublote = ? FOR UPDATE`,
  countByLot: `SELECT COUNT(*) AS total FROM ${MATURATION_SUBLOT_TABLE} WHERE id_lote_mp = ?`,
  latestMeasuredWeight: `SELECT peso_medido_kg FROM ${MATURATION_CONTROL_TABLE} WHERE id_sublote = ? AND peso_medido_kg IS NOT NULL ORDER BY fecha_medicion DESC, id_control DESC LIMIT 1`,
};

const maturationControlBaseQuery = `SELECT c.id_control, c.id_sublote, c.fecha_medicion, c.grados_brix, c.peso_medido_kg, c.porcentaje_materia_seca, c.temperatura_cuarto, c.observaciones, c.fecha_modificacion, c.id_usuario_modificacion, um.nombre_completo AS usuario_modificacion_nombre, s.codigo_sublote, s.id_lote_mp, s.estado_maduracion, s.estado_registro AS sublote_estado_registro, l.id_producto, p.nombre AS producto_nombre, l.id_proveedor, pr.nombre_empresa AS proveedor_nombre FROM ${MATURATION_CONTROL_TABLE} c LEFT JOIN ${MATURATION_SUBLOT_TABLE} s ON s.id_sublote = c.id_sublote LEFT JOIN ${RAW_MATERIAL_LOTS_TABLE} l ON l.id_lote_mp = s.id_lote_mp LEFT JOIN ${PRODUCTS_TABLE} p ON p.id_producto = l.id_producto LEFT JOIN ${PROVIDERS_TABLE} pr ON pr.id_proveedor = l.id_proveedor LEFT JOIN ${USERS_TABLE} um ON um.id_usuario = c.id_usuario_modificacion`;

const maturationControlQueries = {
  findAll: `${maturationControlBaseQuery} ORDER BY c.fecha_medicion DESC, c.id_control DESC`,
  findById: `${maturationControlBaseQuery} WHERE c.id_control = ?`,
  findBySublot: `${maturationControlBaseQuery} WHERE c.id_sublote = ? ORDER BY c.fecha_medicion DESC, c.id_control DESC`,
};

const closeSublote = async (connection, id, explicitPesoMedido, { silent = false, id_usuario_modificacion = null } = {}) => {
  const [sublotRows] = await connection.query(maturationSublotQueries.findForUpdate, [id]);

  if (sublotRows.length === 0 || sublotRows[0].estado_registro !== SUBLOT_ACTIVE_STATE) {
    if (silent) {
      return null;
    }
    throw new Error('El sub-lote no esta disponible para cerrar maduracion');
  }

  const sublot = sublotRows[0];
  let pesoMedido =
    explicitPesoMedido === undefined || explicitPesoMedido === null || explicitPesoMedido === ''
      ? null
      : Number(explicitPesoMedido);

  if (pesoMedido === null) {
    const [latestRows] = await connection.query(maturationSublotQueries.latestMeasuredWeight, [id]);
    pesoMedido =
      latestRows[0]?.peso_medido_kg !== undefined && latestRows[0]?.peso_medido_kg !== null
        ? Number(latestRows[0].peso_medido_kg)
        : null;
  }

  if (pesoMedido === null || Number.isNaN(pesoMedido)) {
    if (silent) {
      return null;
    }
    throw new Error('Se requiere peso_medido_kg para cerrar la maduracion; no hay mediciones previas con peso capturado');
  }

  const perdida = Number(sublot.peso_kg) - pesoMedido;

  if (perdida < 0) {
    if (silent) {
      return null;
    }
    throw new Error('El peso medido no puede ser mayor al peso disponible del sub-lote');
  }

  await connection.query(
    `UPDATE ${MATURATION_SUBLOT_TABLE} SET peso_neto_maduracion_kg = ?, perdida_maduracion_kg = ?, estado_registro = '${SUBLOT_READY_STATE}', id_usuario_modificacion = ? WHERE id_sublote = ?`,
    [pesoMedido, perdida, id_usuario_modificacion, id]
  );

  const [rows] = await connection.query(`${maturationSublotBaseQuery} WHERE s.id_sublote = ?`, [id]);
  const updated = rows[0] || null;

  await recordAudit(connection, {
    table: MATURATION_SUBLOT_TABLE,
    recordId: id,
    action: AUDIT_ACTION_UPDATE,
    before: sublot,
    after: updated,
    userId: id_usuario_modificacion,
  });

  return updated;
};

const handlers = {
  'maturationLots.findAll': async () => {
    const [rows] = await pool.query(maturationLotQueries.findAll);
    return rows;
  },
  'maturationLots.findById': async ({ id }) => {
    const [rows] = await pool.query(maturationLotQueries.findById, [id]);
    return rows[0] || null;
  },
  'maturationLots.create': async ({
    id_producto,
    id_proveedor,
    id_entrada_origen,
    fecha_recepcion,
    cantidad_unidades,
    peso_inicial_kg,
    estado_maduracion,
    estado_registro,
    id_usuario_modificacion,
  }) => {
    const [result] = await pool.query(
      `INSERT INTO ${RAW_MATERIAL_LOTS_TABLE} (id_producto, id_proveedor, id_entrada_origen, fecha_recepcion, cantidad_unidades, peso_inicial_kg, estado_maduracion, estado_registro, id_usuario_modificacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id_producto,
        id_proveedor,
        id_entrada_origen,
        fecha_recepcion,
        cantidad_unidades === undefined || cantidad_unidades === null || cantidad_unidades === ''
          ? null
          : Number.parseInt(cantidad_unidades, 10),
        Number(peso_inicial_kg),
        normalizeNullableText(estado_maduracion) || 'Verde',
        normalizeNullableText(estado_registro) || PENDING_STATE,
        id_usuario_modificacion ?? null,
      ]
    );

    const [rows] = await pool.query(maturationLotQueries.findById, [result.insertId]);
    const created = rows[0] || null;

    await recordAudit(pool, {
      table: RAW_MATERIAL_LOTS_TABLE,
      recordId: result.insertId,
      action: AUDIT_ACTION_CREATE,
      before: null,
      after: created,
      userId: id_usuario_modificacion,
    });

    return created;
  },
  'maturationLots.update': async ({
    id,
    id_producto,
    id_proveedor,
    id_entrada_origen,
    fecha_recepcion,
    cantidad_unidades,
    peso_inicial_kg,
    estado_maduracion,
    estado_registro,
    id_usuario_modificacion,
  }) => {
    const [beforeRows] = await pool.query(maturationLotQueries.findById, [id]);

    const [result] = await pool.query(
      `UPDATE ${RAW_MATERIAL_LOTS_TABLE} SET id_producto = ?, id_proveedor = ?, id_entrada_origen = ?, fecha_recepcion = ?, cantidad_unidades = ?, peso_inicial_kg = ?, estado_maduracion = ?, estado_registro = COALESCE(?, estado_registro), id_usuario_modificacion = ? WHERE id_lote_mp = ? AND estado_registro <> '${INACTIVE_STATE}'`,
      [
        id_producto,
        id_proveedor,
        id_entrada_origen,
        fecha_recepcion,
        cantidad_unidades === undefined || cantidad_unidades === null || cantidad_unidades === ''
          ? null
          : Number.parseInt(cantidad_unidades, 10),
        Number(peso_inicial_kg),
        normalizeNullableText(estado_maduracion) || 'Verde',
        normalizeNullableText(estado_registro),
        id_usuario_modificacion ?? null,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    const [rows] = await pool.query(maturationLotQueries.findById, [id]);
    const updated = rows[0] || null;

    await recordAudit(pool, {
      table: RAW_MATERIAL_LOTS_TABLE,
      recordId: id,
      action: AUDIT_ACTION_UPDATE,
      before: beforeRows[0] || null,
      after: updated,
      userId: id_usuario_modificacion,
    });

    return updated;
  },
  'maturationLots.remove': async ({ id, id_usuario_modificacion }) => {
    const [beforeRows] = await pool.query(maturationLotQueries.findById, [id]);

    const [result] = await pool.query(
      `UPDATE ${RAW_MATERIAL_LOTS_TABLE} SET estado_registro = '${INACTIVE_STATE}', id_usuario_modificacion = ? WHERE id_lote_mp = ? AND estado_registro <> '${INACTIVE_STATE}'`,
      [id_usuario_modificacion ?? null, id]
    );

    if (result.affectedRows > 0) {
      await recordAudit(pool, {
        table: RAW_MATERIAL_LOTS_TABLE,
        recordId: id,
        action: AUDIT_ACTION_DELETE,
        before: beforeRows[0] || null,
        after: null,
        userId: id_usuario_modificacion,
      });
    }

    return result.affectedRows > 0;
  },
  'maturationLots.accept': async ({ id, estado_maduracion, id_usuario_modificacion }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [lotRows] = await connection.query(maturationLotQueries.findForUpdate, [id]);

      if (lotRows.length === 0 || lotRows[0].estado_registro !== PENDING_STATE) {
        await connection.rollback();
        return null;
      }

      const lot = lotRows[0];

      await connection.query(
        `UPDATE ${RAW_MATERIAL_LOTS_TABLE} SET estado_maduracion = ?, estado_registro = '${ACTIVE_STATE}', id_usuario_modificacion = ? WHERE id_lote_mp = ?`,
        [estado_maduracion, id_usuario_modificacion ?? null, id]
      );

      const isMature = estado_maduracion === MATURE_RIPENESS_STATE;
      const pesoInicial = Number(lot.peso_inicial_kg);

      const [result] = await connection.query(
        `INSERT INTO ${MATURATION_SUBLOT_TABLE} (id_lote_mp, codigo_sublote, peso_inicial_kg, peso_kg, peso_neto_maduracion_kg, perdida_maduracion_kg, cantidad_unidades, estado_maduracion, estado_registro, id_usuario_modificacion) VALUES (?, 'A', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          pesoInicial,
          pesoInicial,
          isMature ? pesoInicial : null,
          isMature ? 0 : null,
          lot.cantidad_unidades,
          estado_maduracion,
          isMature ? SUBLOT_READY_STATE : SUBLOT_ACTIVE_STATE,
          id_usuario_modificacion ?? null,
        ]
      );

      // El peso aceptado queda comprometido al sub-lote: se descuenta del stock general
      // de Materia Prima para no contarlo dos veces (ahi + en Fruta para produccion).
      const [existenciaRows] = await connection.query(
        `SELECT ie.id_existencia, COALESCE(stock.cantidad_disponible, 0) AS cantidad_disponible
         FROM ${INVENTORY_TABLE} ie
         LEFT JOIN (
           SELECT id_existencia, SUM(CASE WHEN tipo_movimiento = 'Entrada' THEN cantidad WHEN tipo_movimiento IN ('Salida', 'Ajuste', 'Desperdicio') THEN -cantidad ELSE 0 END) AS cantidad_disponible
           FROM ${MOVEMENTS_TABLE} WHERE estado_registro = '${ACTIVE_STATE}' GROUP BY id_existencia
         ) stock ON stock.id_existencia = ie.id_existencia
         WHERE ie.id_producto = ? AND ie.id_proveedor = ? AND ie.estado_registro = '${ACTIVE_STATE}'
         ORDER BY ie.fecha_vencimiento ASC, ie.id_existencia ASC
         FOR UPDATE`,
        [lot.id_producto, lot.id_proveedor]
      );
      const existencia = existenciaRows.find((row) => Number(row.cantidad_disponible) >= pesoInicial);

      if (existencia) {
        await connection.query(
          `INSERT INTO ${MOVEMENTS_TABLE} (id_existencia, tipo_movimiento, cantidad, motivo, id_usuario, estado_registro) VALUES (?, 'Salida', ?, ?, NULL, ?)`,
          [existencia.id_existencia, pesoInicial, `Aceptado a maduracion - lote #${id}`, ACTIVE_STATE]
        );
      }

      const [updatedLotRows] = await connection.query(maturationLotQueries.findById, [id]);
      const [createdSublotRows] = await connection.query(`${maturationSublotBaseQuery} WHERE s.id_sublote = ?`, [result.insertId]);

      await recordAudit(connection, {
        table: RAW_MATERIAL_LOTS_TABLE,
        recordId: id,
        action: AUDIT_ACTION_UPDATE,
        before: lot,
        after: updatedLotRows[0] || null,
        userId: id_usuario_modificacion,
      });

      await recordAudit(connection, {
        table: MATURATION_SUBLOT_TABLE,
        recordId: result.insertId,
        action: AUDIT_ACTION_CREATE,
        before: null,
        after: createdSublotRows[0] || null,
        userId: id_usuario_modificacion,
      });

      await connection.commit();

      return createdSublotRows[0] || null;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'maturationSublots.findAll': async () => {
    const [rows] = await pool.query(maturationSublotQueries.findAll);
    return rows;
  },
  'maturationSublots.findById': async ({ id }) => {
    const [rows] = await pool.query(maturationSublotQueries.findById, [id]);
    return rows[0] || null;
  },
  'maturationSublots.findByLot': async ({ id_lote_mp }) => {
    const [rows] = await pool.query(maturationSublotQueries.findByLot, [id_lote_mp]);
    return rows;
  },
  'maturationSublots.findReadyForProduction': async () => {
    const [rows] = await pool.query(maturationSublotQueries.findReadyForProduction);
    return rows;
  },
  'maturationSublots.split': async ({ id, peso_kg, observaciones, id_usuario_modificacion }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [originRows] = await connection.query(maturationSublotQueries.findForUpdate, [id]);

      if (originRows.length === 0 || originRows[0].estado_registro !== SUBLOT_ACTIVE_STATE) {
        await connection.rollback();
        return null;
      }

      const origin = originRows[0];
      const splitWeight = Number(peso_kg);
      const availableWeight = Number(origin.peso_kg);

      if (!Number.isFinite(splitWeight) || splitWeight <= 0 || splitWeight > availableWeight) {
        await connection.rollback();
        throw new Error('El peso a fraccionar supera el peso disponible del sub-lote');
      }

      let splitUnits = null;
      let remainingUnits = origin.cantidad_unidades;

      if (origin.cantidad_unidades !== null && origin.cantidad_unidades !== undefined && availableWeight > 0) {
        splitUnits = Math.min(
          Number(origin.cantidad_unidades),
          Math.round(Number(origin.cantidad_unidades) * (splitWeight / availableWeight))
        );
        remainingUnits = Number(origin.cantidad_unidades) - splitUnits;
      }

      await connection.query(
        `UPDATE ${MATURATION_SUBLOT_TABLE} SET peso_kg = peso_kg - ?, cantidad_unidades = ?, id_usuario_modificacion = ? WHERE id_sublote = ?`,
        [splitWeight, remainingUnits, id_usuario_modificacion ?? null, id]
      );

      const [countRows] = await connection.query(maturationSublotQueries.countByLot, [origin.id_lote_mp]);
      const nextCode = `A${Number(countRows[0].total) + 1}`;

      const [result] = await connection.query(
        `INSERT INTO ${MATURATION_SUBLOT_TABLE} (id_lote_mp, codigo_sublote, peso_inicial_kg, peso_kg, cantidad_unidades, estado_maduracion, estado_registro, observaciones, id_usuario_modificacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          origin.id_lote_mp,
          nextCode,
          splitWeight,
          splitWeight,
          splitUnits,
          origin.estado_maduracion,
          SUBLOT_ACTIVE_STATE,
          normalizeNullableText(observaciones),
          id_usuario_modificacion ?? null,
        ]
      );

      const [splitRows] = await connection.query(
        `${maturationSublotBaseQuery} WHERE s.id_sublote IN (?, ?) ORDER BY s.id_sublote ASC`,
        [id, result.insertId]
      );
      const origenActualizado = splitRows.find((row) => row.id_sublote === id);
      const nuevoSublote = splitRows.find((row) => row.id_sublote === result.insertId);

      await recordAudit(connection, {
        table: MATURATION_SUBLOT_TABLE,
        recordId: id,
        action: AUDIT_ACTION_UPDATE,
        before: origin,
        after: origenActualizado || null,
        userId: id_usuario_modificacion,
      });

      await recordAudit(connection, {
        table: MATURATION_SUBLOT_TABLE,
        recordId: result.insertId,
        action: AUDIT_ACTION_CREATE,
        before: null,
        after: nuevoSublote || null,
        userId: id_usuario_modificacion,
      });

      await connection.commit();

      return {
        origen: origenActualizado,
        nuevo: nuevoSublote,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'maturationSublots.close': async ({ id, peso_medido_kg, id_usuario_modificacion }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const result = await closeSublote(connection, id, peso_medido_kg, { silent: false, id_usuario_modificacion });
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'maturationControls.findAll': async () => {
    const [rows] = await pool.query(maturationControlQueries.findAll);
    return rows;
  },
  'maturationControls.findBySublot': async ({ id_sublote }) => {
    const [rows] = await pool.query(maturationControlQueries.findBySublot, [id_sublote]);
    return rows;
  },
  'maturationControls.create': async ({
    id_sublote,
    grados_brix,
    peso_medido_kg,
    porcentaje_materia_seca,
    temperatura_cuarto,
    observaciones,
    id_usuario_modificacion,
  }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        `INSERT INTO ${MATURATION_CONTROL_TABLE} (id_sublote, grados_brix, peso_medido_kg, porcentaje_materia_seca, temperatura_cuarto, observaciones, id_usuario_modificacion) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id_sublote,
          Number(grados_brix),
          peso_medido_kg === undefined || peso_medido_kg === null || peso_medido_kg === ''
            ? null
            : Number(peso_medido_kg),
          porcentaje_materia_seca === undefined || porcentaje_materia_seca === null || porcentaje_materia_seca === ''
            ? null
            : Number(porcentaje_materia_seca),
          temperatura_cuarto === undefined || temperatura_cuarto === null || temperatura_cuarto === ''
            ? null
            : Number(temperatura_cuarto),
          normalizeNullableText(observaciones),
          id_usuario_modificacion ?? null,
        ]
      );

      let subloteWasPromoted = false;

      if (Number(grados_brix) >= MATURATION_BRIX_THRESHOLD) {
        const promoted = await closeSublote(connection, id_sublote, peso_medido_kg, { silent: true, id_usuario_modificacion });
        subloteWasPromoted = Boolean(promoted);
      }

      const [createdRows] = await connection.query(maturationControlQueries.findById, [result.insertId]);

      await recordAudit(connection, {
        table: MATURATION_CONTROL_TABLE,
        recordId: result.insertId,
        action: AUDIT_ACTION_CREATE,
        before: null,
        after: createdRows[0] || null,
        userId: id_usuario_modificacion,
      });

      await connection.commit();

      return { ...(createdRows[0] || {}), sublote_promovido: subloteWasPromoted };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'maturationControls.remove': async ({ id }) => {
    const [beforeRows] = await pool.query(maturationControlQueries.findById, [id]);

    const [result] = await pool.query(
      `DELETE FROM ${MATURATION_CONTROL_TABLE} WHERE id_control = ?`,
      [id]
    );

    if (result.affectedRows > 0) {
      await recordAudit(pool, {
        table: MATURATION_CONTROL_TABLE,
        recordId: id,
        action: AUDIT_ACTION_DELETE,
        before: beforeRows[0] || null,
        after: null,
        userId: null,
      });
    }

    return result.affectedRows > 0;
  },
};

module.exports = {
  handlers,
  maturationSublotQueries,
};
