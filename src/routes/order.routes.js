const { Router } = require('express');
const orderController = require('../controllers/order.controller');

const router = Router();

/**
 * @swagger
 * /api/pedidos/reportes/mas-vendidos:
 *   get:
 *     summary: Reporte de productos mas vendidos
 *     tags: [Pedidos]
 *     responses:
 *       200:
 *         description: Lista de productos mas vendidos
 */
router.get('/reportes/mas-vendidos', orderController.getReporteProductosMasVendidos);

/**
 * @swagger
 * /api/pedidos/reportes/mejores-clientes:
 *   get:
 *     summary: Reporte de mejores clientes por volumen de pedidos
 *     tags: [Pedidos]
 *     responses:
 *       200:
 *         description: Lista de mejores clientes
 */
router.get('/reportes/mejores-clientes', orderController.getReporteMejoresClientes);

/**
 * @swagger
 * /api/pedidos/reportes/pedidos-del-dia:
 *   get:
 *     summary: Reporte de pedidos pendientes/entregados/con devolucion del dia
 *     tags: [Pedidos]
 *     parameters:
 *       - in: query
 *         name: fecha
 *         required: false
 *         schema: { type: string, format: date }
 *         description: Fecha a consultar (DD-MM-YYYY). Por defecto, hoy.
 *     responses:
 *       200:
 *         description: Reporte del dia
 *       400:
 *         description: Formato de fecha invalido
 */
router.get('/reportes/pedidos-del-dia', orderController.getReportePedidosDelDia);

/**
 * @swagger
 * /api/pedidos/reportes/compras-por-cliente:
 *   get:
 *     summary: Reporte de compras (cantidad x precio_unitario congelado) agrupadas por cliente
 *     description: >
 *       precio_unitario es el precio congelado al crear cada linea de pedido, no el precio
 *       actual del producto. Pedidos creados antes de que existiera esa columna no aportan valor.
 *     tags: [Pedidos]
 *     parameters:
 *       - in: query
 *         name: desde
 *         required: false
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: hasta
 *         required: false
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Lista de clientes con su total de compras en el rango
 *       400:
 *         description: Formato de fecha invalido
 */
router.get('/reportes/compras-por-cliente', orderController.getReporteComprasPorCliente);

/**
 * @swagger
 * /api/pedidos/reportes/compras-por-producto:
 *   get:
 *     summary: Reporte de compras (cantidad x precio_unitario congelado) agrupadas por producto
 *     tags: [Pedidos]
 *     parameters:
 *       - in: query
 *         name: desde
 *         required: false
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: hasta
 *         required: false
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: id_cliente
 *         required: false
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista de productos con su total de compras en el rango
 *       400:
 *         description: Formato de fecha o id_cliente invalido
 */
router.get('/reportes/compras-por-producto', orderController.getReporteComprasPorProducto);

/**
 * @swagger
 * /api/pedidos:
 *   get:
 *     summary: Lista los pedidos
 *     tags: [Pedidos]
 *     responses:
 *       200:
 *         description: Lista de pedidos
 */
router.get('/', orderController.getPedidos);

/**
 * @swagger
 * /api/pedidos/{id}:
 *   get:
 *     summary: Obtiene un pedido por id (con sus lineas)
 *     tags: [Pedidos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Pedido encontrado
 *       404:
 *         description: No encontrado
 */
router.get('/:id', orderController.getPedidoById);

/**
 * @swagger
 * /api/pedidos:
 *   post:
 *     summary: Crea un pedido (lista de despacho por cliente)
 *     description: Reserva/descuenta inventario disponible por cada linea. No genera facturacion.
 *     tags: [Pedidos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id_cliente, lineas]
 *             properties:
 *               id_cliente: { type: integer }
 *               observaciones: { type: string }
 *               fecha_entrega_programada: { type: string, format: date }
 *               lineas:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [id_producto, cantidad]
 *                   properties:
 *                     id_producto: { type: integer }
 *                     cantidad: { type: number }
 *                     id_existencia: { type: integer, nullable: true }
 *     responses:
 *       201:
 *         description: Pedido creado
 *       400:
 *         description: Datos invalidos, o no hay inventario disponible suficiente
 *       404:
 *         description: Cliente no encontrado
 */
router.post('/', orderController.createPedido);

/**
 * @swagger
 * /api/pedidos/{id}/cancelar:
 *   put:
 *     summary: Cancela un pedido
 *     tags: [Pedidos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Pedido cancelado
 *       404:
 *         description: No encontrado
 */
router.put('/:id/cancelar', orderController.cancelPedido);

/**
 * @swagger
 * /api/pedidos/{id}/fecha-entrega:
 *   put:
 *     summary: Asigna o cambia la fecha de entrega programada de un pedido
 *     tags: [Pedidos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fecha_entrega_programada]
 *             properties:
 *               fecha_entrega_programada: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Fecha actualizada
 *       400:
 *         description: Formato de fecha invalido
 *       404:
 *         description: Pedido no encontrado
 */
router.put('/:id/fecha-entrega', orderController.updateFechaEntregaProgramada);

module.exports = router;
