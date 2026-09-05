const { Router } = require('express');
const traceabilityController = require('../controllers/traceability.controller');

const router = Router();

router.get('/', traceabilityController.getTrace);
router.get('/buscar', traceabilityController.getSearch);
router.get('/filtrar', traceabilityController.getFilteredSearch);

module.exports = router;
