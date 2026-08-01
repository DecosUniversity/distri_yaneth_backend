const { Router } = require('express');
const vehicleServiceController = require('../controllers/vehicle_service.controller');

const router = Router();

router.get('/', vehicleServiceController.getVehicleServices);
router.get('/:id', vehicleServiceController.getVehicleServiceById);
router.post('/', vehicleServiceController.createVehicleService);
router.put('/:id', vehicleServiceController.updateVehicleService);
router.delete('/:id', vehicleServiceController.deleteVehicleService);

module.exports = router;