const { Router } = require('express');
const inventoryController = require('../controllers/inventory.controller');

const router = Router();

/**
 * @swagger
 * /api/inventario:
 *   get:
 *     summary: Lista el inventario con stock neto calculado (incluye sub-lotes activos)
 *     tags: [Inventario]
 *     responses:
 *       200:
 *         description: Lista de inventario
 */
router.get('/', inventoryController.getInventory);

/**
 * @swagger
 * /api/inventario/existencias:
 *   get:
 *     summary: Lista las existencias de inventario de un producto
 *     tags: [Inventario]
 *     parameters:
 *       - in: query
 *         name: id_producto
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista de existencias del producto
 *       400:
 *         description: id_producto es obligatorio
 */
router.get('/existencias', inventoryController.getExistenciasByProduct);

/**
 * @swagger
 * /api/inventario/caducidad:
 *   get:
 *     summary: Indicador de caducidad (existencias en riesgo y perdida por vencimiento por mes)
 *     tags: [Inventario]
 *     parameters:
 *       - in: query
 *         name: meses
 *         required: false
 *         schema: { type: integer, minimum: 1, maximum: 24, default: 6 }
 *         description: Meses hacia atras para la perdida por caducidad (incluye el mes en curso)
 *     responses:
 *       200:
 *         description: Resumen de vencidos y por vencer, existencias en riesgo y perdida mensual y por producto
 *       400:
 *         description: meses fuera de rango
 */
router.get('/caducidad', inventoryController.getExpirationReport);

/**
 * @swagger
 * /api/inventario/existencias/{id}/baja-vencimiento:
 *   post:
 *     summary: Da de baja todo el saldo de una existencia vencida (movimiento Desperdicio)
 *     tags: [Inventario]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Baja registrada
 *       400:
 *         description: La existencia no esta vencida o no tiene stock
 *       404:
 *         description: Existencia no encontrada
 */
router.post('/existencias/:id/baja-vencimiento', inventoryController.writeOffExpired);

module.exports = router;
