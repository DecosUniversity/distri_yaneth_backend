-- Receta de etapas por producto terminado: define que etapas (y en que orden) debe
-- cumplir un producto antes de darse por completo. Al finalizar un proceso de produccion,
-- si el producto resultado tiene una receta definida, se valida que todas esas etapas
-- se hayan registrado y en el orden indicado.
CREATE TABLE `producto_etapas_requeridas` (
  `id_requisito` int(11) NOT NULL AUTO_INCREMENT,
  `id_producto` int(11) NOT NULL,
  `id_tipo_etapa` int(11) NOT NULL,
  `orden` int(11) NOT NULL,
  `id_usuario_modificacion` int(11) DEFAULT NULL,
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_requisito`),
  UNIQUE KEY `uq_petapas_producto_orden` (`id_producto`, `orden`),
  UNIQUE KEY `uq_petapas_producto_tipo` (`id_producto`, `id_tipo_etapa`),
  KEY `fk_petapas_tipo_etapa` (`id_tipo_etapa`),
  KEY `fk_petapas_usuario_mod` (`id_usuario_modificacion`),
  CONSTRAINT `fk_petapas_producto` FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id_producto`),
  CONSTRAINT `fk_petapas_tipo_etapa` FOREIGN KEY (`id_tipo_etapa`) REFERENCES `cat_tipos_etapa` (`id_tipo_etapa`),
  CONSTRAINT `fk_petapas_usuario_mod` FOREIGN KEY (`id_usuario_modificacion`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
