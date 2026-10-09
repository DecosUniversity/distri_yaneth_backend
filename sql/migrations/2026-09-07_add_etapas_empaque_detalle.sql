-- Desglose de cajas para una etapa de empaque (ej. "Empaque en red"): permite registrar
-- varias cajas fisicas (cada una con su propia cantidad de redes y peso) dentro de una sola
-- etapa de un proceso de produccion, sin perder ese detalle al estandarizar Redes como un
-- producto mas dentro de Produccion (antes vivia en redes_verde_detalle, ligado directo a
-- inventario en vez de a una etapa). Es puramente informativo: el balance de masa y el
-- inventario resultante se calculan sobre el total del proceso, no sobre cada caja.
CREATE TABLE `etapas_empaque_detalle` (
  `id_detalle` int(11) NOT NULL AUTO_INCREMENT,
  `id_etapa` int(11) NOT NULL,
  `cantidad_redes` int(11) NOT NULL,
  `peso_kg` decimal(10,2) NOT NULL,
  `estado_registro` enum('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `id_usuario_modificacion` int(11) DEFAULT NULL,
  PRIMARY KEY (`id_detalle`),
  KEY `fk_eempaque_etapa` (`id_etapa`),
  KEY `fk_eempaque_usuario_mod` (`id_usuario_modificacion`),
  CONSTRAINT `fk_eempaque_etapa` FOREIGN KEY (`id_etapa`) REFERENCES `produccion_etapas` (`id_etapa`),
  CONSTRAINT `fk_eempaque_usuario_mod` FOREIGN KEY (`id_usuario_modificacion`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
