const { Router } = require('express');
const traceabilityController = require('../controllers/traceability.controller');

const router = Router();

/**
 * @swagger
 * /api/trazabilidad:
 *   get:
 *     summary: Arma el arbol de trazabilidad completo, de inicio a fin, de un lote/sublote/proceso/red/existencia
 *     description: Se debe pasar `codigo` (codigo de lote), o `tipo` + `id`.
 *     tags: [Trazabilidad]
 *     parameters:
 *       - in: query
 *         name: codigo
 *         required: false
 *         schema: { type: string }
 *       - in: query
 *         name: tipo
 *         required: false
 *         schema: { type: string, enum: [entrada, lote, sublote, proceso, red, existencia, movimiento] }
 *       - in: query
 *         name: id
 *         required: false
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Arbol de trazabilidad (raiz) o existencia_huerfana si no tiene origen vinculado
 *       400:
 *         description: Falta codigo o tipo+id, o tipo invalido
 *       404:
 *         description: No existe ninguna entrada/registro con ese codigo o id
 */
router.get('/', traceabilityController.getTrace);

/**
 * @swagger
 * /api/trazabilidad/buscar:
 *   get:
 *     summary: Busca coincidencias de trazabilidad por texto o numero
 *     tags: [Trazabilidad]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *         description: Codigo de lote (coincidencia exacta) o un numero (busca por id en varios tipos).
 *     responses:
 *       200:
 *         description: Lista de coincidencias (tipo + id + etiqueta)
 *       400:
 *         description: Falta el termino de busqueda
 */
router.get('/buscar', traceabilityController.getSearch);

/**
 * @swagger
 * /api/trazabilidad/filtrar:
 *   get:
 *     summary: Filtra elementos de trazabilidad por area (y opcionalmente rango de fechas)
 *     tags: [Trazabilidad]
 *     parameters:
 *       - in: query
 *         name: areas
 *         required: true
 *         schema: { type: string }
 *         description: Una o varias areas separadas por coma.
 *         example: produccion,redes
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
 *         description: Lista de elementos encontrados en esas areas
 *       400:
 *         description: area invalida (validas - maduracion, produccion, redes, inventario, pedidos)
 */
router.get('/filtrar', traceabilityController.getFilteredSearch);

module.exports = router;
