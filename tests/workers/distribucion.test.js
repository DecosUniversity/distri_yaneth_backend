const { pool, resetDatabase, seedBaseline } = require('../helpers/db');
const { createVehicle, createPilot, createOrderWithLines, createFinishedProductStock } = require('../helpers/fixtures');
const { handlers: orderHandlers } = require('../../src/workers/domains/order.worker.js');
const { handlers: routeHandlers } = require('../../src/workers/domains/route.worker.js');
const { handlers: returnHandlers } = require('../../src/workers/domains/order_return.worker.js');

let baseline;

beforeEach(async () => {
  await resetDatabase();
  baseline = await seedBaseline();
});

describe('orders.create: asignacion de lote (existencia)', () => {
  it('sin id_existencia, descuenta automaticamente del lote mas antiguo por vencimiento (FIFO)', async () => {
    const idViejo = await createFinishedProductStock({
      idProducto: baseline.idProductoTerminado,
      cantidad: 10,
      fechaVencimiento: '2027-01-01',
    });
    await createFinishedProductStock({
      idProducto: baseline.idProductoTerminado,
      cantidad: 10,
      fechaVencimiento: '2028-01-01',
    });

    const order = await orderHandlers['orders.create']({
      id_cliente: baseline.idCliente,
      observaciones: null,
      id_usuario_creacion: baseline.idUsuario,
      lineas: [{ id_producto: baseline.idProductoTerminado, cantidad: 6 }],
    });

    expect(order.lineas[0].id_existencia).toBe(idViejo);

    const [movementRows] = await pool.query(
      "SELECT cantidad, tipo_movimiento FROM movimientos_inventario WHERE id_existencia = ? AND motivo LIKE 'Venta pedido%'",
      [idViejo]
    );
    expect(movementRows).toHaveLength(1);
    expect(movementRows[0].tipo_movimiento).toBe('Salida');
    expect(Number(movementRows[0].cantidad)).toBe(6);
  });

  it('respeta la existencia seleccionada manualmente aunque no sea la mas antigua', async () => {
    await createFinishedProductStock({
      idProducto: baseline.idProductoTerminado,
      cantidad: 10,
      fechaVencimiento: '2027-01-01',
    });
    const idNuevo = await createFinishedProductStock({
      idProducto: baseline.idProductoTerminado,
      cantidad: 10,
      fechaVencimiento: '2028-01-01',
    });

    const order = await orderHandlers['orders.create']({
      id_cliente: baseline.idCliente,
      observaciones: null,
      id_usuario_creacion: baseline.idUsuario,
      lineas: [{ id_producto: baseline.idProductoTerminado, cantidad: 4, id_existencia: idNuevo }],
    });

    expect(order.lineas[0].id_existencia).toBe(idNuevo);
  });

  it('rechaza el pedido si no hay stock suficiente en ningun lote', async () => {
    await createFinishedProductStock({ idProducto: baseline.idProductoTerminado, cantidad: 3 });

    await expect(
      orderHandlers['orders.create']({
        id_cliente: baseline.idCliente,
        observaciones: null,
        id_usuario_creacion: baseline.idUsuario,
        lineas: [{ id_producto: baseline.idProductoTerminado, cantidad: 10 }],
      })
    ).rejects.toThrow('No hay suficiente inventario disponible para el producto solicitado');
  });

  it('rechaza si la existencia seleccionada manualmente no tiene stock suficiente', async () => {
    const idExistencia = await createFinishedProductStock({ idProducto: baseline.idProductoTerminado, cantidad: 3 });

    await expect(
      orderHandlers['orders.create']({
        id_cliente: baseline.idCliente,
        observaciones: null,
        id_usuario_creacion: baseline.idUsuario,
        lineas: [{ id_producto: baseline.idProductoTerminado, cantidad: 10, id_existencia: idExistencia }],
      })
    ).rejects.toThrow('La existencia seleccionada no tiene stock suficiente');
  });
});

describe('orders.create / orders.updateFechaEntregaProgramada: fecha de entrega programada', () => {
  it('guarda la fecha de entrega programada al crear el pedido', async () => {
    await createFinishedProductStock({ idProducto: baseline.idProductoTerminado, cantidad: 10 });

    const order = await orderHandlers['orders.create']({
      id_cliente: baseline.idCliente,
      observaciones: null,
      fecha_entrega_programada: '2026-09-10',
      id_usuario_creacion: baseline.idUsuario,
      lineas: [{ id_producto: baseline.idProductoTerminado, cantidad: 5 }],
    });

    expect(new Date(order.fecha_entrega_programada).toISOString().slice(0, 10)).toBe('2026-09-10');
  });

  it('permite cambiar la fecha de entrega programada mientras el pedido sigue en curso', async () => {
    await createFinishedProductStock({ idProducto: baseline.idProductoTerminado, cantidad: 10 });

    const order = await orderHandlers['orders.create']({
      id_cliente: baseline.idCliente,
      observaciones: null,
      fecha_entrega_programada: '2026-09-10',
      id_usuario_creacion: baseline.idUsuario,
      lineas: [{ id_producto: baseline.idProductoTerminado, cantidad: 5 }],
    });

    const updated = await orderHandlers['orders.updateFechaEntregaProgramada']({
      id: order.id_pedido,
      fecha_entrega_programada: '2026-09-15',
      id_usuario_modificacion: baseline.idUsuario,
    });

    expect(new Date(updated.fecha_entrega_programada).toISOString().slice(0, 10)).toBe('2026-09-15');
  });

  it('rechaza cambiar la fecha de entrega programada de un pedido ya Cancelado', async () => {
    await createFinishedProductStock({ idProducto: baseline.idProductoTerminado, cantidad: 10 });

    const order = await orderHandlers['orders.create']({
      id_cliente: baseline.idCliente,
      observaciones: null,
      id_usuario_creacion: baseline.idUsuario,
      lineas: [{ id_producto: baseline.idProductoTerminado, cantidad: 5 }],
    });

    await orderHandlers['orders.cancel']({ id: order.id_pedido, id_usuario_modificacion: baseline.idUsuario });

    await expect(
      orderHandlers['orders.updateFechaEntregaProgramada']({
        id: order.id_pedido,
        fecha_entrega_programada: '2026-09-15',
        id_usuario_modificacion: baseline.idUsuario,
      })
    ).rejects.toThrow('El pedido ya no esta en curso; no se puede cambiar su fecha de entrega');
  });
});

describe('orders.cancel', () => {
  it('cancela un pedido Pendiente', async () => {
    const { idPedido } = await createOrderWithLines({
      idCliente: baseline.idCliente,
      idProducto: baseline.idProductoTerminado,
      idUsuarioCreacion: baseline.idUsuario,
    });

    const cancelled = await orderHandlers['orders.cancel']({ id: idPedido, id_usuario_modificacion: baseline.idUsuario });
    expect(cancelled.estado).toBe('Cancelado');
  });

  it('no cancela un pedido que ya no esta Pendiente', async () => {
    const { idPedido } = await createOrderWithLines({
      idCliente: baseline.idCliente,
      idProducto: baseline.idProductoTerminado,
      idUsuarioCreacion: baseline.idUsuario,
    });
    await orderHandlers['orders.cancel']({ id: idPedido, id_usuario_modificacion: baseline.idUsuario });

    const result = await orderHandlers['orders.cancel']({ id: idPedido, id_usuario_modificacion: baseline.idUsuario });
    expect(result).toBeNull();
  });
});

describe('routes.create', () => {
  it('crea la ruta, pone el vehiculo En Ruta y los pedidos Preparado', async () => {
    const idVehiculo = await createVehicle();
    const idPiloto = await createPilot();
    const { idPedido } = await createOrderWithLines({
      idCliente: baseline.idCliente,
      idProducto: baseline.idProductoTerminado,
      idUsuarioCreacion: baseline.idUsuario,
    });

    const route = await routeHandlers['routes.create']({
      id_pedidos: [idPedido],
      id_vehiculo: idVehiculo,
      id_piloto: idPiloto,
      id_usuario_creacion: baseline.idUsuario,
    });

    expect(route.estado).toBe('Preparado');
    expect(route.manifiesto).toHaveLength(1);

    const [vehicleRows] = await pool.query('SELECT estado FROM vehiculos WHERE id_vehiculo = ?', [idVehiculo]);
    expect(vehicleRows[0].estado).toBe('En Ruta');

    const [orderRows] = await pool.query('SELECT estado FROM pedidos WHERE id_pedido = ?', [idPedido]);
    expect(orderRows[0].estado).toBe('Preparado');
  });

  it('rechaza si el vehiculo no esta Disponible', async () => {
    const idVehiculo = await createVehicle();
    await pool.query("UPDATE vehiculos SET estado = 'Mantenimiento' WHERE id_vehiculo = ?", [idVehiculo]);
    const idPiloto = await createPilot();
    const { idPedido } = await createOrderWithLines({
      idCliente: baseline.idCliente,
      idProducto: baseline.idProductoTerminado,
      idUsuarioCreacion: baseline.idUsuario,
    });

    await expect(
      routeHandlers['routes.create']({
        id_pedidos: [idPedido],
        id_vehiculo: idVehiculo,
        id_piloto: idPiloto,
        id_usuario_creacion: baseline.idUsuario,
      })
    ).rejects.toThrow(/debe estar Disponible/);
  });

  it('rechaza si el piloto ya tiene una ruta activa', async () => {
    const idVehiculo1 = await createVehicle();
    const idVehiculo2 = await createVehicle();
    const idPiloto = await createPilot();
    const order1 = await createOrderWithLines({
      idCliente: baseline.idCliente,
      idProducto: baseline.idProductoTerminado,
      idUsuarioCreacion: baseline.idUsuario,
    });
    const order2 = await createOrderWithLines({
      idCliente: baseline.idCliente,
      idProducto: baseline.idProductoTerminado,
      idUsuarioCreacion: baseline.idUsuario,
    });

    await routeHandlers['routes.create']({
      id_pedidos: [order1.idPedido],
      id_vehiculo: idVehiculo1,
      id_piloto: idPiloto,
      id_usuario_creacion: baseline.idUsuario,
    });

    await expect(
      routeHandlers['routes.create']({
        id_pedidos: [order2.idPedido],
        id_vehiculo: idVehiculo2,
        id_piloto: idPiloto,
        id_usuario_creacion: baseline.idUsuario,
      })
    ).rejects.toThrow(/ya tiene una ruta activa/);
  });

  it('rechaza si algun pedido no esta Pendiente', async () => {
    const idVehiculo = await createVehicle();
    const idPiloto = await createPilot();
    const { idPedido } = await createOrderWithLines({
      idCliente: baseline.idCliente,
      idProducto: baseline.idProductoTerminado,
      idUsuarioCreacion: baseline.idUsuario,
    });
    await orderHandlers['orders.cancel']({ id: idPedido, id_usuario_modificacion: baseline.idUsuario });

    await expect(
      routeHandlers['routes.create']({
        id_pedidos: [idPedido],
        id_vehiculo: idVehiculo,
        id_piloto: idPiloto,
        id_usuario_creacion: baseline.idUsuario,
      })
    ).rejects.toThrow(/deben estar Pendiente/);
  });
});

describe('flujo completo de ruta: salida, entregas y cierre', () => {
  const setupRouteWithTwoLines = async () => {
    const idVehiculo = await createVehicle();
    const idPiloto = await createPilot();
    const order1 = await createOrderWithLines({
      idCliente: baseline.idCliente,
      idProducto: baseline.idProductoTerminado,
      idUsuarioCreacion: baseline.idUsuario,
    });
    const order2 = await createOrderWithLines({
      idCliente: baseline.idCliente,
      idProducto: baseline.idProductoTerminado,
      idUsuarioCreacion: baseline.idUsuario,
    });

    const route = await routeHandlers['routes.create']({
      id_pedidos: [order1.idPedido, order2.idPedido],
      id_vehiculo: idVehiculo,
      id_piloto: idPiloto,
      id_usuario_creacion: baseline.idUsuario,
    });

    return { idVehiculo, idPiloto, order1, order2, route };
  };

  it('entrega completa: ambos pedidos quedan Entregado y el vehiculo vuelve a Disponible', async () => {
    const { idVehiculo, order1, order2, route } = await setupRouteWithTwoLines();

    await routeHandlers['routes.registrarSalida']({
      id: route.id_ruta,
      km_salida: 1000,
      galones_combustible: 10,
      id_usuario_modificacion: baseline.idUsuario,
    });

    await routeHandlers['routes.confirmarEntregas']({
      id: route.id_ruta,
      entregas: [
        { id_detalle: order1.idDetalle, cantidad_entregada: 5 },
        { id_detalle: order2.idDetalle, cantidad_entregada: 5 },
      ],
      id_usuario_modificacion: baseline.idUsuario,
    });

    await routeHandlers['routes.cerrar']({
      id: route.id_ruta,
      km_llegada: 1050,
      id_usuario_modificacion: baseline.idUsuario,
    });

    const [order1Rows] = await pool.query('SELECT estado FROM pedidos WHERE id_pedido = ?', [order1.idPedido]);
    const [order2Rows] = await pool.query('SELECT estado FROM pedidos WHERE id_pedido = ?', [order2.idPedido]);
    expect(order1Rows[0].estado).toBe('Entregado');
    expect(order2Rows[0].estado).toBe('Entregado');

    const [vehicleRows] = await pool.query('SELECT estado, kilometraje_actual FROM vehiculos WHERE id_vehiculo = ?', [
      idVehiculo,
    ]);
    expect(vehicleRows[0].estado).toBe('Disponible');
    expect(Number(vehicleRows[0].kilometraje_actual)).toBe(1050);

    const [mileageRows] = await pool.query('SELECT kilometraje_registrado FROM reporte_kilometraje_vehiculo WHERE id_vehiculo = ?', [
      idVehiculo,
    ]);
    expect(mileageRows).toHaveLength(1);
  });

  it('entrega parcial: el pedido con linea pendiente queda Con Devolucion', async () => {
    const { order1, order2, route } = await setupRouteWithTwoLines();

    await routeHandlers['routes.registrarSalida']({
      id: route.id_ruta,
      km_salida: 500,
      id_usuario_modificacion: baseline.idUsuario,
    });

    await routeHandlers['routes.confirmarEntregas']({
      id: route.id_ruta,
      entregas: [
        { id_detalle: order1.idDetalle, cantidad_entregada: 5 },
        { id_detalle: order2.idDetalle, cantidad_entregada: 0 },
      ],
      id_usuario_modificacion: baseline.idUsuario,
    });

    await routeHandlers['routes.cerrar']({ id: route.id_ruta, km_llegada: 520, id_usuario_modificacion: baseline.idUsuario });

    const [order1Rows] = await pool.query('SELECT estado FROM pedidos WHERE id_pedido = ?', [order1.idPedido]);
    const [order2Rows] = await pool.query('SELECT estado FROM pedidos WHERE id_pedido = ?', [order2.idPedido]);
    expect(order1Rows[0].estado).toBe('Entregado');
    expect(order2Rows[0].estado).toBe('Con Devolucion');
  });

  it('rechaza cerrar la ruta si km_llegada no es mayor a km_salida', async () => {
    const { route } = await setupRouteWithTwoLines();

    await routeHandlers['routes.registrarSalida']({
      id: route.id_ruta,
      km_salida: 1000,
      id_usuario_modificacion: baseline.idUsuario,
    });

    await expect(
      routeHandlers['routes.cerrar']({ id: route.id_ruta, km_llegada: 900, id_usuario_modificacion: baseline.idUsuario })
    ).rejects.toThrow(/km_llegada debe ser mayor a km_salida/);
  });
});

describe('routes.confirmarEntregas: bloqueo de lineas ya procesadas', () => {
  it('rechaza modificar una linea ya procesada si quien confirma no es administrador', async () => {
    const idVehiculo = await createVehicle();
    const idPiloto = await createPilot();
    const order = await createOrderWithLines({
      idCliente: baseline.idCliente,
      idProducto: baseline.idProductoTerminado,
      idUsuarioCreacion: baseline.idUsuario,
    });

    const route = await routeHandlers['routes.create']({
      id_pedidos: [order.idPedido],
      id_vehiculo: idVehiculo,
      id_piloto: idPiloto,
      id_usuario_creacion: baseline.idUsuario,
    });

    await routeHandlers['routes.registrarSalida']({
      id: route.id_ruta,
      km_salida: 100,
      id_usuario_modificacion: baseline.idUsuario,
    });

    await routeHandlers['routes.confirmarEntregas']({
      id: route.id_ruta,
      entregas: [{ id_detalle: order.idDetalle, cantidad_entregada: 5 }],
      id_usuario_modificacion: baseline.idUsuario,
      esAdministrador: false,
    });

    await expect(
      routeHandlers['routes.confirmarEntregas']({
        id: route.id_ruta,
        entregas: [{ id_detalle: order.idDetalle, cantidad_entregada: 0 }],
        id_usuario_modificacion: baseline.idUsuario,
        esAdministrador: false,
      })
    ).rejects.toThrow(/solo un administrador puede modificarla/);

    const [detailRows] = await pool.query('SELECT estado_entrega, cantidad_entregada FROM pedido_detalle WHERE id_detalle = ?', [
      order.idDetalle,
    ]);
    expect(detailRows[0].estado_entrega).toBe('Entregado');
    expect(Number(detailRows[0].cantidad_entregada)).toBe(5);
  });

  it('permite que un administrador corrija una linea ya procesada', async () => {
    const idVehiculo = await createVehicle();
    const idPiloto = await createPilot();
    const order = await createOrderWithLines({
      idCliente: baseline.idCliente,
      idProducto: baseline.idProductoTerminado,
      idUsuarioCreacion: baseline.idUsuario,
      cantidad: 8,
    });

    const route = await routeHandlers['routes.create']({
      id_pedidos: [order.idPedido],
      id_vehiculo: idVehiculo,
      id_piloto: idPiloto,
      id_usuario_creacion: baseline.idUsuario,
    });

    await routeHandlers['routes.registrarSalida']({
      id: route.id_ruta,
      km_salida: 100,
      id_usuario_modificacion: baseline.idUsuario,
    });

    await routeHandlers['routes.confirmarEntregas']({
      id: route.id_ruta,
      entregas: [{ id_detalle: order.idDetalle, cantidad_entregada: 8 }],
      id_usuario_modificacion: baseline.idUsuario,
      esAdministrador: false,
    });

    await routeHandlers['routes.confirmarEntregas']({
      id: route.id_ruta,
      entregas: [{ id_detalle: order.idDetalle, cantidad_entregada: 3 }],
      id_usuario_modificacion: baseline.idUsuario,
      esAdministrador: true,
    });

    const [detailRows] = await pool.query('SELECT estado_entrega, cantidad_entregada FROM pedido_detalle WHERE id_detalle = ?', [
      order.idDetalle,
    ]);
    expect(detailRows[0].estado_entrega).toBe('Parcial');
    expect(Number(detailRows[0].cantidad_entregada)).toBe(3);
  });
});

describe('devoluciones', () => {
  const setupConDevolucion = async () => {
    const idVehiculo = await createVehicle();
    const idPiloto = await createPilot();
    const order = await createOrderWithLines({
      idCliente: baseline.idCliente,
      idProducto: baseline.idProductoTerminado,
      idUsuarioCreacion: baseline.idUsuario,
      cantidad: 7,
    });

    const route = await routeHandlers['routes.create']({
      id_pedidos: [order.idPedido],
      id_vehiculo: idVehiculo,
      id_piloto: idPiloto,
      id_usuario_creacion: baseline.idUsuario,
    });

    await routeHandlers['routes.registrarSalida']({ id: route.id_ruta, km_salida: 100, id_usuario_modificacion: baseline.idUsuario });
    await routeHandlers['routes.confirmarEntregas']({
      id: route.id_ruta,
      entregas: [{ id_detalle: order.idDetalle, cantidad_entregada: 0 }],
      id_usuario_modificacion: baseline.idUsuario,
    });
    await routeHandlers['routes.cerrar']({ id: route.id_ruta, km_llegada: 130, id_usuario_modificacion: baseline.idUsuario });

    return order;
  };

  it('al reingresar, el movimiento de entrada vuelve al mismo lote (id_existencia) del que salio la venta', async () => {
    const idExistencia = await createFinishedProductStock({ idProducto: baseline.idProductoTerminado, cantidad: 7 });
    const idVehiculo = await createVehicle();
    const idPiloto = await createPilot();

    const order = await orderHandlers['orders.create']({
      id_cliente: baseline.idCliente,
      observaciones: null,
      id_usuario_creacion: baseline.idUsuario,
      lineas: [{ id_producto: baseline.idProductoTerminado, cantidad: 7, id_existencia: idExistencia }],
    });
    const idDetalle = order.lineas[0].id_detalle;

    const route = await routeHandlers['routes.create']({
      id_pedidos: [order.id_pedido],
      id_vehiculo: idVehiculo,
      id_piloto: idPiloto,
      id_usuario_creacion: baseline.idUsuario,
    });

    await routeHandlers['routes.registrarSalida']({ id: route.id_ruta, km_salida: 100, id_usuario_modificacion: baseline.idUsuario });
    await routeHandlers['routes.confirmarEntregas']({
      id: route.id_ruta,
      entregas: [{ id_detalle: idDetalle, cantidad_entregada: 0 }],
      id_usuario_modificacion: baseline.idUsuario,
    });
    await routeHandlers['routes.cerrar']({ id: route.id_ruta, km_llegada: 130, id_usuario_modificacion: baseline.idUsuario });

    const created = await returnHandlers['orderReturns.create']({
      id_detalle: idDetalle,
      cantidad_devuelta: 7,
      id_usuario_recepcion: baseline.idUsuario,
    });

    await returnHandlers['orderReturns.resolve']({
      id: created.id_devolucion,
      resolucion: 'Reingresado a inventario',
      id_usuario_resolucion: baseline.idUsuario,
    });

    const [movementRows] = await pool.query(
      "SELECT id_existencia, cantidad FROM movimientos_inventario WHERE motivo = ?",
      [`Reingreso por devolucion #${created.id_devolucion}`]
    );
    expect(movementRows).toHaveLength(1);
    expect(movementRows[0].id_existencia).toBe(idExistencia);
    expect(Number(movementRows[0].cantidad)).toBe(7);
  });

  it('recibe la devolucion y la resuelve como Reingresado, creando el movimiento de entrada', async () => {
    const order = await setupConDevolucion();

    const created = await returnHandlers['orderReturns.create']({
      id_detalle: order.idDetalle,
      cantidad_devuelta: 7,
      motivo: 'Cliente rechazo el pedido',
      id_usuario_recepcion: baseline.idUsuario,
    });

    expect(created.resolucion).toBe('Pendiente de revision');

    const [detailRows] = await pool.query('SELECT estado_entrega FROM pedido_detalle WHERE id_detalle = ?', [order.idDetalle]);
    expect(detailRows[0].estado_entrega).toBe('Devuelto');

    const resolved = await returnHandlers['orderReturns.resolve']({
      id: created.id_devolucion,
      resolucion: 'Reingresado a inventario',
      id_usuario_resolucion: baseline.idUsuario,
    });

    expect(resolved.resolucion).toBe('Reingresado a inventario');

    const [movementRows] = await pool.query(
      "SELECT cantidad FROM movimientos_inventario WHERE motivo = ?",
      [`Reingreso por devolucion #${created.id_devolucion}`]
    );
    expect(movementRows).toHaveLength(1);
    expect(Number(movementRows[0].cantidad)).toBe(7);
  });

  it('rechaza resolver dos veces la misma devolucion', async () => {
    const order = await setupConDevolucion();
    const created = await returnHandlers['orderReturns.create']({
      id_detalle: order.idDetalle,
      cantidad_devuelta: 7,
      id_usuario_recepcion: baseline.idUsuario,
    });

    await returnHandlers['orderReturns.resolve']({
      id: created.id_devolucion,
      resolucion: 'Perdida',
      id_usuario_resolucion: baseline.idUsuario,
    });

    await expect(
      returnHandlers['orderReturns.resolve']({
        id: created.id_devolucion,
        resolucion: 'Reingresado a inventario',
        id_usuario_resolucion: baseline.idUsuario,
      })
    ).rejects.toThrow(/ya fue resuelta/);
  });
});

describe('orders.reportPedidosDelDia', () => {
  const setupClosedRoute = async ({ cantidadEntregada }) => {
    const idVehiculo = await createVehicle();
    const idPiloto = await createPilot();
    const order = await createOrderWithLines({
      idCliente: baseline.idCliente,
      idProducto: baseline.idProductoTerminado,
      idUsuarioCreacion: baseline.idUsuario,
      cantidad: 5,
    });

    const route = await routeHandlers['routes.create']({
      id_pedidos: [order.idPedido],
      id_vehiculo: idVehiculo,
      id_piloto: idPiloto,
      id_usuario_creacion: baseline.idUsuario,
    });

    await routeHandlers['routes.registrarSalida']({
      id: route.id_ruta,
      km_salida: 10,
      id_usuario_modificacion: baseline.idUsuario,
    });

    await routeHandlers['routes.confirmarEntregas']({
      id: route.id_ruta,
      entregas: [{ id_detalle: order.idDetalle, cantidad_entregada: cantidadEntregada }],
      id_usuario_modificacion: baseline.idUsuario,
      esAdministrador: true,
    });

    await routeHandlers['routes.cerrar']({
      id: route.id_ruta,
      km_llegada: 30,
      id_usuario_modificacion: baseline.idUsuario,
    });

    return order;
  };

  it('cerrar la ruta guarda fecha_entrega en el pedido', async () => {
    const order = await setupClosedRoute({ cantidadEntregada: 5 });

    const [rows] = await pool.query('SELECT estado, fecha_entrega FROM pedidos WHERE id_pedido = ?', [order.idPedido]);
    expect(rows[0].estado).toBe('Entregado');
    expect(rows[0].fecha_entrega).not.toBeNull();
  });

  it('cuenta pendientes por fecha de creacion y entregados/con devolucion por fecha_entrega', async () => {
    await createOrderWithLines({
      idCliente: baseline.idCliente,
      idProducto: baseline.idProductoTerminado,
      idUsuarioCreacion: baseline.idUsuario,
    });

    await setupClosedRoute({ cantidadEntregada: 5 });
    await setupClosedRoute({ cantidadEntregada: 0 });

    const report = await orderHandlers['orders.reportPedidosDelDia']({});

    expect(report.pendientes).toBe(1);
    expect(report.entregados).toBe(1);
    expect(report.con_devolucion).toBe(1);
  });

  it('acepta una fecha explicita y no cuenta pedidos de otro dia', async () => {
    await setupClosedRoute({ cantidadEntregada: 5 });

    const report = await orderHandlers['orders.reportPedidosDelDia']({ fecha: '2000-01-01' });

    expect(report.pendientes).toBe(0);
    expect(report.entregados).toBe(0);
    expect(report.con_devolucion).toBe(0);
  });
});
