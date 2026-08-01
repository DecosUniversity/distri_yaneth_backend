const { Router } = require('express');
const vehicleController = require('../controllers/vehicle.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');

const router = Router();

router.get(
	'/',
	authenticateToken,
	authorizeRoles('Administrador', 'Logistica', 'Piloto'),
	vehicleController.getVehicles
);
router.get(
	'/:id',
	authenticateToken,
	authorizeRoles('Administrador', 'Logistica', 'Piloto'),
	vehicleController.getVehicleById
);
router.post(
	'/',
	authenticateToken,
	authorizeRoles('Administrador', 'Logistica'),
	vehicleController.createVehicle
);
router.put(
	'/:id',
	authenticateToken,
	authorizeRoles('Administrador', 'Logistica', 'Piloto'),
	vehicleController.updateVehicle
);
router.delete(
	'/:id',
	authenticateToken,
	authorizeRoles('Administrador', 'Logistica'),
	vehicleController.deleteVehicle
);

module.exports = router;
