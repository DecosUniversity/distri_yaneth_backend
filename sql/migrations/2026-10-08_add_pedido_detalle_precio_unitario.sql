-- Congela el precio de venta sugerido del producto al momento de crear el pedido, para que
-- el valor de un pedido ya hecho no cambie si despues se edita el precio del producto. Se
-- establece unicamente en orders.create (no existe ningun UPDATE sobre esta columna en todo
-- el codigo): una vez creada la linea, su precio_unitario es inmutable por diseño.
-- Los pedidos creados antes de esta migracion quedan con precio_unitario = NULL (no se puede
-- reconstruir ese precio retroactivamente con certeza).
ALTER TABLE `pedido_detalle`
  ADD COLUMN `precio_unitario` decimal(10,2) DEFAULT NULL AFTER `cantidad`;
