const { Router } = require('express');
const orderController = require('../controllers/order.controller');

const router = Router();

router.get('/reportes/mas-vendidos', orderController.getReporteProductosMasVendidos);
router.get('/reportes/mejores-clientes', orderController.getReporteMejoresClientes);
router.get('/reportes/pedidos-del-dia', orderController.getReportePedidosDelDia);

router.get('/', orderController.getPedidos);
router.get('/:id', orderController.getPedidoById);
router.post('/', orderController.createPedido);
router.put('/:id/cancelar', orderController.cancelPedido);
router.put('/:id/fecha-entrega', orderController.updateFechaEntregaProgramada);

module.exports = router;
