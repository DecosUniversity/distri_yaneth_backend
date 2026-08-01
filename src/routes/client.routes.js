const { Router } = require('express');
const clientController = require('../controllers/client.controller');

const router = Router();

router.get('/', clientController.getClients);
router.get('/:id', clientController.getClientById);
router.post('/', clientController.createClient);
router.put('/:id', clientController.updateClient);
router.delete('/:id', clientController.deleteClient);

module.exports = router;
