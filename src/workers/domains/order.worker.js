const { pool } = require('../../config/db');
const {
  USERS_TABLE,
  CLIENTS_TABLE,
  PROVIDERS_TABLE,
  PRODUCTS_TABLE,
  INVENTORY_TABLE,
  MOVEMENTS_TABLE,
  ORDERS_TABLE,
  ORDER_DETAIL_TABLE,
  ROUTES_TABLE,
  ROUTE_ORDERS_TABLE,
  ACTIVE_STATE,
  PENDING_STATE,
  ORDER_PREPARADO_STATE,
  ORDER_EN_RUTA_STATE,
  ORDER_ENTREGADO_STATE,
  ORDER_DETAIL_PARCIAL_STATE,
  ORDER_DETAIL_RECHAZADO_STATE,
  ORDER_CON_DEVOLUCION_STATE,
  ORDER_CANCELADO_STATE,
} = require('../shared/constants');
const { normalizeNullableText } = require('../shared/helpers');
const { AUDIT_ACTION_CREATE, AUDIT_ACTION_UPDATE, recordAudit } = require('../shared/audit');

const orderBaseQuery = `SELECT o.id_pedido, o.id_cliente, c.nombre_comercial, c.departamento, c.municipio, c.zona, c.direccion_entrega, c.telefono, c.nit_facturacion, o.estado, o.observaciones, o.fecha_entrega_programada, o.id_usuario_creacion, creator.nombre_completo AS usuario_creacion_nombre, o.id_usuario_modificacion, um.nombre_completo AS usuario_modificacion_nombre, o.estado_registro, o.fecha_creacion, o.fecha_modificacion, o.fecha_entrega, rp.id_ruta AS id_ruta_actual, r.estado AS ruta_estado FROM ${ORDERS_TABLE} o LEFT JOIN ${CLIENTS_TABLE} c ON c.id_cliente = o.id_cliente LEFT JOIN ${USERS_TABLE} creator ON creator.id_usuario = o.id_usuario_creacion LEFT JOIN ${USERS_TABLE} um ON um.id_usuario = o.id_usuario_modificacion LEFT JOIN ${ROUTE_ORDERS_TABLE} rp ON rp.id_pedido = o.id_pedido LEFT JOIN ${ROUTES_TABLE} r ON r.id_ruta = rp.id_ruta`;

const orderQueries = {
  findAll: `${orderBaseQuery} WHERE o.estado_registro = '${ACTIVE_STATE}' ORDER BY o.fecha_creacion DESC, o.id_pedido DESC`,
  findById: `${orderBaseQuery} WHERE o.id_pedido = ? AND o.estado_registro = '${ACTIVE_STATE}'`,
  findForUpdate: `SELECT id_pedido, estado, estado_registro FROM ${ORDERS_TABLE} WHERE id_pedido = ? AND estado_registro = '${ACTIVE_STATE}' FOR UPDATE`,
};

const orderDetailQueries = {
  findByOrder: `SELECT d.id_detalle, d.id_pedido, d.id_producto, p.nombre AS producto_nombre, p.unidad_medida, d.id_existencia, ie.fecha_vencimiento AS existencia_fecha_vencimiento, d.cantidad, d.estado_entrega, d.cantidad_entregada FROM ${ORDER_DETAIL_TABLE} d LEFT JOIN ${PRODUCTS_TABLE} p ON p.id_producto = d.id_producto LEFT JOIN ${INVENTORY_TABLE} ie ON ie.id_existencia = d.id_existencia WHERE d.id_pedido = ? ORDER BY d.id_detalle ASC`,
  findByOrders: `SELECT d.id_detalle, d.id_pedido, d.id_producto, p.nombre AS producto_nombre, p.unidad_medida, d.id_existencia, ie.fecha_vencimiento AS existencia_fecha_vencimiento, d.cantidad, d.estado_entrega, d.cantidad_entregada FROM ${ORDER_DETAIL_TABLE} d LEFT JOIN ${PRODUCTS_TABLE} p ON p.id_producto = d.id_producto LEFT JOIN ${INVENTORY_TABLE} ie ON ie.id_existencia = d.id_existencia WHERE d.id_pedido IN (?) ORDER BY d.id_pedido ASC, d.id_detalle ASC`,
  findById: `SELECT d.id_detalle, d.id_pedido, d.id_producto, p.nombre AS producto_nombre, p.unidad_medida, d.id_existencia, ie.fecha_vencimiento AS existencia_fecha_vencimiento, d.cantidad, d.estado_entrega, d.cantidad_entregada FROM ${ORDER_DETAIL_TABLE} d LEFT JOIN ${PRODUCTS_TABLE} p ON p.id_producto = d.id_producto LEFT JOIN ${INVENTORY_TABLE} ie ON ie.id_existencia = d.id_existencia WHERE d.id_detalle = ?`,
  findForUpdate: `SELECT id_detalle, id_pedido, id_producto, id_existencia, cantidad, estado_entrega, cantidad_entregada FROM ${ORDER_DETAIL_TABLE} WHERE id_detalle = ? FOR UPDATE`,
  findForReturnCheck: `SELECT d.id_detalle, d.id_producto, d.id_existencia, d.cantidad, d.estado_entrega, d.cantidad_entregada, o.id_pedido, o.estado AS pedido_estado FROM ${ORDER_DETAIL_TABLE} d INNER JOIN ${ORDERS_TABLE} o ON o.id_pedido = d.id_pedido WHERE d.id_detalle = ? FOR UPDATE`,
  // Existencias del producto con stock disponible (Entrada - Salida/Ajuste/Desperdicio),
  // ordenadas FIFO por fecha de vencimiento; misma logica que production.worker usa para
  // consumir insumos. Si se pasa id_existencia, filtra a esa unica fila (para bloquearla y
  // validar la seleccion manual del usuario).
  findAvailableExistencias: (withExistenciaFilter) => `SELECT ie.id_existencia, ie.fecha_vencimiento, ie.id_proveedor, prov.nombre_empresa, COALESCE(stock.cantidad_disponible, 0) AS cantidad_disponible FROM ${INVENTORY_TABLE} ie LEFT JOIN ${PROVIDERS_TABLE} prov ON prov.id_proveedor = ie.id_proveedor LEFT JOIN (SELECT id_existencia, SUM(CASE WHEN tipo_movimiento = 'Entrada' THEN cantidad WHEN tipo_movimiento IN ('Salida', 'Ajuste', 'Desperdicio') THEN -cantidad ELSE 0 END) AS cantidad_disponible FROM ${MOVEMENTS_TABLE} WHERE estado_registro = '${ACTIVE_STATE}' GROUP BY id_existencia) stock ON stock.id_existencia = ie.id_existencia WHERE ie.id_producto = ? AND ie.estado_registro = '${ACTIVE_STATE}'${withExistenciaFilter ? ' AND ie.id_existencia = ?' : ''} ORDER BY ie.fecha_vencimiento ASC, ie.id_existencia ASC FOR UPDATE`,
  // Una linea Parcial/Rechazada ya es un resultado definitivo de la entrega (no depende
  // de que la ruta se cierre): se detecta como pendiente de devolucion de inmediato.
  // Una linea que se quedo en Pendiente solo cuenta si la ruta ya se cerro con el pedido
  // en Con Devolucion (nadie la proceso durante la confirmacion de entregas).
  findPendingReturn: `SELECT d.id_detalle, d.id_pedido, d.id_producto, p.nombre AS producto_nombre, p.unidad_medida, d.cantidad, d.estado_entrega, d.cantidad_entregada, o.id_cliente, c.nombre_comercial, ru.id_piloto, pil.nombre_completo AS piloto_nombre FROM ${ORDER_DETAIL_TABLE} d INNER JOIN ${ORDERS_TABLE} o ON o.id_pedido = d.id_pedido LEFT JOIN ${PRODUCTS_TABLE} p ON p.id_producto = d.id_producto LEFT JOIN ${CLIENTS_TABLE} c ON c.id_cliente = o.id_cliente LEFT JOIN ${ROUTE_ORDERS_TABLE} rp ON rp.id_pedido = o.id_pedido LEFT JOIN ${ROUTES_TABLE} ru ON ru.id_ruta = rp.id_ruta LEFT JOIN ${USERS_TABLE} pil ON pil.id_usuario = ru.id_piloto WHERE (d.estado_entrega IN ('${ORDER_DETAIL_PARCIAL_STATE}', '${ORDER_DETAIL_RECHAZADO_STATE}') OR (d.estado_entrega = '${PENDING_STATE}' AND o.estado = '${ORDER_CON_DEVOLUCION_STATE}')) AND o.estado_registro = '${ACTIVE_STATE}' ORDER BY o.fecha_modificacion DESC, d.id_detalle ASC`,
};

const buildOrderReportFilters = ({ desde, hasta, id_cliente }) => {
  const conditions = [`o.estado_registro = '${ACTIVE_STATE}'`, `o.estado <> '${ORDER_CANCELADO_STATE}'`];
  const params = [];

  if (desde) {
    conditions.push('o.fecha_creacion >= ?');
    params.push(desde);
  }

  if (hasta) {
    // hasta es una fecha (YYYY-MM-DD): se extiende al final del dia para incluirlo completo.
    conditions.push('o.fecha_creacion < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(hasta);
  }

  if (id_cliente) {
    conditions.push('o.id_cliente = ?');
    params.push(id_cliente);
  }

  return { where: conditions.join(' AND '), params };
};

const handlers = {
  'orders.reportProductosMasVendidos': async ({ desde, hasta, id_cliente }) => {
    const { where, params } = buildOrderReportFilters({ desde, hasta, id_cliente });

    const [rows] = await pool.query(
      `SELECT d.id_producto, p.nombre AS producto_nombre, p.unidad_medida,
              SUM(d.cantidad) AS cantidad_total,
              COUNT(DISTINCT d.id_pedido) AS total_pedidos
       FROM ${ORDER_DETAIL_TABLE} d
       INNER JOIN ${ORDERS_TABLE} o ON o.id_pedido = d.id_pedido
       LEFT JOIN ${PRODUCTS_TABLE} p ON p.id_producto = d.id_producto
       WHERE ${where}
       GROUP BY d.id_producto, p.nombre, p.unidad_medida
       ORDER BY cantidad_total DESC
       LIMIT 50`,
      params
    );

    return rows;
  },
  'orders.reportMejoresClientes': async ({ desde, hasta }) => {
    const { where, params } = buildOrderReportFilters({ desde, hasta, id_cliente: null });

    const [rows] = await pool.query(
      `SELECT o.id_cliente, c.nombre_comercial,
              COUNT(DISTINCT o.id_pedido) AS total_pedidos,
              COALESCE(SUM(d.cantidad), 0) AS cantidad_total
       FROM ${ORDERS_TABLE} o
       LEFT JOIN ${ORDER_DETAIL_TABLE} d ON d.id_pedido = o.id_pedido
       LEFT JOIN ${CLIENTS_TABLE} c ON c.id_cliente = o.id_cliente
       WHERE ${where}
       GROUP BY o.id_cliente, c.nombre_comercial
       ORDER BY total_pedidos DESC, cantidad_total DESC
       LIMIT 50`,
      params
    );

    return rows;
  },
  // "Pedidos del dia": pendientes se cuentan por fecha de creacion (aun no tienen fecha de
  // entrega); entregados/con devolucion se cuentan por fecha_entrega (cuando se cerro la
  // ruta), no por fecha de creacion, para reflejar la actividad de entrega real del dia.
  'orders.reportPedidosDelDia': async ({ fecha } = {}) => {
    const targetDate = fecha || null;

    const [rows] = await pool.query(
      `SELECT
         COALESCE(?, CURDATE()) AS fecha_reporte,
         SUM(CASE WHEN o.estado IN ('${PENDING_STATE}', '${ORDER_PREPARADO_STATE}', '${ORDER_EN_RUTA_STATE}') AND DATE(o.fecha_creacion) = COALESCE(?, CURDATE()) THEN 1 ELSE 0 END) AS pendientes,
         SUM(CASE WHEN o.estado = '${ORDER_ENTREGADO_STATE}' AND DATE(o.fecha_entrega) = COALESCE(?, CURDATE()) THEN 1 ELSE 0 END) AS entregados,
         SUM(CASE WHEN o.estado = '${ORDER_CON_DEVOLUCION_STATE}' AND DATE(o.fecha_entrega) = COALESCE(?, CURDATE()) THEN 1 ELSE 0 END) AS con_devolucion
       FROM ${ORDERS_TABLE} o
       WHERE o.estado_registro = '${ACTIVE_STATE}'`,
      [targetDate, targetDate, targetDate, targetDate]
    );

    const row = rows[0] || {};

    return {
      fecha: row.fecha_reporte,
      pendientes: Number(row.pendientes) || 0,
      entregados: Number(row.entregados) || 0,
      con_devolucion: Number(row.con_devolucion) || 0,
    };
  },
  'orders.findAll': async () => {
    const [rows] = await pool.query(orderQueries.findAll);

    if (rows.length === 0) {
      return rows;
    }

    const orderIds = rows.map((row) => row.id_pedido);
    const [detailRows] = await pool.query(orderDetailQueries.findByOrders, [orderIds]);
    const detailsByOrder = detailRows.reduce((accumulator, row) => {
      (accumulator[row.id_pedido] = accumulator[row.id_pedido] || []).push(row);
      return accumulator;
    }, {});

    return rows.map((row) => ({ ...row, lineas: detailsByOrder[row.id_pedido] || [] }));
  },
  'orders.findById': async ({ id }) => {
    const [rows] = await pool.query(orderQueries.findById, [id]);

    if (rows.length === 0) {
      return null;
    }

    const [detailRows] = await pool.query(orderDetailQueries.findByOrder, [id]);
    return { ...rows[0], lineas: detailRows };
  },
  'orders.findPendingReturnLines': async () => {
    const [rows] = await pool.query(orderDetailQueries.findPendingReturn);
    return rows;
  },
  'orders.create': async ({ id_cliente, observaciones, fecha_entrega_programada, id_usuario_creacion, lineas }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        `INSERT INTO ${ORDERS_TABLE} (id_cliente, observaciones, fecha_entrega_programada, id_usuario_creacion, id_usuario_modificacion, estado_registro) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id_cliente,
          normalizeNullableText(observaciones),
          fecha_entrega_programada || null,
          id_usuario_creacion,
          id_usuario_creacion,
          ACTIVE_STATE,
        ]
      );

      const orderId = result.insertId;

      for (const linea of lineas) {
        const cantidadSolicitada = Number(linea.cantidad);
        const idExistenciaSolicitada = linea.id_existencia ? Number(linea.id_existencia) : null;

        const [existenciaRows] = await connection.query(
          orderDetailQueries.findAvailableExistencias(Boolean(idExistenciaSolicitada)),
          idExistenciaSolicitada ? [linea.id_producto, idExistenciaSolicitada] : [linea.id_producto]
        );

        // Sin id_existencia: se sugiere/asigna automaticamente la mas antigua por vencimiento
        // (FIFO) con stock suficiente. Con id_existencia: se respeta la seleccion manual del
        // usuario, validando que tenga stock suficiente.
        const selected = idExistenciaSolicitada
          ? existenciaRows[0]
          : existenciaRows.find((row) => Number(row.cantidad_disponible) >= cantidadSolicitada);

        if (!selected) {
          await connection.rollback();
          throw new Error(
            idExistenciaSolicitada
              ? 'La existencia seleccionada no existe o no tiene stock suficiente'
              : 'No hay suficiente inventario disponible para el producto solicitado'
          );
        }

        if (idExistenciaSolicitada && Number(selected.cantidad_disponible) < cantidadSolicitada) {
          await connection.rollback();
          throw new Error('La existencia seleccionada no tiene stock suficiente');
        }

        await connection.query(
          `INSERT INTO ${ORDER_DETAIL_TABLE} (id_pedido, id_producto, id_existencia, cantidad) VALUES (?, ?, ?, ?)`,
          [orderId, linea.id_producto, selected.id_existencia, cantidadSolicitada]
        );

        await connection.query(
          `INSERT INTO ${MOVEMENTS_TABLE} (id_existencia, tipo_movimiento, cantidad, motivo, id_usuario, estado_registro) VALUES (?, 'Salida', ?, ?, ?, ?)`,
          [selected.id_existencia, cantidadSolicitada, `Venta pedido #${orderId}`, id_usuario_creacion, ACTIVE_STATE]
        );
      }

      const [createdOrderRows] = await connection.query(orderQueries.findById, [orderId]);
      const [createdDetailRows] = await connection.query(orderDetailQueries.findByOrder, [orderId]);

      await recordAudit(connection, {
        table: ORDERS_TABLE,
        recordId: orderId,
        action: AUDIT_ACTION_CREATE,
        before: null,
        after: { ...(createdOrderRows[0] || {}), lineas: createdDetailRows },
        userId: id_usuario_creacion,
      });

      await connection.commit();

      return { ...createdOrderRows[0], lineas: createdDetailRows };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'orders.cancel': async ({ id, id_usuario_modificacion }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [rows] = await connection.query(orderQueries.findForUpdate, [id]);

      if (rows.length === 0 || rows[0].estado !== PENDING_STATE) {
        await connection.rollback();
        return null;
      }

      const [beforeRows] = await connection.query(orderQueries.findById, [id]);

      await connection.query(
        `UPDATE ${ORDERS_TABLE} SET estado = '${ORDER_CANCELADO_STATE}', id_usuario_modificacion = ? WHERE id_pedido = ?`,
        [id_usuario_modificacion ?? null, id]
      );

      const [updated] = await connection.query(orderQueries.findById, [id]);

      await recordAudit(connection, {
        table: ORDERS_TABLE,
        recordId: id,
        action: AUDIT_ACTION_UPDATE,
        before: beforeRows[0] || null,
        after: updated[0] || null,
        userId: id_usuario_modificacion,
      });

      await connection.commit();

      return updated[0] || null;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'orders.updateFechaEntregaProgramada': async ({ id, fecha_entrega_programada, id_usuario_modificacion }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [rows] = await connection.query(orderQueries.findForUpdate, [id]);

      if (rows.length === 0) {
        await connection.rollback();
        return null;
      }

      const resolvedStates = new Set([ORDER_ENTREGADO_STATE, ORDER_CON_DEVOLUCION_STATE, ORDER_CANCELADO_STATE]);

      if (resolvedStates.has(rows[0].estado)) {
        await connection.rollback();
        throw new Error('El pedido ya no esta en curso; no se puede cambiar su fecha de entrega');
      }

      const [beforeRows] = await connection.query(orderQueries.findById, [id]);

      await connection.query(
        `UPDATE ${ORDERS_TABLE} SET fecha_entrega_programada = ?, id_usuario_modificacion = ? WHERE id_pedido = ?`,
        [fecha_entrega_programada || null, id_usuario_modificacion ?? null, id]
      );

      const [updated] = await connection.query(orderQueries.findById, [id]);

      await recordAudit(connection, {
        table: ORDERS_TABLE,
        recordId: id,
        action: AUDIT_ACTION_UPDATE,
        before: beforeRows[0] || null,
        after: updated[0] || null,
        userId: id_usuario_modificacion,
      });

      await connection.commit();

      return updated[0] || null;
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
  orderQueries,
  orderDetailQueries,
};
