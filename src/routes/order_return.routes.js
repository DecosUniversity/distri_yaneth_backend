const { Router } = require('express');
const orderReturnController = require('../controllers/order_return.controller');
const { authorizeRoles } = require('../middlewares/auth.middleware');

const router = Router();

// El piloto solo deja el producto marcado como Parcial/Rechazado durante la confirmacion
// de entregas (routes.confirmarEntregas); eso ya lo pone en la cola de pendientes-recepcion
// automaticamente. La recepcion fisica en bodega (el producto sigue siendo responsabilidad
// del piloto hasta que la entrega alguien en bodega) la hace Administrador o Logistica;
// la resolucion (reingreso o perdida) la decide Produccion (evalua si sigue vendible) o Administrador.
router.get('/', orderReturnController.getDevoluciones);
router.get('/pendientes-revision', orderReturnController.getDevolucionesPendientesRevision);
router.get('/pendientes-recepcion', orderReturnController.getLineasPendientesRecepcion);
router.post('/', authorizeRoles('Administrador', 'Logistica'), orderReturnController.createDevolucion);
router.put(
  '/:id/resolver',
  authorizeRoles('Administrador', 'Logistica', 'Produccion'),
  orderReturnController.resolverDevolucion
);

module.exports = router;
