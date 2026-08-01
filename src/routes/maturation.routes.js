const { Router } = require('express');
const maturationController = require('../controllers/maturation.controller');

const router = Router();

router.get('/lotes', maturationController.getLotes);
router.get('/lotes/:id', maturationController.getLoteById);
router.post('/lotes', maturationController.createLote);
router.put('/lotes/:id', maturationController.updateLote);
router.delete('/lotes/:id', maturationController.deleteLote);

router.get('/controles', maturationController.getControles);
router.get('/controles/lote/:id_lote_mp', maturationController.getControlesByLote);
router.post('/controles', maturationController.createControl);
router.delete('/controles/:id', maturationController.deleteControl);

module.exports = router;
