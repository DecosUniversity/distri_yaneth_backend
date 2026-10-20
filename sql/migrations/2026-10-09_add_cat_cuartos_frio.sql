CREATE TABLE `cat_cuartos_frio` (
  `id_cuarto_frio` int(11) NOT NULL AUTO_INCREMENT,
  `nombre_cuarto` varchar(100) NOT NULL,
  `descripcion` varchar(150) DEFAULT NULL,
  `estado_registro` enum('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `id_usuario_modificacion` int(11) DEFAULT NULL,
  PRIMARY KEY (`id_cuarto_frio`),
  UNIQUE KEY `uq_cat_cuartos_frio_nombre` (`nombre_cuarto`),
  KEY `fk_cat_cuartos_frio_usuario_mod` (`id_usuario_modificacion`),
  CONSTRAINT `fk_cat_cuartos_frio_usuario_mod` FOREIGN KEY (`id_usuario_modificacion`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE `produccion_cuartos_frio`
  ADD COLUMN `id_cuarto_frio` int(11) DEFAULT NULL AFTER `id_proceso`,
  ADD KEY `fk_produccion_cuartos_frio_tipo` (`id_cuarto_frio`),
  ADD CONSTRAINT `fk_produccion_cuartos_frio_tipo` FOREIGN KEY (`id_cuarto_frio`) REFERENCES `cat_cuartos_frio` (`id_cuarto_frio`);
