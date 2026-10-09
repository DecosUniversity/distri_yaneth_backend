const { Router } = require('express');
const entradasMercanciaController = require('../controllers/entradas_mercancia.controller');

const router = Router();

/**
 * @swagger
 * /api/entradas-mercancia:
 *   get:
 *     summary: Lista las entradas de mercancia
 *     tags: [Entradas de Mercancia]
 *     responses:
 *       200:
 *         description: Lista de entradas
 */
router.get('/', entradasMercanciaController.getEntradasMercancia);

/**
 * @swagger
 * /api/entradas-mercancia/existencias:
 *   get:
 *     summary: Lista las existencias de inventario generadas por entradas
 *     tags: [Entradas de Mercancia]
 *     responses:
 *       200:
 *         description: Lista de existencias
 */
router.get('/existencias', entradasMercanciaController.getInventarioExistencias);

/**
 * @swagger
 * /api/entradas-mercancia/movimientos:
 *   get:
 *     summary: Lista los movimientos de inventario
 *     tags: [Entradas de Mercancia]
 *     responses:
 *       200:
 *         description: Lista de movimientos
 */
router.get('/movimientos', entradasMercanciaController.getMovimientosInventario);

/**
 * @swagger
 * /api/entradas-mercancia/{id}:
 *   get:
 *     summary: Obtiene una entrada de mercancia por id
 *     tags: [Entradas de Mercancia]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Entrada encontrada
 *       404:
 *         description: No encontrada
 */
router.get('/:id', entradasMercanciaController.getEntradaMercanciaById);

/**
 * @swagger
 * /api/entradas-mercancia:
 *   post:
 *     summary: Registra una entrada de mercancia (Materia Prima o Insumo)
 *     description: Genera un codigo de lote y crea/actualiza la existencia de inventario correspondiente.
 *     tags: [Entradas de Mercancia]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id_proveedor, id_producto, fecha_vencimiento, cantidad_disponible]
 *             properties:
 *               id_proveedor: { type: integer }
 *               id_producto: { type: integer }
 *               fecha_vencimiento: { type: string, format: date }
 *               cantidad_disponible: { type: number }
 *               costo_unitario: { type: number }
 *               documento_referencia: { type: string }
 *               unidades:
 *                 type: array
 *                 description: Opcional, desglose de pesos por unidad individual.
 *                 items:
 *                   type: object
 *                   properties:
 *                     unidad_codigo: { type: string }
 *                     peso: { type: number }
 *     responses:
 *       201:
 *         description: Entrada creada
 *       400:
 *         description: Datos invalidos, o el producto no es Materia Prima ni Insumo
 *       404:
 *         description: Proveedor o producto no encontrado
 */
router.post('/', entradasMercanciaController.createEntradaMercancia);

/**
 * @swagger
 * /api/entradas-mercancia/{id}/units:
 *   get:
 *     summary: Lista las unidades individuales pesadas de una entrada
 *     tags: [Entradas de Mercancia]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista de unidades
 */
router.get('/:id/units', entradasMercanciaController.getUnitsByEntrada);

/**
 * @swagger
 * /api/entradas-mercancia/{id}/units:
 *   post:
 *     summary: Registra una unidad individual pesada para una entrada
 *     tags: [Entradas de Mercancia]
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
 *             required: [peso]
 *             properties:
 *               unidad_codigo: { type: string }
 *               peso: { type: number }
 *               fecha_pesos: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: Unidad registrada
 *       404:
 *         description: Entrada no encontrada
 */
router.post('/:id/units', entradasMercanciaController.createUnitForEntrada);

/**
 * @swagger
 * /api/entradas-mercancia/units/{unitId}:
 *   delete:
 *     summary: Elimina una unidad individual registrada
 *     tags: [Entradas de Mercancia]
 *     parameters:
 *       - in: path
 *         name: unitId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Unidad eliminada
 *       404:
 *         description: No encontrada
 */
router.delete('/units/:unitId', entradasMercanciaController.deleteUnit);

/**
 * @swagger
 * /api/entradas-mercancia/{id}:
 *   delete:
 *     summary: Elimina una entrada de mercancia
 *     tags: [Entradas de Mercancia]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Entrada eliminada
 *       404:
 *         description: No encontrada
 */
router.delete('/:id', entradasMercanciaController.deleteEntradaMercancia);

module.exports = router;
