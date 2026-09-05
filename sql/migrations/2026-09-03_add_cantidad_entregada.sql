-- Permite confirmar entregas parciales o rechazos totales por linea de pedido:
-- agrega el estado 'Parcial' y 'Rechazado' a estado_entrega, y una columna
-- cantidad_entregada para registrar cuantas unidades se confirmaron en la entrega.
ALTER TABLE `pedido_detalle`
  MODIFY COLUMN `estado_entrega` enum('Pendiente','Entregado','Parcial','Rechazado','Devuelto') NOT NULL DEFAULT 'Pendiente',
  ADD COLUMN `cantidad_entregada` decimal(10,2) DEFAULT NULL AFTER `estado_entrega`;
