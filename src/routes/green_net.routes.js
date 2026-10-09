const { Router } = require('express');
const greenNetController = require('../controllers/green_net.controller');

const router = Router();

/**
 * @swagger
 * /api/redes-verdes:
 *   get:
 *     summary: Lista el historico de cajas de red empacadas
 *     description: >
 *       Solo lectura: el empaque de redes se estandarizo dentro de Produccion
 *       (POST /api/produccion/procesos + /etapas con `cajas`). Este endpoint solo sirve para
 *       consultar las cajas registradas antes de ese cambio.
 *     tags: [Redes Verdes]
 *     responses:
 *       200:
 *         description: Lista de cajas de red (historico)
 */
router.get('/', greenNetController.getRedes);

/**
 * @swagger
 * /api/redes-verdes/sublote/{id_sublote}:
 *   get:
 *     summary: Lista las cajas de red historicas de un sub-lote
 *     tags: [Redes Verdes]
 *     parameters:
 *       - in: path
 *         name: id_sublote
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista de cajas del sub-lote
 */
router.get('/sublote/:id_sublote', greenNetController.getRedesBySublote);

module.exports = router;
