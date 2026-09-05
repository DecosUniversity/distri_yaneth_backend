-- Fecha de entrega solicitada/programada para el pedido (asignable al crearlo o mientras
-- sigue en curso), distinta de `fecha_entrega` (que se llena sola al cerrar la ruta con el
-- resultado real: Entregado o Con Devolucion).
ALTER TABLE `pedidos`
  ADD COLUMN `fecha_entrega_programada` date DEFAULT NULL AFTER `observaciones`;
