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

module.exports = router;
