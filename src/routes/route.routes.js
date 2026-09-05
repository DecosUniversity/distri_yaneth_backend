const { Router } = require('express');
const routeController = require('../controllers/route.controller');

const router = Router();

router.get('/pilotos-disponibles', routeController.getPilotosDisponibles);
router.get('/', routeController.getRutas);
router.get('/:id', routeController.getRutaById);
router.post('/', routeController.createRuta);
router.put('/:id/salida', routeController.registrarSalida);
router.put('/:id/entregas', routeController.confirmarEntregas);
router.put('/:id/cerrar', routeController.cerrarRuta);

module.exports = router;
