-- Cada control de maduracion puede indicar (opcionalmente) en que cuarto frio se tomo la
-- medicion, usando el mismo catalogo cat_cuartos_frio de Produccion. Requiere que
-- 2026-10-09_add_cat_cuartos_frio.sql ya este aplicada.
ALTER TABLE `control_maduracion`
  ADD COLUMN `id_cuarto_frio` int(11) DEFAULT NULL AFTER `temperatura_cuarto`,
  ADD KEY `fk_control_maduracion_cuarto_frio` (`id_cuarto_frio`),
  ADD CONSTRAINT `fk_control_maduracion_cuarto_frio` FOREIGN KEY (`id_cuarto_frio`) REFERENCES `cat_cuartos_frio` (`id_cuarto_frio`);
