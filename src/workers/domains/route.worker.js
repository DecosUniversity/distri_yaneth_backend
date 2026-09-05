const { pool } = require('../../config/db');
const {
  USERS_TABLE,
  CLIENTS_TABLE,
  VEHICLES_TABLE,
  VEHICLE_MILEAGE_REPORTS_TABLE,
  ORDERS_TABLE,
  ORDER_DETAIL_TABLE,
  ROUTES_TABLE,
  ROUTE_ORDERS_TABLE,
  ACTIVE_STATE,
  PENDING_STATE,
  PILOT_ROLE,
  VEHICLE_AVAILABLE_STATE,
  VEHICLE_EN_ROUTE_STATE,
  ORDER_PREPARADO_STATE,
  ORDER_EN_RUTA_STATE,
  ORDER_ENTREGADO_STATE,
  ORDER_CON_DEVOLUCION_STATE,
  ORDER_DETAIL_ENTREGADO_STATE,
  ORDER_DETAIL_PARCIAL_STATE,
  ORDER_DETAIL_RECHAZADO_STATE,
  ROUTE_PREPARADO_STATE,
  ROUTE_EN_RUTA_STATE,
  ROUTE_CERRADA_STATE,
} = require('../shared/constants');
const { orderQueries } = require('./order.worker');
const { AUDIT_ACTION_CREATE, AUDIT_ACTION_UPDATE, recordAudit } = require('../shared/audit');

const routeBaseQuery = `SELECT ru.id_ruta, ru.id_vehiculo, v.placa AS vehiculo_placa, v.modelo AS vehiculo_modelo, ru.id_piloto, pil.nombre_completo AS piloto_nombre, ru.estado, ru.km_salida, ru.km_llegada, ru.galones_combustible, ru.fecha_salida, ru.fecha_llegada, ru.id_usuario_creacion, creator.nombre_completo AS usuario_creacion_nombre, ru.id_usuario_modificacion, um.nombre_completo AS usuario_modificacion_nombre, ru.estado_registro, ru.fecha_creacion, ru.fecha_modificacion FROM ${ROUTES_TABLE} ru LEFT JOIN ${VEHICLES_TABLE} v ON v.id_vehiculo = ru.id_vehiculo LEFT JOIN ${USERS_TABLE} pil ON pil.id_usuario = ru.id_piloto LEFT JOIN ${USERS_TABLE} creator ON creator.id_usuario = ru.id_usuario_creacion LEFT JOIN ${USERS_TABLE} um ON um.id_usuario = ru.id_usuario_modificacion`;

const routeQueries = {
  findAll: `${routeBaseQuery} WHERE ru.estado_registro = '${ACTIVE_STATE}' ORDER BY ru.fecha_creacion DESC, ru.id_ruta DESC`,
  findById: `${routeBaseQuery} WHERE ru.id_ruta = ? AND ru.estado_registro = '${ACTIVE_STATE}'`,
  findForUpdate: `SELECT id_ruta, id_vehiculo, id_piloto, estado, km_salida, km_llegada, estado_registro FROM ${ROUTES_TABLE} WHERE id_ruta = ? AND estado_registro = '${ACTIVE_STATE}' FOR UPDATE`,
  findManifest: `SELECT rp.id_ruta, rp.id_pedido, rp.orden_entrega, o.estado AS pedido_estado, o.id_cliente, c.nombre_comercial, COUNT(d.id_detalle) AS total_lineas, SUM(CASE WHEN d.estado_entrega = '${ORDER_DETAIL_ENTREGADO_STATE}' THEN 1 ELSE 0 END) AS lineas_entregadas FROM ${ROUTE_ORDERS_TABLE} rp LEFT JOIN ${ORDERS_TABLE} o ON o.id_pedido = rp.id_pedido LEFT JOIN ${CLIENTS_TABLE} c ON c.id_cliente = o.id_cliente LEFT JOIN ${ORDER_DETAIL_TABLE} d ON d.id_pedido = rp.id_pedido WHERE rp.id_ruta = ? GROUP BY rp.id_ruta, rp.id_pedido, rp.orden_entrega, o.estado, o.id_cliente, c.nombre_comercial ORDER BY rp.orden_entrega ASC, rp.id_pedido ASC`,
  findPilotosDisponibles: `SELECT u.id_usuario, u.nombre_completo, u.username, COALESCE(today_count.total, 0) AS rutas_hoy FROM ${USERS_TABLE} u LEFT JOIN (SELECT id_piloto, COUNT(*) AS total FROM ${ROUTES_TABLE} WHERE DATE(fecha_creacion) = CURDATE() AND estado_registro = '${ACTIVE_STATE}' GROUP BY id_piloto) today_count ON today_count.id_piloto = u.id_usuario WHERE u.rol = '${PILOT_ROLE}' AND u.estado_registro = '${ACTIVE_STATE}' AND u.id_usuario NOT IN (SELECT id_piloto FROM ${ROUTES_TABLE} WHERE estado IN ('${ROUTE_PREPARADO_STATE}', '${ROUTE_EN_RUTA_STATE}') AND estado_registro = '${ACTIVE_STATE}') ORDER BY rutas_hoy ASC, u.nombre_completo ASC`,
};

const handlers = {
  'routes.findAll': async () => {
    const [rows] = await pool.query(routeQueries.findAll);
    return rows;
  },
  'routes.findById': async ({ id }) => {
    const [rows] = await pool.query(routeQueries.findById, [id]);

    if (rows.length === 0) {
      return null;
    }

    const [manifest] = await pool.query(routeQueries.findManifest, [id]);
    return { ...rows[0], manifiesto: manifest };
  },
  'routes.pilotosDisponibles': async () => {
    const [rows] = await pool.query(routeQueries.findPilotosDisponibles);
    return rows;
  },
  'routes.create': async ({ id_pedidos, id_vehiculo, id_piloto, id_usuario_creacion }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [vehicleRows] = await connection.query(
        `SELECT id_vehiculo, estado, estado_registro FROM ${VEHICLES_TABLE} WHERE id_vehiculo = ? AND estado_registro = '${ACTIVE_STATE}' FOR UPDATE`,
        [id_vehiculo]
      );

      if (vehicleRows.length === 0 || vehicleRows[0].estado !== VEHICLE_AVAILABLE_STATE) {
        await connection.rollback();
        throw new Error('El vehiculo debe estar Disponible para asignarlo a una ruta');
      }

      const [pilotRows] = await connection.query(
        `SELECT id_usuario, rol FROM ${USERS_TABLE} WHERE id_usuario = ? AND estado_registro = '${ACTIVE_STATE}'`,
        [id_piloto]
      );

      if (pilotRows.length === 0 || pilotRows[0].rol !== PILOT_ROLE) {
        await connection.rollback();
        throw new Error('El piloto no tiene el rol Piloto o no esta activo');
      }

      const [activeRouteRows] = await connection.query(
        `SELECT id_ruta FROM ${ROUTES_TABLE} WHERE id_piloto = ? AND estado IN ('${ROUTE_PREPARADO_STATE}', '${ROUTE_EN_RUTA_STATE}') AND estado_registro = '${ACTIVE_STATE}' FOR UPDATE`,
        [id_piloto]
      );

      if (activeRouteRows.length > 0) {
        await connection.rollback();
        throw new Error('El piloto ya tiene una ruta activa');
      }

      if (!Array.isArray(id_pedidos) || id_pedidos.length === 0) {
        await connection.rollback();
        throw new Error('Debes seleccionar al menos un pedido para la ruta');
      }

      for (const orderId of id_pedidos) {
        const [orderRows] = await connection.query(orderQueries.findForUpdate, [orderId]);

        if (orderRows.length === 0 || orderRows[0].estado !== PENDING_STATE) {
          await connection.rollback();
          throw new Error('Todos los pedidos deben estar Pendiente para agregarlos a una ruta');
        }
      }

      const [routeResult] = await connection.query(
        `INSERT INTO ${ROUTES_TABLE} (id_vehiculo, id_piloto, id_usuario_creacion, id_usuario_modificacion, estado_registro) VALUES (?, ?, ?, ?, ?)`,
        [id_vehiculo, id_piloto, id_usuario_creacion, id_usuario_creacion, ACTIVE_STATE]
      );

      const routeId = routeResult.insertId;

      for (let index = 0; index < id_pedidos.length; index += 1) {
        await connection.query(
          `INSERT INTO ${ROUTE_ORDERS_TABLE} (id_ruta, id_pedido, orden_entrega) VALUES (?, ?, ?)`,
          [routeId, id_pedidos[index], index + 1]
        );

        await connection.query(
          `UPDATE ${ORDERS_TABLE} SET estado = '${ORDER_PREPARADO_STATE}', id_usuario_modificacion = ? WHERE id_pedido = ?`,
          [id_usuario_creacion, id_pedidos[index]]
        );

        await recordAudit(connection, {
          table: ORDERS_TABLE,
          recordId: id_pedidos[index],
          action: AUDIT_ACTION_UPDATE,
          before: { estado: PENDING_STATE },
          after: { estado: ORDER_PREPARADO_STATE, id_ruta: routeId },
          userId: id_usuario_creacion,
        });
      }

      await connection.query(
        `UPDATE ${VEHICLES_TABLE} SET estado = '${VEHICLE_EN_ROUTE_STATE}', id_usuario_modificacion = ? WHERE id_vehiculo = ?`,
        [id_usuario_creacion, id_vehiculo]
      );

      await recordAudit(connection, {
        table: VEHICLES_TABLE,
        recordId: id_vehiculo,
        action: AUDIT_ACTION_UPDATE,
        before: { estado: vehicleRows[0].estado },
        after: { estado: VEHICLE_EN_ROUTE_STATE },
        userId: id_usuario_creacion,
      });

      const [createdRouteRows] = await connection.query(routeQueries.findById, [routeId]);
      const [createdManifest] = await connection.query(routeQueries.findManifest, [routeId]);

      await recordAudit(connection, {
        table: ROUTES_TABLE,
        recordId: routeId,
        action: AUDIT_ACTION_CREATE,
        before: null,
        after: { ...(createdRouteRows[0] || {}), manifiesto: createdManifest },
        userId: id_usuario_creacion,
      });

      await connection.commit();

      return { ...createdRouteRows[0], manifiesto: createdManifest };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'routes.registrarSalida': async ({ id, km_salida, galones_combustible, id_usuario_modificacion }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [routeRows] = await connection.query(routeQueries.findForUpdate, [id]);

      if (routeRows.length === 0 || routeRows[0].estado !== ROUTE_PREPARADO_STATE) {
        await connection.rollback();
        throw new Error('La ruta debe estar Preparada para registrar la salida');
      }

      const routeBefore = routeRows[0];

      await connection.query(
        `UPDATE ${ROUTES_TABLE} SET km_salida = ?, galones_combustible = ?, fecha_salida = NOW(), estado = '${ROUTE_EN_RUTA_STATE}', id_usuario_modificacion = ? WHERE id_ruta = ?`,
        [Number(km_salida), galones_combustible === undefined || galones_combustible === null || galones_combustible === '' ? null : Number(galones_combustible), id_usuario_modificacion ?? null, id]
      );

      const [ordersToUpdate] = await connection.query(
        `SELECT o.id_pedido FROM ${ORDERS_TABLE} o INNER JOIN ${ROUTE_ORDERS_TABLE} rp ON rp.id_pedido = o.id_pedido WHERE rp.id_ruta = ? AND o.estado = '${ORDER_PREPARADO_STATE}'`,
        [id]
      );

      await connection.query(
        `UPDATE ${ORDERS_TABLE} o INNER JOIN ${ROUTE_ORDERS_TABLE} rp ON rp.id_pedido = o.id_pedido SET o.estado = '${ORDER_EN_RUTA_STATE}', o.id_usuario_modificacion = ? WHERE rp.id_ruta = ? AND o.estado = '${ORDER_PREPARADO_STATE}'`,
        [id_usuario_modificacion ?? null, id]
      );

      for (const orderRow of ordersToUpdate) {
        await recordAudit(connection, {
          table: ORDERS_TABLE,
          recordId: orderRow.id_pedido,
          action: AUDIT_ACTION_UPDATE,
          before: { estado: ORDER_PREPARADO_STATE },
          after: { estado: ORDER_EN_RUTA_STATE },
          userId: id_usuario_modificacion,
        });
      }

      const [updatedRouteRows] = await connection.query(routeQueries.findById, [id]);
      const [manifest] = await connection.query(routeQueries.findManifest, [id]);

      await recordAudit(connection, {
        table: ROUTES_TABLE,
        recordId: id,
        action: AUDIT_ACTION_UPDATE,
        before: routeBefore,
        after: updatedRouteRows[0] || null,
        userId: id_usuario_modificacion,
      });

      await connection.commit();

      return { ...updatedRouteRows[0], manifiesto: manifest };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'routes.confirmarEntregas': async ({ id, entregas, id_usuario_modificacion, esAdministrador }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [routeRows] = await connection.query(routeQueries.findForUpdate, [id]);

      if (routeRows.length === 0 || routeRows[0].estado !== ROUTE_EN_RUTA_STATE) {
        await connection.rollback();
        throw new Error('La ruta debe estar En Ruta para confirmar entregas');
      }

      const [manifestDetailRows] = await connection.query(
        `SELECT d.id_detalle, d.cantidad, d.estado_entrega, d.cantidad_entregada FROM ${ORDER_DETAIL_TABLE} d INNER JOIN ${ROUTE_ORDERS_TABLE} rp ON rp.id_pedido = d.id_pedido WHERE rp.id_ruta = ?`,
        [id]
      );
      const detailById = new Map(manifestDetailRows.map((row) => [row.id_detalle, row]));

      for (const entrega of entregas || []) {
        const detailRow = detailById.get(Number(entrega.id_detalle));

        if (!detailRow) {
          await connection.rollback();
          throw new Error('La linea de pedido no pertenece a esta ruta');
        }

        const cantidadTotal = Number(detailRow.cantidad);
        let cantidadEntregada = Number(entrega.cantidad_entregada);

        if (!Number.isFinite(cantidadEntregada) || cantidadEntregada < 0) {
          cantidadEntregada = 0;
        } else if (cantidadEntregada > cantidadTotal) {
          cantidadEntregada = cantidadTotal;
        }

        const cantidadPrevia = detailRow.cantidad_entregada === null ? null : Number(detailRow.cantidad_entregada);
        const yaProcesada = detailRow.estado_entrega !== PENDING_STATE;
        const sinCambios = yaProcesada && cantidadPrevia === cantidadEntregada;

        if (yaProcesada && !sinCambios && !esAdministrador) {
          await connection.rollback();
          throw new Error('La linea ya fue procesada; solo un administrador puede modificarla');
        }

        if (sinCambios) {
          continue;
        }

        const nextState =
          cantidadEntregada <= 0
            ? ORDER_DETAIL_RECHAZADO_STATE
            : cantidadEntregada >= cantidadTotal
              ? ORDER_DETAIL_ENTREGADO_STATE
              : ORDER_DETAIL_PARCIAL_STATE;

        await connection.query(
          `UPDATE ${ORDER_DETAIL_TABLE} SET estado_entrega = ?, cantidad_entregada = ? WHERE id_detalle = ?`,
          [nextState, cantidadEntregada, entrega.id_detalle]
        );

        await recordAudit(connection, {
          table: ORDER_DETAIL_TABLE,
          recordId: entrega.id_detalle,
          action: AUDIT_ACTION_UPDATE,
          before: { estado_entrega: detailRow.estado_entrega, cantidad_entregada: cantidadPrevia },
          after: { estado_entrega: nextState, cantidad_entregada: cantidadEntregada },
          userId: id_usuario_modificacion,
        });
      }

      await connection.commit();

      const [rows] = await pool.query(routeQueries.findById, [id]);
      const [manifest] = await pool.query(routeQueries.findManifest, [id]);
      return { ...rows[0], manifiesto: manifest };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  'routes.cerrar': async ({ id, km_llegada, id_usuario_modificacion }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [routeRows] = await connection.query(routeQueries.findForUpdate, [id]);

      if (routeRows.length === 0 || routeRows[0].estado !== ROUTE_EN_RUTA_STATE) {
        await connection.rollback();
        throw new Error('La ruta debe estar En Ruta para cerrarla');
      }

      const route = routeRows[0];
      const parsedKmLlegada = Number(km_llegada);

      if (!Number.isFinite(parsedKmLlegada) || parsedKmLlegada <= Number(route.km_salida)) {
        await connection.rollback();
        throw new Error('km_llegada debe ser mayor a km_salida');
      }

      await connection.query(
        `UPDATE ${ROUTES_TABLE} SET km_llegada = ?, fecha_llegada = NOW(), estado = '${ROUTE_CERRADA_STATE}', id_usuario_modificacion = ? WHERE id_ruta = ?`,
        [parsedKmLlegada, id_usuario_modificacion ?? null, id]
      );

      await connection.query(
        `UPDATE ${VEHICLES_TABLE} SET kilometraje_actual = ?, estado = '${VEHICLE_AVAILABLE_STATE}', id_usuario_modificacion = ? WHERE id_vehiculo = ?`,
        [parsedKmLlegada, id_usuario_modificacion ?? null, route.id_vehiculo]
      );

      await recordAudit(connection, {
        table: VEHICLES_TABLE,
        recordId: route.id_vehiculo,
        action: AUDIT_ACTION_UPDATE,
        before: { estado: VEHICLE_EN_ROUTE_STATE },
        after: { estado: VEHICLE_AVAILABLE_STATE, kilometraje_actual: parsedKmLlegada },
        userId: id_usuario_modificacion,
      });

      const [mileageResult] = await connection.query(
        `INSERT INTO ${VEHICLE_MILEAGE_REPORTS_TABLE} (id_vehiculo, id_usuario_modificador, kilometraje_registrado) VALUES (?, ?, ?)`,
        [route.id_vehiculo, id_usuario_modificacion ?? null, parsedKmLlegada]
      );

      await recordAudit(connection, {
        table: VEHICLE_MILEAGE_REPORTS_TABLE,
        recordId: mileageResult.insertId,
        action: AUDIT_ACTION_CREATE,
        before: null,
        after: { id_vehiculo: route.id_vehiculo, id_usuario_modificador: id_usuario_modificacion, kilometraje_registrado: parsedKmLlegada },
        userId: id_usuario_modificacion,
      });

      const [manifestRows] = await connection.query(
        `SELECT id_pedido FROM ${ROUTE_ORDERS_TABLE} WHERE id_ruta = ?`,
        [id]
      );

      for (const manifestRow of manifestRows) {
        const [detailRows] = await connection.query(
          `SELECT estado_entrega FROM ${ORDER_DETAIL_TABLE} WHERE id_pedido = ?`,
          [manifestRow.id_pedido]
        );
        const allDelivered = detailRows.length > 0 && detailRows.every((row) => row.estado_entrega === ORDER_DETAIL_ENTREGADO_STATE);
        const nextOrderState = allDelivered ? ORDER_ENTREGADO_STATE : ORDER_CON_DEVOLUCION_STATE;

        await connection.query(
          `UPDATE ${ORDERS_TABLE} SET estado = ?, fecha_entrega = NOW(), id_usuario_modificacion = ? WHERE id_pedido = ?`,
          [nextOrderState, id_usuario_modificacion ?? null, manifestRow.id_pedido]
        );

        await recordAudit(connection, {
          table: ORDERS_TABLE,
          recordId: manifestRow.id_pedido,
          action: AUDIT_ACTION_UPDATE,
          before: { estado: ORDER_EN_RUTA_STATE },
          after: { estado: nextOrderState },
          userId: id_usuario_modificacion,
        });
      }

      const [closedRouteRows] = await connection.query(routeQueries.findById, [id]);
      const [manifest] = await connection.query(routeQueries.findManifest, [id]);

      await recordAudit(connection, {
        table: ROUTES_TABLE,
        recordId: id,
        action: AUDIT_ACTION_UPDATE,
        before: route,
        after: closedRouteRows[0] || null,
        userId: id_usuario_modificacion,
      });

      await connection.commit();

      return { ...closedRouteRows[0], manifiesto: manifest };
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
