-- Control de combustible por ruta: capacidad del tanque de cada vehiculo, nivel del tanque
-- (en octavos, como el marcador del vehiculo) al salir y al llegar, facturas de combustible
-- cargadas durante la ruta y las alertas cuando el combustible no cuadra.

ALTER TABLE `vehiculos`
  ADD COLUMN `capacidad_tanque_galones` decimal(6,2) DEFAULT NULL AFTER `kilometraje_actual`;

ALTER TABLE `rutas_entrega`
  ADD COLUMN `nivel_tanque_salida` tinyint(4) DEFAULT NULL AFTER `galones_combustible`,
  ADD COLUMN `nivel_tanque_llegada` tinyint(4) DEFAULT NULL AFTER `nivel_tanque_salida`,
  ADD COLUMN `alertas_combustible` text DEFAULT NULL AFTER `nivel_tanque_llegada`;

CREATE TABLE `cargas_combustible` (
  `id_carga` int(11) NOT NULL AUTO_INCREMENT,
  `id_ruta` int(11) NOT NULL,
  `numero_factura` varchar(40) NOT NULL,
  `galones` decimal(8,2) NOT NULL,
  `monto` decimal(10,2) NOT NULL,
  `id_usuario_registro` int(11) DEFAULT NULL,
  `estado_registro` enum('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_carga`),
  KEY `fk_cargas_combustible_ruta` (`id_ruta`),
  KEY `fk_cargas_combustible_usuario` (`id_usuario_registro`),
  KEY `idx_cargas_combustible_factura` (`numero_factura`),
  CONSTRAINT `fk_cargas_combustible_ruta` FOREIGN KEY (`id_ruta`) REFERENCES `rutas_entrega` (`id_ruta`),
  CONSTRAINT `fk_cargas_combustible_usuario` FOREIGN KEY (`id_usuario_registro`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
