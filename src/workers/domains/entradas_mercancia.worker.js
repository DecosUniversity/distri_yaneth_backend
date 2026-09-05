const { pool } = require('../../config/db');
const {
  USERS_TABLE,
  PROVIDERS_TABLE,
  ENTRIES_TABLE,
  ENTRADA_UNIDADES_TABLE,
  INVENTORY_TABLE,
  MOVEMENTS_TABLE,
  PRODUCTS_TABLE,
  RAW_MATERIAL_LOTS_TABLE,
  ACTIVE_STATE,
  INACTIVE_STATE,
  PENDING_STATE,
  RAW_MATERIAL_PRODUCT_TYPE,
} = require('../shared/constants');
const { normalizeNullableText } = require('../shared/helpers');
const { AUDIT_ACTION_CREATE, AUDIT_ACTION_DELETE, recordAudit } = require('../shared/audit');
const { generateLotCode } = require('../shared/lotCode');

const entryQueries = {
  findAll: `SELECT e.id_entrada, e.id_proveedor, p.nombre_empresa, e.fecha_recepcion, e.documento_referencia, e.costo_unitario, e.costo_total, e.id_usuario_receptor, u.nombre_completo AS receptor_nombre, e.estado_registro, e.fecha_modificacion, e.id_usuario_modificacion, um.nombre_completo AS usuario_modificacion_nombre, e.codigo_lote, ie.id_existencia, ie.id_producto, pr.nombre AS producto_nombre, ie.fecha_vencimiento, m.cantidad AS cantidad_disponible FROM ${ENTRIES_TABLE} e LEFT JOIN ${PROVIDERS_TABLE} p ON p.id_proveedor = e.id_proveedor AND p.estado_registro = '${ACTIVE_STATE}' LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = e.id_usuario_receptor AND u.estado_registro = '${ACTIVE_STATE}' LEFT JOIN ${USERS_TABLE} um ON um.id_usuario = e.id_usuario_modificacion LEFT JOIN (SELECT mm.id_movimiento, mm.id_existencia, mm.cantidad, mm.motivo FROM ${MOVEMENTS_TABLE} mm INNER JOIN (SELECT motivo, MAX(id_movimiento) AS id_movimiento FROM ${MOVEMENTS_TABLE} WHERE tipo_movimiento = 'Entrada' AND estado_registro = '${ACTIVE_STATE}' GROUP BY motivo) latest ON latest.id_movimiento = mm.id_movimiento WHERE mm.estado_registro = '${ACTIVE_STATE}') m ON m.motivo = CONCAT('Entrada de mercancia #', e.id_entrada) LEFT JOIN ${INVENTORY_TABLE} ie ON ie.id_existencia = m.id_existencia AND ie.estado_registro = '${ACTIVE_STATE}' LEFT JOIN ${PRODUCTS_TABLE} pr ON pr.id_producto = ie.id_producto AND pr.estado_registro = '${ACTIVE_STATE}' WHERE e.estado_registro IN ('${PENDING_STATE}', '${ACTIVE_STATE}') ORDER BY e.fecha_recepcion DESC, e.id_entrada DESC`,
  findById: `SELECT e.id_entrada, e.id_proveedor, p.nombre_empresa, e.fecha_recepcion, e.documento_referencia, e.costo_unitario, e.costo_total, e.id_usuario_receptor, u.nombre_completo AS receptor_nombre, e.estado_registro, e.fecha_modificacion, e.id_usuario_modificacion, um.nombre_completo AS usuario_modificacion_nombre, e.codigo_lote, ie.id_existencia, ie.id_producto, pr.nombre AS producto_nombre, ie.fecha_vencimiento, m.cantidad AS cantidad_disponible FROM ${ENTRIES_TABLE} e LEFT JOIN ${PROVIDERS_TABLE} p ON p.id_proveedor = e.id_proveedor AND p.estado_registro = '${ACTIVE_STATE}' LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = e.id_usuario_receptor AND u.estado_registro = '${ACTIVE_STATE}' LEFT JOIN ${USERS_TABLE} um ON um.id_usuario = e.id_usuario_modificacion LEFT JOIN (SELECT mm.id_movimiento, mm.id_existencia, mm.cantidad, mm.motivo FROM ${MOVEMENTS_TABLE} mm INNER JOIN (SELECT motivo, MAX(id_movimiento) AS id_movimiento FROM ${MOVEMENTS_TABLE} WHERE tipo_movimiento = 'Entrada' AND estado_registro = '${ACTIVE_STATE}' GROUP BY motivo) latest ON latest.id_movimiento = mm.id_movimiento WHERE mm.estado_registro = '${ACTIVE_STATE}') m ON m.motivo = CONCAT('Entrada de mercancia #', e.id_entrada) LEFT JOIN ${INVENTORY_TABLE} ie ON ie.id_existencia = m.id_existencia AND ie.estado_registro = '${ACTIVE_STATE}' LEFT JOIN ${PRODUCTS_TABLE} pr ON pr.id_producto = ie.id_producto AND pr.estado_registro = '${ACTIVE_STATE}' WHERE e.id_entrada = ? AND e.estado_registro IN ('${PENDING_STATE}', '${ACTIVE_STATE}')`,
};

const movementQueries = {
  findAll: `SELECT m.id_movimiento, m.id_existencia, m.tipo_movimiento, m.cantidad, m.motivo, m.fecha_movimiento, m.id_usuario, u.nombre_completo AS usuario_nombre, m.estado_registro, m.fecha_modificacion FROM ${MOVEMENTS_TABLE} m LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = m.id_usuario AND u.estado_registro = '${ACTIVE_STATE}' WHERE m.estado_registro = '${ACTIVE_STATE}' ORDER BY m.fecha_movimiento DESC, m.id_movimiento DESC`,
};

const handlers = {
  'entries.findAll': async () => {
    const [rows] = await pool.query(entryQueries.findAll);
    return rows;
  },
  'entries.findById': async ({ id }) => {
    const [rows] = await pool.query(entryQueries.findById, [id]);
    return rows[0] || null;
  },
  'entries.create': async ({
    id_proveedor,
    id_producto,
    fecha_vencimiento,
    cantidad_disponible,
    costo_unitario,
    documento_referencia,
    id_usuario_receptor,
    unidades,
  }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [productInfoRows] = await connection.query(
        `SELECT nombre, tipo_producto FROM ${PRODUCTS_TABLE} WHERE id_producto = ? AND estado_registro = '${ACTIVE_STATE}' LIMIT 1`,
        [id_producto]
      );
      const productInfo = productInfoRows[0] || {};

      let entryResult;

      for (let attempt = 0; ; attempt += 1) {
        const codigoLote = await generateLotCode(connection, {
          table: ENTRIES_TABLE,
          column: 'codigo_lote',
          productoNombre: productInfo.nombre,
          extraSeq: attempt,
        });

        try {
          [entryResult] = await connection.query(
            `INSERT INTO ${ENTRIES_TABLE} (id_proveedor, documento_referencia, costo_unitario, costo_total, id_usuario_receptor, estado_registro, id_usuario_modificacion, codigo_lote) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id_proveedor,
              normalizeNullableText(documento_referencia),
              normalizeNullableText(costo_unitario),
              normalizeNullableText(costo_unitario) === null ? null : Number(costo_unitario) * Number(cantidad_disponible),
              id_usuario_receptor,
              ACTIVE_STATE,
              id_usuario_receptor,
              codigoLote,
            ]
          );
          break;
        } catch (insertError) {
          if (insertError.code === 'ER_DUP_ENTRY' && attempt < 4) {
            continue;
          }
          throw insertError;
        }
      }

      const [existingExistencias] = await connection.query(
        `SELECT id_existencia, cantidad_disponible, costo_unitario FROM ${INVENTORY_TABLE} WHERE id_producto = ? AND id_proveedor = ? AND estado_registro = '${ACTIVE_STATE}' ORDER BY id_existencia ASC LIMIT 1`,
        [id_producto, id_proveedor]
      );

      let existenciaId;

      if (existingExistencias.length > 0) {
        existenciaId = existingExistencias[0].id_existencia;

        await connection.query(
          `UPDATE ${INVENTORY_TABLE} SET id_proveedor = ?, fecha_vencimiento = ?, id_usuario_modificacion = ? WHERE id_existencia = ?`,
          [
            id_proveedor,
            fecha_vencimiento,
            id_usuario_receptor,
            existenciaId,
          ]
        );
      } else {
        const [existenceResult] = await connection.query(
          `INSERT INTO ${INVENTORY_TABLE} (id_producto, id_proveedor, id_proceso_origen, id_entrada_origen, fecha_vencimiento, cantidad_disponible, costo_unitario, estado_registro, id_usuario_modificacion) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
          [
            id_producto,
            id_proveedor,
            entryResult.insertId,
            fecha_vencimiento,
            0,
            normalizeNullableText(costo_unitario),
            ACTIVE_STATE,
            id_usuario_receptor,
          ]
        );

        existenciaId = existenceResult.insertId;
      }

      await connection.query(
        `INSERT INTO ${MOVEMENTS_TABLE} (id_existencia, tipo_movimiento, cantidad, motivo, id_usuario, estado_registro) VALUES (?, 'Entrada', ?, ?, ?, ?)`,
        [
          existenciaId,
          cantidad_disponible,
          `Entrada de mercancia #${entryResult.insertId}`,
          id_usuario_receptor,
          ACTIVE_STATE,
        ]
      );

      const [avgCostRows] = await connection.query(
        `SELECT SUM(e.costo_unitario * m.cantidad) / NULLIF(SUM(m.cantidad), 0) AS avg_cost FROM ${ENTRIES_TABLE} e INNER JOIN ${MOVEMENTS_TABLE} m ON m.motivo = CONCAT('Entrada de mercancia #', e.id_entrada) AND m.id_existencia = ? AND m.tipo_movimiento = 'Entrada' AND m.estado_registro = '${ACTIVE_STATE}' WHERE e.estado_registro = '${ACTIVE_STATE}' AND e.costo_unitario IS NOT NULL`,
        [existenciaId]
      );

      const avgCost = avgCostRows[0]?.avg_cost ?? null;
      await connection.query(
        `UPDATE ${INVENTORY_TABLE} SET costo_unitario = ? WHERE id_existencia = ?`,
        [avgCost, existenciaId]
      );

      if (productInfo.tipo_producto === RAW_MATERIAL_PRODUCT_TYPE) {
        // Si se proporcionaron unidades pequeñas, insertar los datos asociados y usar la sumatoria de pesos
        let cantidadUnidades = null;
        let pesoInicialKg = Number(cantidad_disponible);

        if (Array.isArray(unidades) && unidades.length > 0) {
          cantidadUnidades = unidades.length;
          const totalPeso = unidades.reduce((sum, u) => sum + (u && u.peso ? Number(u.peso) : 0), 0);
          pesoInicialKg = totalPeso;
        }

        const [lotResult] = await connection.query(
          `INSERT INTO ${RAW_MATERIAL_LOTS_TABLE} (id_producto, id_proveedor, id_entrada_origen, fecha_recepcion, cantidad_unidades, peso_inicial_kg, estado_maduracion, estado_registro, id_usuario_modificacion) VALUES (?, ?, ?, CURRENT_DATE, ?, ?, ?, ?, ?)`,
          [
            id_producto,
            id_proveedor,
            entryResult.insertId,
            cantidadUnidades,
            pesoInicialKg,
            'Verde',
            PENDING_STATE,
            id_usuario_receptor,
          ]
        );

        // Si hay unidades, insertarlas en entrada_unidades vinculadas a la entrada creada
        if (Array.isArray(unidades) && unidades.length > 0) {
          const insertUnitQuery = `INSERT INTO ${ENTRADA_UNIDADES_TABLE} (id_entrada, unidad_codigo, peso, creado_por, fecha_pesos, created_at) VALUES (?, ?, ?, ?, COALESCE(?, NOW()), NOW())`;
          for (let i = 0; i < unidades.length; i++) {
            const u = unidades[i];
            const seq = i + 1;
            const generatedCode = `${entryResult.insertId}-${seq}`;
            await connection.query(insertUnitQuery, [
              entryResult.insertId,
              generatedCode,
              Number(u.peso) || 0,
              u.creado_por || id_usuario_receptor,
              u.fecha_pesos ?? null,
            ]);
          }
        }
      }

      const [createdRows] = await connection.query(entryQueries.findById, [entryResult.insertId]);

      await recordAudit(connection, {
        table: ENTRIES_TABLE,
        recordId: entryResult.insertId,
        action: AUDIT_ACTION_CREATE,
        before: null,
        after: createdRows[0] || null,
        userId: id_usuario_receptor,
      });

      await connection.commit();

      const [rows] = await pool.query(entryQueries.findById, [entryResult.insertId]);
      return rows[0] || null;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'entries.createUnit': async ({ id_entrada, unidad_codigo, peso, creado_por, fecha_pesos }) => {
    // generate sequential unidad_codigo based on existing units for this entrada
    const [countRows] = await pool.query(`SELECT COUNT(*) AS cnt FROM ${ENTRADA_UNIDADES_TABLE} WHERE id_entrada = ?`, [id_entrada]);
    const seq = (countRows && countRows[0] && Number(countRows[0].cnt)) ? Number(countRows[0].cnt) + 1 : 1;
    const generatedCode = `${id_entrada}-${seq}`;

    const [result] = await pool.query(
      `INSERT INTO ${ENTRADA_UNIDADES_TABLE} (id_entrada, unidad_codigo, peso, creado_por, fecha_pesos, created_at) VALUES (?, ?, ?, ?, COALESCE(?, NOW()), NOW())`,
      [id_entrada, generatedCode, Number(peso) || 0, creado_por, fecha_pesos ?? null]
    );

    const [rows] = await pool.query(`SELECT id, id_entrada, unidad_codigo, peso, creado_por, fecha_pesos, created_at FROM ${ENTRADA_UNIDADES_TABLE} WHERE id = ?`, [result.insertId]);
    const created = rows[0] || null;

    await recordAudit(pool, {
      table: ENTRADA_UNIDADES_TABLE,
      recordId: result.insertId,
      action: AUDIT_ACTION_CREATE,
      before: null,
      after: created,
      userId: creado_por,
    });

    return created;
  },
  'entries.findUnitsByEntrada': async ({ id_entrada }) => {
    const [rows] = await pool.query(
      `SELECT id, id_entrada, unidad_codigo, peso, creado_por, fecha_pesos, created_at FROM ${ENTRADA_UNIDADES_TABLE} WHERE id_entrada = ? ORDER BY id ASC`,
      [id_entrada]
    );
    return rows;
  },
  'entries.removeUnit': async ({ id }) => {
    const [beforeRows] = await pool.query(`SELECT id, id_entrada, unidad_codigo, peso, creado_por, fecha_pesos, created_at FROM ${ENTRADA_UNIDADES_TABLE} WHERE id = ?`, [id]);

    const [result] = await pool.query(`DELETE FROM ${ENTRADA_UNIDADES_TABLE} WHERE id = ?`, [id]);

    if (result.affectedRows > 0) {
      await recordAudit(pool, {
        table: ENTRADA_UNIDADES_TABLE,
        recordId: id,
        action: AUDIT_ACTION_DELETE,
        before: beforeRows[0] || null,
        after: null,
        userId: null,
      });
    }

    return result.affectedRows > 0;
  },
  'entries.remove': async ({ id, id_usuario_modificacion }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [beforeRows] = await connection.query(entryQueries.findById, [id]);

      const [entryMovements] = await connection.query(
        `SELECT id_existencia, cantidad FROM ${MOVEMENTS_TABLE} WHERE tipo_movimiento = 'Entrada' AND motivo = ? AND estado_registro = '${ACTIVE_STATE}'`,
        [`Entrada de mercancia #${id}`]
      );

      for (const movement of entryMovements) {
        await connection.query(
          `INSERT INTO ${MOVEMENTS_TABLE} (id_existencia, tipo_movimiento, cantidad, motivo, id_usuario, estado_registro) VALUES (?, 'Ajuste', ?, ?, NULL, ?)`,
          [movement.id_existencia, movement.cantidad, `Reversion entrada #${id}`, ACTIVE_STATE]
        );
      }

      const affectedExistencias = [...new Set(entryMovements.map((movement) => movement.id_existencia))];

      for (const existenceId of affectedExistencias) {
        const [stockRows] = await connection.query(
          `SELECT COALESCE(SUM(CASE WHEN tipo_movimiento = 'Entrada' THEN cantidad WHEN tipo_movimiento IN ('Salida', 'Ajuste', 'Desperdicio') THEN -cantidad ELSE 0 END), 0) AS cantidad_neta FROM ${MOVEMENTS_TABLE} WHERE id_existencia = ? AND estado_registro = '${ACTIVE_STATE}'`,
          [existenceId]
        );

        const netQuantity = Number(stockRows[0]?.cantidad_neta || 0);

        const [avgCostRows] = await connection.query(
          `SELECT SUM(e.costo_unitario * m.cantidad) / NULLIF(SUM(m.cantidad), 0) AS avg_cost FROM ${ENTRIES_TABLE} e INNER JOIN ${MOVEMENTS_TABLE} m ON m.motivo = CONCAT('Entrada de mercancia #', e.id_entrada) AND m.id_existencia = ? AND m.tipo_movimiento = 'Entrada' AND m.estado_registro = '${ACTIVE_STATE}' WHERE e.estado_registro = '${ACTIVE_STATE}' AND e.costo_unitario IS NOT NULL`,
          [existenceId]
        );

        const avgCost = avgCostRows[0]?.avg_cost ?? null;

        await connection.query(
          `UPDATE ${INVENTORY_TABLE} SET cantidad_disponible = ?, costo_unitario = ?, estado_registro = CASE WHEN ? > 0 THEN '${ACTIVE_STATE}' ELSE '${INACTIVE_STATE}' END, id_entrada_origen = NULL, id_usuario_modificacion = ? WHERE id_existencia = ?`,
          [netQuantity, avgCost, netQuantity, id_usuario_modificacion ?? null, existenceId]
        );
      }

      // If any active inventory row still references this entry as origin, release FK before marking inactive.
      await connection.query(
        `UPDATE ${INVENTORY_TABLE} SET id_entrada_origen = NULL, id_usuario_modificacion = ? WHERE id_entrada_origen = ? AND estado_registro = '${ACTIVE_STATE}'`,
        [id_usuario_modificacion ?? null, id]
      );

      await connection.query(
        `UPDATE ${RAW_MATERIAL_LOTS_TABLE} SET estado_registro = '${INACTIVE_STATE}', id_usuario_modificacion = ? WHERE id_entrada_origen = ? AND estado_registro <> '${INACTIVE_STATE}'`,
        [id_usuario_modificacion ?? null, id]
      );

      const [result] = await connection.query(
        `UPDATE ${ENTRIES_TABLE} SET estado_registro = '${INACTIVE_STATE}', id_usuario_modificacion = ? WHERE id_entrada = ? AND estado_registro = '${ACTIVE_STATE}'`,
        [id_usuario_modificacion ?? null, id]
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        return false;
      }

      await recordAudit(connection, {
        table: ENTRIES_TABLE,
        recordId: id,
        action: AUDIT_ACTION_DELETE,
        before: beforeRows[0] || null,
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
  'entries.remove.legacy': async ({ id }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [existencias] = await connection.query(
        `SELECT id_existencia FROM ${INVENTORY_TABLE} WHERE id_entrada_origen = ?`,
        [id]
      );

      if (existencias.length > 0) {
        const existenciaIds = existencias.map((item) => item.id_existencia);
        await connection.query(`DELETE FROM ${MOVEMENTS_TABLE} WHERE id_existencia IN (?)`, [existenciaIds]);
      }

      await connection.query(`DELETE FROM ${INVENTORY_TABLE} WHERE id_entrada_origen = ?`, [id]);
      const [result] = await connection.query(`DELETE FROM ${ENTRIES_TABLE} WHERE id_entrada = ?`, [id]);

      await connection.commit();
      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'movements.findAll': async () => {
    const [rows] = await pool.query(movementQueries.findAll);
    return rows;
  },
};

module.exports = {
  handlers,
};
