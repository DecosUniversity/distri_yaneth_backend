const { Router } = require('express');
const entradasMercanciaController = require('../controllers/entradas_mercancia.controller');

const router = Router();

router.get('/', entradasMercanciaController.getEntradasMercancia);
router.get('/existencias', entradasMercanciaController.getInventarioExistencias);
router.get('/movimientos', entradasMercanciaController.getMovimientosInventario);
router.get('/:id', entradasMercanciaController.getEntradaMercanciaById);
router.post('/', entradasMercanciaController.createEntradaMercancia);
router.get('/:id/units', entradasMercanciaController.getUnitsByEntrada);
router.post('/:id/units', entradasMercanciaController.createUnitForEntrada);
router.delete('/units/:unitId', entradasMercanciaController.deleteUnit);
router.delete('/:id', entradasMercanciaController.deleteEntradaMercancia);

module.exports = router;