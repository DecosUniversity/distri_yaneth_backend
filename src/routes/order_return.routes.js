const { Router } = require('express');
const orderReturnController = require('../controllers/order_return.controller');
const { authorizeRoles } = require('../middlewares/auth.middleware');

const router = Router();

// El piloto solo deja el producto marcado como Parcial/Rechazado durante la confirmacion
// de entregas (routes.confirmarEntregas); eso ya lo pone en la cola de pendientes-recepcion
// automaticamente. La recepcion fisica en bodega (el producto sigue siendo responsabilidad
// del piloto hasta que la entrega alguien en bodega) la hace Administrador o Logistica;
// la resolucion (reingreso o perdida) la decide Produccion (evalua si sigue vendible) o Administrador.

/**
 * @swagger
 * /api/devoluciones:
 *   get:
 *     summary: Lista las devoluciones
 *     tags: [Devoluciones]
 *     responses:
 *       200:
 *         description: Lista de devoluciones
 */
router.get('/', orderReturnController.getDevoluciones);

/**
 * @swagger
 * /api/devoluciones/pendientes-revision:
 *   get:
 *     summary: Lista las devoluciones recibidas pendientes de resolucion
 *     tags: [Devoluciones]
 *     responses:
 *       200:
 *         description: Lista de devoluciones pendientes de resolucion
 */
router.get('/pendientes-revision', orderReturnController.getDevolucionesPendientesRevision);

/**
 * @swagger
 * /api/devoluciones/pendientes-recepcion:
 *   get:
 *     summary: Lista las lineas de pedido marcadas Parcial/Rechazado, pendientes de recepcion fisica
 *     tags: [Devoluciones]
 *     responses:
 *       200:
 *         description: Lista de lineas pendientes de recepcion
 */
router.get('/pendientes-recepcion', orderReturnController.getLineasPendientesRecepcion);

/**
 * @swagger
 * /api/devoluciones:
 *   post:
 *     summary: Recibe fisicamente una devolucion (bodega)
 *     description: Solo Administrador o Logistica.
 *     tags: [Devoluciones]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id_detalle]
 *             properties:
 *               id_detalle: { type: integer }
 *               cantidad_devuelta: { type: number, nullable: true }
 *               motivo: { type: string }
 *     responses:
 *       201:
 *         description: Devolucion recibida
 *       400:
 *         description: Datos invalidos
 *       403:
 *         description: No autorizado para este rol
 */
router.post('/', authorizeRoles('Administrador', 'Logistica'), orderReturnController.createDevolucion);

/**
 * @swagger
 * /api/devoluciones/{id}/resolver:
 *   put:
 *     summary: Resuelve una devolucion recibida (reingreso a inventario o perdida)
 *     description: Administrador, Logistica o Produccion.
 *     tags: [Devoluciones]
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
 *             required: [resolucion]
 *             properties:
 *               resolucion: { type: string, enum: ['Reingresado a inventario', 'Perdida'] }
 *     responses:
 *       200:
 *         description: Devolucion resuelta
 *       400:
 *         description: resolucion invalida
 *       403:
 *         description: No autorizado para este rol
 */
router.put(
  '/:id/resolver',
  authorizeRoles('Administrador', 'Logistica', 'Produccion'),
  orderReturnController.resolverDevolucion
);

module.exports = router;
