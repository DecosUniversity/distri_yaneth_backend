const { Router } = require('express');
const inventoryController = require('../controllers/inventory.controller');

const router = Router();

router.get('/', inventoryController.getInventory);

module.exports = router;