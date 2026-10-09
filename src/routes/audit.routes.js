const { Router } = require('express');
const auditController = require('../controllers/audit.controller');

const router = Router();

/**
 * @swagger
 * /api/auditoria:
 *   get:
 *     summary: Lista el historial de auditoria (creaciones, actualizaciones, eliminaciones)
 *     tags: [Auditoria]
 *     parameters:
 *       - in: query
 *         name: tabla
 *         required: false
 *         schema: { type: string }
 *         description: Filtra por tabla afectada.
 *       - in: query
 *         name: id
 *         required: false
 *         schema: { type: string }
 *         description: Filtra por id de registro afectado.
 *     responses:
 *       200:
 *         description: Lista de registros de auditoria
 */
router.get('/', auditController.getAuditRecords);

/**
 * @swagger
 * /api/auditoria/tablas:
 *   get:
 *     summary: Lista las tablas que tienen registros de auditoria
 *     tags: [Auditoria]
 *     responses:
 *       200:
 *         description: Lista de nombres de tabla
 */
router.get('/tablas', auditController.getAuditTables);

module.exports = router;
