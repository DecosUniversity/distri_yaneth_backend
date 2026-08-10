const { Router } = require('express');
const productionController = require('../controllers/production.controller');
const mermaTypeController = require('../controllers/merma_type.controller');

const router = Router();

router.get('/tipos-merma', mermaTypeController.getMermaTypes);

router.get('/procesos', productionController.getProcesos);
router.get('/procesos/:id', productionController.getProcesoById);
router.post('/procesos', productionController.createProceso);
router.post('/procesos/:id/etapas', productionController.addEtapa);
router.post('/procesos/:id/mermas', productionController.addMerma);
router.post('/procesos/:id/insumos', productionController.addInsumo);
router.post('/procesos/:id/cuarto-frio', productionController.addColdRoomEntry);
router.post('/procesos/:id/finalizar', productionController.finalizeProceso);
router.delete('/procesos/:id', productionController.deleteProceso);

module.exports = router;
