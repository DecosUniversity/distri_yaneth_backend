-- Liga cada linea de pedido a la existencia (lote) de inventario de la que realmente se
-- descuenta al crear el pedido, para poder trazar hacia adelante "a que pedido/cliente
-- se entrego una unidad de este lote" y para poder reingresar una devolucion al mismo
-- lote del que salio (en vez de a un lote arbitrario del mismo producto).
ALTER TABLE `pedido_detalle`
  ADD COLUMN `id_existencia` int(11) DEFAULT NULL AFTER `id_producto`,
  ADD CONSTRAINT `fk_detalle_existencia` FOREIGN KEY (`id_existencia`) REFERENCES `inventario_existencias` (`id_existencia`);
