const { pool } = require('../../config/db');
const {
  USERS_TABLE,
  CLIENTS_TABLE,
  INVENTORY_TABLE,
  MOVEMENTS_TABLE,
  PRODUCTS_TABLE,
  ORDERS_TABLE,
  ORDER_DETAIL_TABLE,
  ORDER_RETURNS_TABLE,
  ROUTE_ORDERS_TABLE,
  ROUTES_TABLE,
  ACTIVE_STATE,
  PENDING_STATE,
  ORDER_DETAIL_PARCIAL_STATE,
  ORDER_DETAIL_RECHAZADO_STATE,
  ORDER_DETAIL_DEVUELTO_STATE,
  RETURN_PENDING_REVIEW_STATE,
  RETURN_REINGRESADO_STATE,
  RETURN_PERDIDA_STATE,
} = require('../shared/constants');

const RETURN_ELIGIBLE_STATES = new Set([PENDING_STATE, ORDER_DETAIL_PARCIAL_STATE, ORDER_DETAIL_RECHAZADO_STATE]);
const { normalizeNullableText } = require('../shared/helpers');
const { orderDetailQueries } = require('./order.worker');
const { AUDIT_ACTION_CREATE, AUDIT_ACTION_UPDATE, recordAudit } = require('../shared/audit');

const orderReturnBaseQuery = `SELECT dev.id_devolucion, dev.id_detalle, det.id_pedido, det.id_producto, prod.nombre AS producto_nombre, prod.unidad_medida, o.id_cliente, cli.nombre_comercial, ru.id_piloto, pil.nombre_completo AS piloto_nombre, dev.cantidad_devuelta, dev.motivo, dev.resolucion, dev.id_usuario_recepcion, rec.nombre_completo AS usuario_recepcion_nombre, dev.id_usuario_resolucion, res.nombre_completo AS usuario_resolucion_nombre, dev.fecha_recepcion, dev.fecha_resolucion FROM ${ORDER_RETURNS_TABLE} dev LEFT JOIN ${ORDER_DETAIL_TABLE} det ON det.id_detalle = dev.id_detalle LEFT JOIN ${ORDERS_TABLE} o ON o.id_pedido = det.id_pedido LEFT JOIN ${CLIENTS_TABLE} cli ON cli.id_cliente = o.id_cliente LEFT JOIN ${PRODUCTS_TABLE} prod ON prod.id_producto = det.id_producto LEFT JOIN ${ROUTE_ORDERS_TABLE} rp ON rp.id_pedido = o.id_pedido LEFT JOIN ${ROUTES_TABLE} ru ON ru.id_ruta = rp.id_ruta LEFT JOIN ${USERS_TABLE} pil ON pil.id_usuario = ru.id_piloto LEFT JOIN ${USERS_TABLE} rec ON rec.id_usuario = dev.id_usuario_recepcion LEFT JOIN ${USERS_TABLE} res ON res.id_usuario = dev.id_usuario_resolucion`;

const orderReturnQueries = {
  findAll: `${orderReturnBaseQuery} ORDER BY dev.fecha_recepcion DESC, dev.id_devolucion DESC`,
  findById: `${orderReturnBaseQuery} WHERE dev.id_devolucion = ?`,
  findPendingReview: `${orderReturnBaseQuery} WHERE dev.resolucion = '${RETURN_PENDING_REVIEW_STATE}' ORDER BY dev.fecha_recepcion ASC`,
  findForUpdate: `SELECT id_devolucion, id_detalle, cantidad_devuelta, resolucion FROM ${ORDER_RETURNS_TABLE} WHERE id_devolucion = ? FOR UPDATE`,
};

const handlers = {
  'orderReturns.findAll': async () => {
    const [rows] = await pool.query(orderReturnQueries.findAll);
    return rows;
  },
  'orderReturns.findPendingReview': async () => {
    const [rows] = await pool.query(orderReturnQueries.findPendingReview);
    return rows;
  },
  'orderReturns.create': async ({ id_detalle, cantidad_devuelta, motivo, id_usuario_recepcion }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [detailRows] = await connection.query(orderDetailQueries.findForReturnCheck, [id_detalle]);

      if (detailRows.length === 0 || !RETURN_ELIGIBLE_STATES.has(detailRows[0].estado_entrega)) {
        await connection.rollback();
        throw new Error('La linea de pedido no esta disponible para recibir devolucion');
      }

      const detail = detailRows[0];
      const cantidadNoEntregada = Number(detail.cantidad) - Number(detail.cantidad_entregada || 0);

      const [result] = await connection.query(
        `INSERT INTO ${ORDER_RETURNS_TABLE} (id_detalle, cantidad_devuelta, motivo, resolucion, id_usuario_recepcion) VALUES (?, ?, ?, ?, ?)`,
        [
          id_detalle,
          cantidad_devuelta === undefined || cantidad_devuelta === null || cantidad_devuelta === ''
            ? cantidadNoEntregada
            : Number(cantidad_devuelta),
          normalizeNullableText(motivo),
          RETURN_PENDING_REVIEW_STATE,
          id_usuario_recepcion,
        ]
      );

      await connection.query(
        `UPDATE ${ORDER_DETAIL_TABLE} SET estado_entrega = '${ORDER_DETAIL_DEVUELTO_STATE}' WHERE id_detalle = ?`,
        [id_detalle]
      );

      await recordAudit(connection, {
        table: ORDER_DETAIL_TABLE,
        recordId: id_detalle,
        action: AUDIT_ACTION_UPDATE,
        before: { estado_entrega: detail.estado_entrega },
        after: { estado_entrega: ORDER_DETAIL_DEVUELTO_STATE },
        userId: id_usuario_recepcion,
      });

      const [createdReturnRows] = await connection.query(orderReturnQueries.findById, [result.insertId]);

      await recordAudit(connection, {
        table: ORDER_RETURNS_TABLE,
        recordId: result.insertId,
        action: AUDIT_ACTION_CREATE,
        before: null,
        after: createdReturnRows[0] || null,
        userId: id_usuario_recepcion,
      });

      await connection.commit();

      return createdReturnRows[0] || null;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'orderReturns.resolve': async ({ id, resolucion, id_usuario_resolucion }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [returnRows] = await connection.query(orderReturnQueries.findForUpdate, [id]);

      if (returnRows.length === 0 || returnRows[0].resolucion !== RETURN_PENDING_REVIEW_STATE) {
        await connection.rollback();
        throw new Error('La devolucion ya fue resuelta');
      }

      const returnRow = returnRows[0];

      if (resolucion === RETURN_REINGRESADO_STATE) {
        const [detailRows] = await connection.query(
          `SELECT id_producto, id_existencia FROM ${ORDER_DETAIL_TABLE} WHERE id_detalle = ? FOR UPDATE`,
          [returnRow.id_detalle]
        );

        if (detailRows.length === 0) {
          await connection.rollback();
          throw new Error('No se encontro el producto de la linea devuelta');
        }

        const idProducto = detailRows[0].id_producto;

        // Preferimos reingresar al mismo lote del que salio (mantiene la trazabilidad del
        // lote); solo si esa existencia ya no existe o quedo inactiva caemos al lote mas
        // antiguo disponible del producto, o creamos uno nuevo (lineas anteriores a este
        // vinculo, o el lote de origen fue dado de baja).
        let existingInventoryRows = [];

        if (detailRows[0].id_existencia) {
          [existingInventoryRows] = await connection.query(
            `SELECT id_existencia FROM ${INVENTORY_TABLE} WHERE id_existencia = ? AND estado_registro = '${ACTIVE_STATE}' FOR UPDATE`,
            [detailRows[0].id_existencia]
          );
        }

        if (existingInventoryRows.length === 0) {
          [existingInventoryRows] = await connection.query(
            `SELECT id_existencia FROM ${INVENTORY_TABLE} WHERE id_producto = ? AND estado_registro = '${ACTIVE_STATE}' ORDER BY fecha_vencimiento ASC, id_existencia ASC LIMIT 1 FOR UPDATE`,
            [idProducto]
          );
        }

        let existenceId;

        if (existingInventoryRows.length > 0) {
          existenceId = existingInventoryRows[0].id_existencia;
        } else {
          const [existenceResult] = await connection.query(
            `INSERT INTO ${INVENTORY_TABLE} (id_producto, id_proveedor, id_proceso_origen, id_entrada_origen, fecha_vencimiento, cantidad_disponible, costo_unitario, estado_registro, id_usuario_modificacion) VALUES (?, NULL, NULL, NULL, CURRENT_DATE, ?, NULL, ?, ?)`,
            [idProducto, 0, ACTIVE_STATE, id_usuario_resolucion ?? null]
          );
          existenceId = existenceResult.insertId;

          const [createdExistenciaRows] = await connection.query(
            `SELECT * FROM ${INVENTORY_TABLE} WHERE id_existencia = ?`,
            [existenceId]
          );

          await recordAudit(connection, {
            table: INVENTORY_TABLE,
            recordId: existenceId,
            action: AUDIT_ACTION_CREATE,
            before: null,
            after: createdExistenciaRows[0] || null,
            userId: id_usuario_resolucion,
          });
        }

        await connection.query(
          `INSERT INTO ${MOVEMENTS_TABLE} (id_existencia, tipo_movimiento, cantidad, motivo, id_usuario, estado_registro) VALUES (?, 'Entrada', ?, ?, ?, ?)`,
          [existenceId, returnRow.cantidad_devuelta, `Reingreso por devolucion #${id}`, id_usuario_resolucion ?? null, ACTIVE_STATE]
        );

        await connection.query(
          `UPDATE ${INVENTORY_TABLE} SET id_usuario_modificacion = ? WHERE id_existencia = ?`,
          [id_usuario_resolucion ?? null, existenceId]
        );
      } else if (resolucion !== RETURN_PERDIDA_STATE) {
        await connection.rollback();
        throw new Error('resolucion invalida');
      }

      await connection.query(
        `UPDATE ${ORDER_RETURNS_TABLE} SET resolucion = ?, id_usuario_resolucion = ?, fecha_resolucion = NOW() WHERE id_devolucion = ?`,
        [resolucion, id_usuario_resolucion ?? null, id]
      );

      const [resolvedRows] = await connection.query(orderReturnQueries.findById, [id]);

      await recordAudit(connection, {
        table: ORDER_RETURNS_TABLE,
        recordId: id,
        action: AUDIT_ACTION_UPDATE,
        before: returnRow,
        after: resolvedRows[0] || null,
        userId: id_usuario_resolucion,
      });

      await connection.commit();

      return resolvedRows[0] || null;
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
