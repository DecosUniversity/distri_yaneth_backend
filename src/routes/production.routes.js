const { Router } = require('express');
const productionController = require('../controllers/production.controller');
const mermaTypeController = require('../controllers/merma_type.controller');
const stageTypeController = require('../controllers/stage_type.controller');
const productionOrderController = require('../controllers/production_order.controller');

const router = Router();

router.get('/tipos-merma', mermaTypeController.getMermaTypes);
router.get('/tipos-merma/:id', mermaTypeController.getMermaTypeById);
router.post('/tipos-merma', mermaTypeController.createMermaType);
router.put('/tipos-merma/:id', mermaTypeController.updateMermaType);
router.delete('/tipos-merma/:id', mermaTypeController.deleteMermaType);

router.get('/tipos-etapa', stageTypeController.getStageTypes);
router.get('/tipos-etapa/:id', stageTypeController.getStageTypeById);
router.post('/tipos-etapa', stageTypeController.createStageType);
router.put('/tipos-etapa/:id', stageTypeController.updateStageType);
router.delete('/tipos-etapa/:id', stageTypeController.deleteStageType);

router.get('/ordenes', productionOrderController.getProductionOrders);
router.get('/ordenes/:id', productionOrderController.getProductionOrderById);
router.post('/ordenes', productionOrderController.createProductionOrder);
router.put('/ordenes/:id/cancelar', productionOrderController.cancelProductionOrder);

router.get('/reportes/mermas-por-categoria', productionController.getReporteMermasPorCategoria);
router.get('/reportes/produccion-por-producto', productionController.getReporteProduccionPorProducto);

router.get('/procesos', productionController.getProcesos);
router.get('/procesos/:id', productionController.getProcesoById);
router.post('/procesos', productionController.createProceso);
router.post('/procesos/:id/etapas', productionController.addEtapa);
router.put('/procesos/:id/etapas/:id_etapa', productionController.updateEtapa);
router.post('/procesos/:id/mermas', productionController.addMerma);
router.post('/procesos/:id/insumos', productionController.addInsumo);
router.post('/procesos/:id/cuarto-frio', productionController.addColdRoomEntry);
router.post('/procesos/:id/finalizar', productionController.finalizeProceso);
router.put('/procesos/:id/revertir', productionController.revertProceso);
router.delete('/procesos/:id', productionController.deleteProceso);

module.exports = router;
