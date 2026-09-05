-- Registra la fecha en que un pedido quedo resuelto (Entregado o Con Devolucion) al
-- cerrar la ruta, para poder reportar "pedidos del dia" agrupando por la fecha real de
-- entrega en lugar de solo la fecha de creacion del pedido.
ALTER TABLE `pedidos`
  ADD COLUMN `fecha_entrega` timestamp NULL DEFAULT NULL AFTER `fecha_modificacion`;
