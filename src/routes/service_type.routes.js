const { Router } = require('express');
const serviceTypeController = require('../controllers/service_type.controller');

const router = Router();

router.get('/', serviceTypeController.getServiceTypes);
router.get('/:id', serviceTypeController.getServiceTypeById);
router.post('/', serviceTypeController.createServiceType);
router.put('/:id', serviceTypeController.updateServiceType);
router.delete('/:id', serviceTypeController.deleteServiceType);

module.exports = router;
