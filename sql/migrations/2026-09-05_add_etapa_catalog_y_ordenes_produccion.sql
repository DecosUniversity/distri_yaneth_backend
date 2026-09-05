-- 1) Catalogo de tipos de etapa de produccion, para no limitar el proceso a
--    Pelado/Corte/Fritura/Embalaje (utiles solo para frituras): ahora se pueden crear
--    etapas nuevas para cualquier producto derivado del platano (coccion, secado,
--    molienda, congelado, etc.), igual que ya existe el catalogo de tipos de merma.
CREATE TABLE `cat_tipos_etapa` (
  `id_tipo_etapa` int(11) NOT NULL AUTO_INCREMENT,
  `nombre_etapa` varchar(60) NOT NULL,
  `descripcion` varchar(150) DEFAULT NULL,
  `estado_registro` enum('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `id_usuario_modificacion` int(11) DEFAULT NULL,
  PRIMARY KEY (`id_tipo_etapa`),
  UNIQUE KEY `uq_cat_tipos_etapa_nombre` (`nombre_etapa`),
  KEY `fk_cat_tipos_etapa_usuario_mod` (`id_usuario_modificacion`),
  CONSTRAINT `fk_cat_tipos_etapa_usuario_mod` FOREIGN KEY (`id_usuario_modificacion`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `cat_tipos_etapa` (nombre_etapa) VALUES ('Pelado'), ('Corte'), ('Fritura'), ('Embalaje');

-- produccion_etapas: cambia el enum nombre_etapa por una referencia al catalogo.
ALTER TABLE `produccion_etapas`
  ADD COLUMN `id_tipo_etapa` int(11) DEFAULT NULL AFTER `id_proceso`;

UPDATE `produccion_etapas` pe
  INNER JOIN `cat_tipos_etapa` cte ON cte.nombre_etapa = pe.nombre_etapa
  SET pe.id_tipo_etapa = cte.id_tipo_etapa;

ALTER TABLE `produccion_etapas`
  MODIFY COLUMN `id_tipo_etapa` int(11) NOT NULL,
  DROP COLUMN `nombre_etapa`,
  ADD CONSTRAINT `fk_produccion_etapas_tipo` FOREIGN KEY (`id_tipo_etapa`) REFERENCES `cat_tipos_etapa` (`id_tipo_etapa`);

-- 2) Ordenes de produccion: guias/planes de lo que hay que producir, que luego un
--    proceso real (procesos_produccion) puede tomar y cumplir.
CREATE TABLE `ordenes_produccion` (
  `id_orden` int(11) NOT NULL AUTO_INCREMENT,
  `id_producto` int(11) NOT NULL,
  `cantidad_solicitada_kg` decimal(10,2) NOT NULL,
  `cantidad_producida_kg` decimal(10,2) NOT NULL DEFAULT 0.00,
  `fecha_solicitada` date DEFAULT NULL,
  `observaciones` text DEFAULT NULL,
  `estado` enum('Pendiente','En Proceso','Completada','Cancelada') NOT NULL DEFAULT 'Pendiente',
  `estado_registro` enum('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  `id_usuario_creacion` int(11) NOT NULL,
  `id_usuario_modificacion` int(11) DEFAULT NULL,
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_orden`),
  KEY `fk_ordenes_produccion_producto` (`id_producto`),
  KEY `fk_ordenes_produccion_usuario_creacion` (`id_usuario_creacion`),
  KEY `fk_ordenes_produccion_usuario_mod` (`id_usuario_modificacion`),
  CONSTRAINT `fk_ordenes_produccion_producto` FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id_producto`),
  CONSTRAINT `fk_ordenes_produccion_usuario_creacion` FOREIGN KEY (`id_usuario_creacion`) REFERENCES `usuarios` (`id_usuario`),
  CONSTRAINT `fk_ordenes_produccion_usuario_mod` FOREIGN KEY (`id_usuario_modificacion`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- procesos_produccion: enlace opcional a la orden que el proceso esta cumpliendo.
ALTER TABLE `procesos_produccion`
  ADD COLUMN `id_orden` int(11) DEFAULT NULL AFTER `id_producto_resultado`,
  ADD CONSTRAINT `fk_procesos_produccion_orden` FOREIGN KEY (`id_orden`) REFERENCES `ordenes_produccion` (`id_orden`);
