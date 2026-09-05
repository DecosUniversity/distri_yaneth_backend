const { pool } = require('../../config/db');
const {
  USERS_TABLE,
  INVENTORY_TABLE,
  MOVEMENTS_TABLE,
  PRODUCTS_TABLE,
  ENTRIES_TABLE,
  RAW_MATERIAL_LOTS_TABLE,
  MATURATION_SUBLOT_TABLE,
  GREEN_NET_TABLE,
  ACTIVE_STATE,
  SUBLOT_ACTIVE_STATE,
  SUBLOT_GREEN_NET_STATE,
} = require('../shared/constants');
const { maturationSublotQueries } = require('./maturation.worker');
const { AUDIT_ACTION_CREATE, AUDIT_ACTION_UPDATE, recordAudit } = require('../shared/audit');

const greenNetBaseQuery = `SELECT r.id_red, r.id_sublote, s.codigo_sublote, s.id_lote_mp, r.id_existencia, r.peso_kg, r.cantidad_redes, r.id_usuario, u.nombre_completo AS usuario_nombre, r.fecha_empaque, pr.id_producto, pr.nombre AS producto_nombre, l.id_proveedor AS id_proveedor_origen, l.id_entrada_origen AS id_entrada_origen, ent.codigo_lote FROM ${GREEN_NET_TABLE} r LEFT JOIN ${MATURATION_SUBLOT_TABLE} s ON s.id_sublote = r.id_sublote LEFT JOIN ${RAW_MATERIAL_LOTS_TABLE} l ON l.id_lote_mp = s.id_lote_mp LEFT JOIN ${ENTRIES_TABLE} ent ON ent.id_entrada = l.id_entrada_origen LEFT JOIN ${INVENTORY_TABLE} ie ON ie.id_existencia = r.id_existencia LEFT JOIN ${PRODUCTS_TABLE} pr ON pr.id_producto = ie.id_producto LEFT JOIN ${USERS_TABLE} u ON u.id_usuario = r.id_usuario`;

const greenNetQueries = {
  findAll: `${greenNetBaseQuery} ORDER BY r.fecha_empaque DESC, r.id_red DESC`,
  findBySublot: `${greenNetBaseQuery} WHERE r.id_sublote = ? ORDER BY r.fecha_empaque DESC, r.id_red DESC`,
};

const handlers = {
  'greenNets.findAll': async () => {
    const [rows] = await pool.query(greenNetQueries.findAll);
    return rows;
  },
  'greenNets.findBySublot': async ({ id_sublote }) => {
    const [rows] = await pool.query(greenNetQueries.findBySublot, [id_sublote]);
    return rows;
  },
  // "cajas" es un arreglo de { cantidad_redes, peso_kg }: cada elemento es una caja fisica
  // que ya se peso por separado. Se crea una fila en redes_verde_detalle por caja (no por
  // red individual), para poder registrar cientos de redes en un solo envio sin perder la
  // trazabilidad por caja (cada una con su propio movimiento de inventario).
  'greenNets.create': async ({ id_sublote, id_producto, cajas, fecha_vencimiento, costo_unitario, id_usuario }) => {
    if (!Array.isArray(cajas) || cajas.length === 0) {
      throw new Error('Debes registrar al menos una caja');
    }

    const parsedCajas = cajas.map((caja, index) => {
      const cantidadRedes = Number.parseInt(caja.cantidad_redes, 10);
      const pesoKg = Number(caja.peso_kg);

      if (!Number.isFinite(cantidadRedes) || cantidadRedes <= 0) {
        throw new Error(`La caja ${index + 1} debe tener una cantidad de redes mayor a 0`);
      }

      if (!Number.isFinite(pesoKg) || pesoKg <= 0) {
        throw new Error(`La caja ${index + 1} debe tener un peso mayor a 0`);
      }

      return { cantidadRedes, pesoKg };
    });

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [sublotRows] = await connection.query(maturationSublotQueries.findForUpdate, [id_sublote]);

      if (sublotRows.length === 0) {
        await connection.rollback();
        return null;
      }

      const sublot = sublotRows[0];

      if (sublot.estado_maduracion !== 'Verde' || sublot.estado_registro !== SUBLOT_ACTIVE_STATE) {
        await connection.rollback();
        throw new Error('El sub-lote debe estar Verde y activo para empacar como red');
      }

      const totalRequestedKg = parsedCajas.reduce((sum, caja) => sum + caja.pesoKg, 0);
      const availableKg = Number(sublot.peso_kg);

      if (totalRequestedKg > availableKg) {
        await connection.rollback();
        throw new Error('El peso de la red supera el peso disponible del sub-lote');
      }

      const nextWeight = availableKg - totalRequestedKg;
      const nextState = nextWeight <= 0 ? SUBLOT_GREEN_NET_STATE : SUBLOT_ACTIVE_STATE;

      await connection.query(
        `UPDATE ${MATURATION_SUBLOT_TABLE} SET peso_kg = ?, estado_registro = ?, id_usuario_modificacion = ? WHERE id_sublote = ?`,
        [nextWeight, nextState, id_usuario ?? null, id_sublote]
      );

      const [lotRows] = await connection.query(
        `SELECT id_proveedor FROM ${RAW_MATERIAL_LOTS_TABLE} WHERE id_lote_mp = ? LIMIT 1`,
        [sublot.id_lote_mp]
      );
      const supplierId = lotRows[0]?.id_proveedor ?? null;

      const [existingInventoryRows] = await connection.query(
        `SELECT id_existencia FROM ${INVENTORY_TABLE} WHERE id_producto = ? AND id_proveedor <=> ? AND estado_registro = '${ACTIVE_STATE}' LIMIT 1`,
        [id_producto, supplierId]
      );

      let existenceId;

      if (existingInventoryRows.length > 0) {
        existenceId = existingInventoryRows[0].id_existencia;
        await connection.query(
          `UPDATE ${INVENTORY_TABLE} SET fecha_vencimiento = ?, costo_unitario = COALESCE(?, costo_unitario), id_usuario_modificacion = ? WHERE id_existencia = ?`,
          [fecha_vencimiento, costo_unitario ?? null, id_usuario ?? null, existenceId]
        );
      } else {
        const [existenceResult] = await connection.query(
          `INSERT INTO ${INVENTORY_TABLE} (id_producto, id_proveedor, id_proceso_origen, id_entrada_origen, fecha_vencimiento, cantidad_disponible, costo_unitario, estado_registro, id_usuario_modificacion) VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, ?)`,
          [id_producto, supplierId, fecha_vencimiento, 0, costo_unitario ?? null, ACTIVE_STATE, id_usuario ?? null]
        );
        existenceId = existenceResult.insertId;
      }

      const [updatedSublotRows] = await connection.query(maturationSublotQueries.findForUpdate, [id_sublote]);

      await recordAudit(connection, {
        table: MATURATION_SUBLOT_TABLE,
        recordId: id_sublote,
        action: AUDIT_ACTION_UPDATE,
        before: sublot,
        after: updatedSublotRows[0] || null,
        userId: id_usuario,
      });

      const createdCajas = [];

      for (let index = 0; index < parsedCajas.length; index += 1) {
        const caja = parsedCajas[index];

        await connection.query(
          `INSERT INTO ${MOVEMENTS_TABLE} (id_existencia, tipo_movimiento, cantidad, motivo, id_usuario, estado_registro) VALUES (?, 'Entrada', ?, ?, ?, ?)`,
          [
            existenceId,
            caja.pesoKg,
            `Red platano verde - sublote #${id_sublote} - caja ${index + 1}/${parsedCajas.length}`,
            id_usuario ?? null,
            ACTIVE_STATE,
          ]
        );

        const [redResult] = await connection.query(
          `INSERT INTO ${GREEN_NET_TABLE} (id_sublote, id_existencia, peso_kg, cantidad_redes, id_usuario) VALUES (?, ?, ?, ?, ?)`,
          [id_sublote, existenceId, caja.pesoKg, caja.cantidadRedes, id_usuario]
        );

        const [createdRedRows] = await connection.query(`${greenNetBaseQuery} WHERE r.id_red = ?`, [redResult.insertId]);
        const createdCaja = createdRedRows[0] || null;
        createdCajas.push(createdCaja);

        await recordAudit(connection, {
          table: GREEN_NET_TABLE,
          recordId: redResult.insertId,
          action: AUDIT_ACTION_CREATE,
          before: null,
          after: createdCaja,
          userId: id_usuario,
        });
      }

      await connection.commit();

      return createdCajas;
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
