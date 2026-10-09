const { Router } = require('express');
const vehicleMileageReportController = require('../controllers/vehicle_mileage_report.controller');

const router = Router();

/**
 * @swagger
 * /api/reporte-kilometraje-vehiculo:
 *   get:
 *     summary: Reporte de kilometraje recorrido por vehiculo
 *     tags: [Reporte Kilometraje Vehiculo]
 *     responses:
 *       200:
 *         description: Lista del reporte de kilometraje
 */
router.get('/', vehicleMileageReportController.getMileageReports);

module.exports = router;
