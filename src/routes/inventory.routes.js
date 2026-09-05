const { Router } = require('express');
const inventoryController = require('../controllers/inventory.controller');

const router = Router();

router.get('/', inventoryController.getInventory);
router.get('/existencias', inventoryController.getExistenciasByProduct);

module.exports = router;