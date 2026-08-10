const { Router } = require('express');
const maturationController = require('../controllers/maturation.controller');

const router = Router();

router.get('/lotes', maturationController.getLotes);
router.get('/lotes/:id', maturationController.getLoteById);
router.post('/lotes', maturationController.createLote);
router.put('/lotes/:id', maturationController.updateLote);
router.delete('/lotes/:id', maturationController.deleteLote);
router.post('/lotes/:id/aceptar', maturationController.acceptLote);

router.get('/sublotes', maturationController.getSublotes);
router.get('/sublotes/listos-para-produccion', maturationController.getSublotesListosParaProduccion);
router.get('/sublotes/lote/:id_lote_mp', maturationController.getSublotesByLote);
router.get('/sublotes/:id', maturationController.getSubloteById);
router.post('/sublotes/:id/fraccionar', maturationController.splitSublote);
router.post('/sublotes/:id/cerrar', maturationController.closeSublote);

router.get('/controles', maturationController.getControles);
router.get('/controles/sublote/:id_sublote', maturationController.getControlesBySublote);
router.post('/controles', maturationController.createControl);
router.delete('/controles/:id', maturationController.deleteControl);

module.exports = router;
