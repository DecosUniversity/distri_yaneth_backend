-- Codigo de trazabilidad por fase (PREFIJO-NNNNNN, ej. SUB-000009) guardado en cada tabla, para
-- poder buscar/filtrar por el mismo codigo que muestra la aplicacion. Lo asigna el backend
-- despues de cada INSERT (Backend/src/workers/shared/phaseCode.js -> assignPhaseCode): MariaDB
-- 10.4 no permite una columna GENERATED a partir de un AUTO_INCREMENT.
--
-- Es NULL-able solo porque el codigo se escribe un instante despues del INSERT (dentro de la
-- misma transaccion); UNIQUE permite varios NULL pero ningun codigo repetido.
-- La entrada no la necesita: ya guarda su codigo_lote (ej. AGU-261008-002).

ALTER TABLE `lotes_materia_prima`
  ADD COLUMN `codigo_trazabilidad` varchar(16) DEFAULT NULL AFTER `id_lote_mp`,
  ADD UNIQUE KEY `uq_lotes_materia_prima_codigo` (`codigo_trazabilidad`);
UPDATE `lotes_materia_prima` SET `codigo_trazabilidad` = CONCAT('LMP-', LPAD(`id_lote_mp`, 6, '0'));

ALTER TABLE `sublotes_maduracion`
  ADD COLUMN `codigo_trazabilidad` varchar(16) DEFAULT NULL AFTER `id_sublote`,
  ADD UNIQUE KEY `uq_sublotes_maduracion_codigo` (`codigo_trazabilidad`);
UPDATE `sublotes_maduracion` SET `codigo_trazabilidad` = CONCAT('SUB-', LPAD(`id_sublote`, 6, '0'));

ALTER TABLE `procesos_produccion`
  ADD COLUMN `codigo_trazabilidad` varchar(16) DEFAULT NULL AFTER `id_proceso`,
  ADD UNIQUE KEY `uq_procesos_produccion_codigo` (`codigo_trazabilidad`);
UPDATE `procesos_produccion` SET `codigo_trazabilidad` = CONCAT('PRO-', LPAD(`id_proceso`, 6, '0'));

ALTER TABLE `redes_verde_detalle`
  ADD COLUMN `codigo_trazabilidad` varchar(16) DEFAULT NULL AFTER `id_red`,
  ADD UNIQUE KEY `uq_redes_verde_detalle_codigo` (`codigo_trazabilidad`);
UPDATE `redes_verde_detalle` SET `codigo_trazabilidad` = CONCAT('RED-', LPAD(`id_red`, 6, '0'));

ALTER TABLE `inventario_existencias`
  ADD COLUMN `codigo_trazabilidad` varchar(16) DEFAULT NULL AFTER `id_existencia`,
  ADD UNIQUE KEY `uq_inventario_existencias_codigo` (`codigo_trazabilidad`);
UPDATE `inventario_existencias` SET `codigo_trazabilidad` = CONCAT('EXI-', LPAD(`id_existencia`, 6, '0'));

ALTER TABLE `pedidos`
  ADD COLUMN `codigo_trazabilidad` varchar(16) DEFAULT NULL AFTER `id_pedido`,
  ADD UNIQUE KEY `uq_pedidos_codigo` (`codigo_trazabilidad`);
UPDATE `pedidos` SET `codigo_trazabilidad` = CONCAT('PED-', LPAD(`id_pedido`, 6, '0'));
