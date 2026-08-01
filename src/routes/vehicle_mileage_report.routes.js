const { Router } = require('express');
const vehicleMileageReportController = require('../controllers/vehicle_mileage_report.controller');

const router = Router();

router.get('/', vehicleMileageReportController.getMileageReports);

module.exports = router;