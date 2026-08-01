const { Router } = require('express');
const providerController = require('../controllers/provider.controller');

const router = Router();

router.get('/', providerController.getProviders);
router.get('/:id', providerController.getProviderById);
router.post('/', providerController.createProvider);
router.put('/:id', providerController.updateProvider);
router.delete('/:id', providerController.deleteProvider);

module.exports = router;
