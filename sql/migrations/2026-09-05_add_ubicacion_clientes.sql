-- Estructura la ubicacion del cliente en departamento/municipio/zona (ademas de la
-- direccion de entrega en texto libre), para poder agrupar/ordenar pedidos de una
-- misma zona al armar una ruta de entrega.
ALTER TABLE `clientes`
  ADD COLUMN `departamento` varchar(60) DEFAULT NULL AFTER `nombre_comercial`,
  ADD COLUMN `municipio` varchar(60) DEFAULT NULL AFTER `departamento`,
  ADD COLUMN `zona` varchar(10) DEFAULT NULL AFTER `municipio`;
