-- Schema consolidado de produccion (banano/platano) - generado automaticamente
-- Fecha de generacion: 2026-08-10
-- Uso: crear la base de datos vacia y ejecutar este archivo completo para levantar el esquema.
-- No incluye datos ni usuarios. Crea un usuario Administrador despues de desplegar (ver nota al final).

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Tabla: cat_tipos_merma
-- ----------------------------
DROP TABLE IF EXISTS `cat_tipos_merma`;
CREATE TABLE `cat_tipos_merma` (
  `id_tipo_merma` int(11) NOT NULL AUTO_INCREMENT,
  `nombre_merma` varchar(50) NOT NULL,
  `descripcion` varchar(150) DEFAULT NULL,
  `estado_registro` enum('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_tipo_merma`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Tabla: clientes
-- ----------------------------
DROP TABLE IF EXISTS `clientes`;
CREATE TABLE `clientes` (
  `id_cliente` int(11) NOT NULL AUTO_INCREMENT,
  `nombre_comercial` varchar(150) NOT NULL,
  `direccion_entrega` text DEFAULT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `nit_facturacion` varchar(20) DEFAULT NULL,
  `estado_registro` enum('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  `fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_cliente`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Tabla: control_combustible
-- ----------------------------
DROP TABLE IF EXISTS `control_combustible`;
CREATE TABLE `control_combustible` (
  `id_combustible` int(11) NOT NULL AUTO_INCREMENT,
  `id_despacho` int(11) NOT NULL,
  `km_inicial` decimal(10,2) NOT NULL,
  `km_final` decimal(10,2) DEFAULT NULL,
  `galones_consumidos` decimal(10,2) DEFAULT NULL,
  `costo_combustible` decimal(10,2) DEFAULT NULL,
  `fecha_registro` timestamp NOT NULL DEFAULT current_timestamp(),
  `galones_reales` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`id_combustible`),
  KEY `id_despacho` (`id_despacho`),
  CONSTRAINT `control_combustible_ibfk_1` FOREIGN KEY (`id_despacho`) REFERENCES `despachos_logistica` (`id_despacho`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Tabla: control_maduracion
-- ----------------------------
DROP TABLE IF EXISTS `control_maduracion`;
CREATE TABLE `control_maduracion` (
  `id_control` int(11) NOT NULL AUTO_INCREMENT,
  `id_sublote` int(11) NOT NULL,
  `fecha_medicion` timestamp NOT NULL DEFAULT current_timestamp(),
  `grados_brix` decimal(5,2) NOT NULL,
  `peso_medido_kg` decimal(10,2) DEFAULT NULL,
  `porcentaje_materia_seca` decimal(5,2) DEFAULT NULL,
  `temperatura_cuarto` decimal(5,2) DEFAULT NULL,
  `observaciones` text DEFAULT NULL,
  PRIMARY KEY (`id_control`),
  KEY `fk_control_sublote` (`id_sublote`),
  CONSTRAINT `fk_control_sublote` FOREIGN KEY (`id_sublote`) REFERENCES `sublotes_maduracion` (`id_sublote`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Tabla: despachos_logistica
-- ----------------------------
DROP TABLE IF EXISTS `despachos_logistica`;
CREATE TABLE `despachos_logistica` (
  `id_despacho` int(11) NOT NULL AUTO_INCREMENT,
  `id_pedido` int(11) DEFAULT NULL,
  `id_vehiculo` int(11) DEFAULT NULL,
  `id_piloto` int(11) DEFAULT NULL,
  `fecha_salida` timestamp NULL DEFAULT NULL,
  `fecha_entrega_real` timestamp NULL DEFAULT NULL,
  `observaciones_entrega` text DEFAULT NULL,
  PRIMARY KEY (`id_despacho`),
  KEY `id_pedido` (`id_pedido`),
  KEY `id_vehiculo` (`id_vehiculo`),
  KEY `id_piloto` (`id_piloto`),
  CONSTRAINT `despachos_logistica_ibfk_1` FOREIGN KEY (`id_pedido`) REFERENCES `pedidos` (`id_pedido`),
  CONSTRAINT `despachos_logistica_ibfk_2` FOREIGN KEY (`id_vehiculo`) REFERENCES `vehiculos` (`id_vehiculo`),
  CONSTRAINT `despachos_logistica_ibfk_3` FOREIGN KEY (`id_piloto`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Tabla: detalle_pedido
-- ----------------------------
DROP TABLE IF EXISTS `detalle_pedido`;
CREATE TABLE `detalle_pedido` (
  `id_detalle` int(11) NOT NULL AUTO_INCREMENT,
  `id_pedido` int(11) DEFAULT NULL,
  `id_producto` int(11) DEFAULT NULL,
  `id_existencia` int(11) DEFAULT NULL,
  `cantidad_vendida` decimal(10,2) NOT NULL,
  `precio_aplicado` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`id_detalle`),
  KEY `id_pedido` (`id_pedido`),
  KEY `id_producto` (`id_producto`),
  KEY `id_existencia` (`id_existencia`),
  CONSTRAINT `detalle_pedido_ibfk_1` FOREIGN KEY (`id_pedido`) REFERENCES `pedidos` (`id_pedido`),
  CONSTRAINT `detalle_pedido_ibfk_2` FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id_producto`),
  CONSTRAINT `detalle_pedido_ibfk_3` FOREIGN KEY (`id_existencia`) REFERENCES `inventario_existencias` (`id_existencia`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Tabla: entrada_unidades
-- ----------------------------
DROP TABLE IF EXISTS `entrada_unidades`;
CREATE TABLE `entrada_unidades` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_entrada` int(11) NOT NULL,
  `unidad_codigo` varchar(100) DEFAULT NULL,
  `peso` decimal(12,4) NOT NULL,
  `creado_por` int(11) NOT NULL,
  `fecha_pesos` datetime NOT NULL DEFAULT current_timestamp(),
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_entrada_unidades_id_entrada` (`id_entrada`),
  CONSTRAINT `fk_entrada` FOREIGN KEY (`id_entrada`) REFERENCES `entradas_mercancia` (`id_entrada`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Tabla: entradas_mercancia
-- ----------------------------
DROP TABLE IF EXISTS `entradas_mercancia`;
CREATE TABLE `entradas_mercancia` (
  `id_entrada` int(11) NOT NULL AUTO_INCREMENT,
  `id_proveedor` int(11) DEFAULT NULL,
  `fecha_recepcion` timestamp NOT NULL DEFAULT current_timestamp(),
  `documento_referencia` varchar(50) DEFAULT NULL,
  `costo_unitario` decimal(10,2) DEFAULT NULL,
  `costo_total` decimal(12,2) DEFAULT NULL,
  `id_usuario_receptor` int(11) DEFAULT NULL,
  `estado_registro` enum('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  `fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_entrada`),
  KEY `id_proveedor` (`id_proveedor`),
  KEY `id_usuario_receptor` (`id_usuario_receptor`),
  CONSTRAINT `entradas_mercancia_ibfk_1` FOREIGN KEY (`id_proveedor`) REFERENCES `proveedores` (`id_proveedor`),
  CONSTRAINT `entradas_mercancia_ibfk_2` FOREIGN KEY (`id_usuario_receptor`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Tabla: inventario_existencias
-- ----------------------------
DROP TABLE IF EXISTS `inventario_existencias`;
CREATE TABLE `inventario_existencias` (
  `id_existencia` int(11) NOT NULL AUTO_INCREMENT,
  `id_producto` int(11) DEFAULT NULL,
  `id_proveedor` int(11) DEFAULT NULL,
  `id_proceso_origen` int(11) DEFAULT NULL,
  `id_entrada_origen` int(11) DEFAULT NULL,
  `fecha_entrada` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_vencimiento` date NOT NULL,
  `cantidad_disponible` decimal(10,2) NOT NULL DEFAULT 0.00,
  `costo_unitario` decimal(10,2) DEFAULT NULL,
  `estado_registro` enum('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  `fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_existencia`),
  KEY `id_producto` (`id_producto`),
  KEY `id_proveedor` (`id_proveedor`),
  KEY `id_proceso_origen` (`id_proceso_origen`),
  KEY `id_entrada_origen` (`id_entrada_origen`),
  CONSTRAINT `inventario_existencias_ibfk_1` FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id_producto`),
  CONSTRAINT `inventario_existencias_ibfk_2` FOREIGN KEY (`id_proveedor`) REFERENCES `proveedores` (`id_proveedor`),
  CONSTRAINT `inventario_existencias_ibfk_3` FOREIGN KEY (`id_proceso_origen`) REFERENCES `procesos_produccion` (`id_proceso`),
  CONSTRAINT `inventario_existencias_ibfk_4` FOREIGN KEY (`id_entrada_origen`) REFERENCES `entradas_mercancia` (`id_entrada`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Tabla: lotes_materia_prima
-- ----------------------------
DROP TABLE IF EXISTS `lotes_materia_prima`;
CREATE TABLE `lotes_materia_prima` (
  `id_lote_mp` int(11) NOT NULL AUTO_INCREMENT,
  `id_producto` int(11) DEFAULT NULL,
  `id_proveedor` int(11) DEFAULT NULL,
  `id_entrada_origen` int(11) DEFAULT NULL,
  `fecha_recepcion` date NOT NULL,
  `cantidad_unidades` int(11) DEFAULT NULL,
  `peso_inicial_kg` decimal(10,2) NOT NULL,
  `estado_maduracion` varchar(50) DEFAULT 'Verde',
  `estado_registro` enum('Activo','Inactivo','Completo','Pendiente') NOT NULL DEFAULT 'Pendiente',
  `fecha_modificacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_lote_mp`),
  KEY `id_producto` (`id_producto`),
  KEY `id_proveedor` (`id_proveedor`),
  KEY `fk_lotes_entrada_origen` (`id_entrada_origen`),
  CONSTRAINT `fk_lotes_entrada_origen` FOREIGN KEY (`id_entrada_origen`) REFERENCES `entradas_mercancia` (`id_entrada`),
  CONSTRAINT `lotes_materia_prima_ibfk_1` FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id_producto`),
  CONSTRAINT `lotes_materia_prima_ibfk_2` FOREIGN KEY (`id_proveedor`) REFERENCES `proveedores` (`id_proveedor`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Tabla: movimientos_inventario
-- ----------------------------
DROP TABLE IF EXISTS `movimientos_inventario`;
CREATE TABLE `movimientos_inventario` (
  `id_movimiento` int(11) NOT NULL AUTO_INCREMENT,
  `id_existencia` int(11) DEFAULT NULL,
  `tipo_movimiento` enum('Entrada','Salida','Ajuste','Desperdicio') NOT NULL,
  `cantidad` decimal(10,2) NOT NULL,
  `motivo` varchar(255) DEFAULT NULL,
  `fecha_movimiento` timestamp NOT NULL DEFAULT current_timestamp(),
  `id_usuario` int(11) DEFAULT NULL,
  `estado_registro` enum('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  `fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_movimiento`),
  KEY `id_existencia` (`id_existencia`),
  KEY `id_usuario` (`id_usuario`),
  CONSTRAINT `movimientos_inventario_ibfk_1` FOREIGN KEY (`id_existencia`) REFERENCES `inventario_existencias` (`id_existencia`),
  CONSTRAINT `movimientos_inventario_ibfk_2` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Tabla: pedidos
-- ----------------------------
DROP TABLE IF EXISTS `pedidos`;
CREATE TABLE `pedidos` (
  `id_pedido` int(11) NOT NULL AUTO_INCREMENT,
  `id_cliente` int(11) DEFAULT NULL,
  `fecha_pedido` timestamp NOT NULL DEFAULT current_timestamp(),
  `estado_pedido` enum('Pendiente','Preparado','En Ruta','Entregado') DEFAULT 'Pendiente',
  `prioridad` enum('Baja','Media','Alta','Urgente') DEFAULT 'Media',
  `monto_total_pedido` decimal(10,2) DEFAULT 0.00,
  PRIMARY KEY (`id_pedido`),
  KEY `id_cliente` (`id_cliente`),
  CONSTRAINT `pedidos_ibfk_1` FOREIGN KEY (`id_cliente`) REFERENCES `clientes` (`id_cliente`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Tabla: procesos_produccion
-- ----------------------------
DROP TABLE IF EXISTS `procesos_produccion`;
CREATE TABLE `procesos_produccion` (
  `id_proceso` int(11) NOT NULL AUTO_INCREMENT,
  `id_sublote` int(11) DEFAULT NULL,
  `id_producto_resultado` int(11) DEFAULT NULL,
  `cantidad_ingresada_kg` decimal(10,2) NOT NULL DEFAULT 0.00,
  `cantidad_producida_kg` decimal(10,2) DEFAULT NULL,
  `rendimiento_porcentaje` decimal(6,2) DEFAULT NULL,
  `fecha_inicio` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_fin` datetime DEFAULT NULL,
  `cuarto_congelado` varchar(120) DEFAULT NULL,
  `ubicacion_cuarto_congelado` varchar(120) DEFAULT NULL,
  `observaciones` text DEFAULT NULL,
  `id_usuario_registro` int(11) DEFAULT NULL,
  `estado_registro` enum('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `estado_proceso` enum('En proceso','Pausado','Finalizado') NOT NULL DEFAULT 'En proceso',
  PRIMARY KEY (`id_proceso`),
  KEY `id_lote_mp` (`id_sublote`),
  KEY `fk_produccion_producto` (`id_producto_resultado`),
  KEY `fk_produccion_usuario` (`id_usuario_registro`),
  CONSTRAINT `fk_produccion_producto` FOREIGN KEY (`id_producto_resultado`) REFERENCES `productos` (`id_producto`),
  CONSTRAINT `fk_produccion_sublote` FOREIGN KEY (`id_sublote`) REFERENCES `sublotes_maduracion` (`id_sublote`),
  CONSTRAINT `fk_produccion_usuario` FOREIGN KEY (`id_usuario_registro`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Tabla: produccion_cuartos_frio
-- ----------------------------
DROP TABLE IF EXISTS `produccion_cuartos_frio`;
CREATE TABLE `produccion_cuartos_frio` (
  `id_ingreso_cuarto` int(11) NOT NULL AUTO_INCREMENT,
  `id_proceso` int(11) NOT NULL,
  `fecha_ingreso` datetime NOT NULL DEFAULT current_timestamp(),
  `ubicacion_cuarto` varchar(120) NOT NULL,
  `cantidad_kg` decimal(10,2) NOT NULL,
  `observaciones` text DEFAULT NULL,
  `estado_registro` enum('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_ingreso_cuarto`),
  KEY `fk_produccion_cuartos_proceso` (`id_proceso`),
  CONSTRAINT `fk_produccion_cuartos_proceso` FOREIGN KEY (`id_proceso`) REFERENCES `procesos_produccion` (`id_proceso`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Tabla: produccion_etapas
-- ----------------------------
DROP TABLE IF EXISTS `produccion_etapas`;
CREATE TABLE `produccion_etapas` (
  `id_etapa` int(11) NOT NULL AUTO_INCREMENT,
  `id_proceso` int(11) NOT NULL,
  `nombre_etapa` enum('Pelado','Corte','Fritura','Embalaje') NOT NULL,
  `fecha_inicio` datetime NOT NULL,
  `fecha_fin` datetime DEFAULT NULL,
  `personal_asignado` varchar(150) NOT NULL,
  `cantidad_entrada_kg` decimal(10,2) DEFAULT NULL,
  `cantidad_salida_kg` decimal(10,2) DEFAULT NULL,
  `merma_kg` decimal(10,2) DEFAULT NULL,
  `observaciones` text DEFAULT NULL,
  `estado_registro` enum('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_etapa`),
  KEY `fk_produccion_etapas_proceso` (`id_proceso`),
  CONSTRAINT `fk_produccion_etapas_proceso` FOREIGN KEY (`id_proceso`) REFERENCES `procesos_produccion` (`id_proceso`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Tabla: produccion_insumos
-- ----------------------------
DROP TABLE IF EXISTS `produccion_insumos`;
CREATE TABLE `produccion_insumos` (
  `id_consumo` int(11) NOT NULL AUTO_INCREMENT,
  `id_proceso` int(11) NOT NULL,
  `id_etapa` int(11) DEFAULT NULL,
  `id_producto` int(11) NOT NULL,
  `cantidad` decimal(10,2) NOT NULL,
  `unidad_medida` varchar(20) NOT NULL DEFAULT 'Unidad',
  `observaciones` text DEFAULT NULL,
  `fecha_registro` datetime NOT NULL DEFAULT current_timestamp(),
  `estado_registro` enum('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_consumo`),
  KEY `fk_produccion_insumos_proceso` (`id_proceso`),
  KEY `fk_produccion_insumos_etapa` (`id_etapa`),
  KEY `fk_produccion_insumos_producto` (`id_producto`),
  CONSTRAINT `fk_produccion_insumos_etapa` FOREIGN KEY (`id_etapa`) REFERENCES `produccion_etapas` (`id_etapa`),
  CONSTRAINT `fk_produccion_insumos_proceso` FOREIGN KEY (`id_proceso`) REFERENCES `procesos_produccion` (`id_proceso`),
  CONSTRAINT `fk_produccion_insumos_producto` FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id_producto`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Tabla: produccion_mermas
-- ----------------------------
DROP TABLE IF EXISTS `produccion_mermas`;
CREATE TABLE `produccion_mermas` (
  `id_merma` int(11) NOT NULL AUTO_INCREMENT,
  `id_proceso` int(11) NOT NULL,
  `id_etapa` int(11) DEFAULT NULL,
  `id_tipo_merma` int(11) NOT NULL,
  `cantidad_kg` decimal(10,2) NOT NULL,
  `observaciones` text DEFAULT NULL,
  `fecha_registro` datetime NOT NULL DEFAULT current_timestamp(),
  `estado_registro` enum('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_merma`),
  KEY `fk_produccion_mermas_proceso` (`id_proceso`),
  KEY `fk_produccion_mermas_etapa` (`id_etapa`),
  KEY `fk_produccion_mermas_tipo` (`id_tipo_merma`),
  CONSTRAINT `fk_produccion_mermas_etapa` FOREIGN KEY (`id_etapa`) REFERENCES `produccion_etapas` (`id_etapa`),
  CONSTRAINT `fk_produccion_mermas_proceso` FOREIGN KEY (`id_proceso`) REFERENCES `procesos_produccion` (`id_proceso`),
  CONSTRAINT `fk_produccion_mermas_tipo` FOREIGN KEY (`id_tipo_merma`) REFERENCES `cat_tipos_merma` (`id_tipo_merma`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Tabla: productos
-- ----------------------------
DROP TABLE IF EXISTS `productos`;
CREATE TABLE `productos` (
  `id_producto` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `unidad_medida` varchar(20) DEFAULT NULL,
  `tipo_producto` enum('Materia Prima','Producto Terminado','Insumo','Venta Directa') NOT NULL,
  `stock_minimo` decimal(10,2) DEFAULT 10.00,
  `precio_venta_sugerido` decimal(10,2) DEFAULT 0.00,
  `estado_registro` enum('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  `fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_producto`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Tabla: proveedores
-- ----------------------------
DROP TABLE IF EXISTS `proveedores`;
CREATE TABLE `proveedores` (
  `id_proveedor` int(11) NOT NULL AUTO_INCREMENT,
  `nombre_empresa` varchar(100) NOT NULL,
  `nit` varchar(20) DEFAULT NULL,
  `contacto_nombre` varchar(100) DEFAULT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `estado_registro` enum('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  `fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_proveedor`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Tabla: recetas
-- ----------------------------
DROP TABLE IF EXISTS `recetas`;
CREATE TABLE `recetas` (
  `id_receta` int(11) NOT NULL AUTO_INCREMENT,
  `id_producto_final` int(11) DEFAULT NULL,
  `id_insumo` int(11) DEFAULT NULL,
  `cantidad_estandar` decimal(10,4) NOT NULL,
  PRIMARY KEY (`id_receta`),
  KEY `id_producto_final` (`id_producto_final`),
  KEY `id_insumo` (`id_insumo`),
  CONSTRAINT `recetas_ibfk_1` FOREIGN KEY (`id_producto_final`) REFERENCES `productos` (`id_producto`),
  CONSTRAINT `recetas_ibfk_2` FOREIGN KEY (`id_insumo`) REFERENCES `productos` (`id_producto`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Tabla: redes_verde_detalle
-- ----------------------------
DROP TABLE IF EXISTS `redes_verde_detalle`;
CREATE TABLE `redes_verde_detalle` (
  `id_red` int(11) NOT NULL AUTO_INCREMENT,
  `id_sublote` int(11) NOT NULL,
  `id_existencia` int(11) NOT NULL,
  `peso_kg` decimal(10,2) NOT NULL,
  `id_usuario` int(11) NOT NULL,
  `fecha_empaque` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_red`),
  KEY `fk_red_sublote` (`id_sublote`),
  KEY `fk_red_existencia` (`id_existencia`),
  KEY `fk_red_usuario` (`id_usuario`),
  CONSTRAINT `fk_red_existencia` FOREIGN KEY (`id_existencia`) REFERENCES `inventario_existencias` (`id_existencia`),
  CONSTRAINT `fk_red_sublote` FOREIGN KEY (`id_sublote`) REFERENCES `sublotes_maduracion` (`id_sublote`),
  CONSTRAINT `fk_red_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Tabla: reporte_kilometraje_vehiculo
-- ----------------------------
DROP TABLE IF EXISTS `reporte_kilometraje_vehiculo`;
CREATE TABLE `reporte_kilometraje_vehiculo` (
  `id_reporte_kilometraje` int(11) NOT NULL AUTO_INCREMENT,
  `id_vehiculo` int(11) NOT NULL,
  `id_usuario_modificador` int(11) NOT NULL,
  `kilometraje_registrado` decimal(12,2) NOT NULL,
  `fecha_reporte` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_reporte_kilometraje`),
  KEY `fk_reporte_kilometraje_vehiculo` (`id_vehiculo`),
  KEY `fk_reporte_kilometraje_usuario` (`id_usuario_modificador`),
  CONSTRAINT `fk_reporte_kilometraje_usuario` FOREIGN KEY (`id_usuario_modificador`) REFERENCES `usuarios` (`id_usuario`),
  CONSTRAINT `fk_reporte_kilometraje_vehiculo` FOREIGN KEY (`id_vehiculo`) REFERENCES `vehiculos` (`id_vehiculo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Tabla: servicios_vehiculo
-- ----------------------------
DROP TABLE IF EXISTS `servicios_vehiculo`;
CREATE TABLE `servicios_vehiculo` (
  `id_servicio` int(11) NOT NULL AUTO_INCREMENT,
  `id_vehiculo` int(11) NOT NULL,
  `id_tipo_servicio` int(11) NOT NULL,
  `fecha_servicio` date NOT NULL,
  `km_en_servicio` decimal(10,2) NOT NULL,
  `costo_servicio` decimal(10,2) DEFAULT NULL,
  `proximo_servicio_km` decimal(10,2) DEFAULT NULL,
  `notas` text DEFAULT NULL,
  PRIMARY KEY (`id_servicio`),
  KEY `id_vehiculo` (`id_vehiculo`),
  KEY `id_tipo_servicio` (`id_tipo_servicio`),
  CONSTRAINT `servicios_vehiculo_ibfk_1` FOREIGN KEY (`id_vehiculo`) REFERENCES `vehiculos` (`id_vehiculo`),
  CONSTRAINT `servicios_vehiculo_ibfk_2` FOREIGN KEY (`id_tipo_servicio`) REFERENCES `tipos_servicio` (`id_tipo_servicio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Tabla: sublotes_maduracion
-- ----------------------------
DROP TABLE IF EXISTS `sublotes_maduracion`;
CREATE TABLE `sublotes_maduracion` (
  `id_sublote` int(11) NOT NULL AUTO_INCREMENT,
  `id_lote_mp` int(11) NOT NULL,
  `codigo_sublote` varchar(10) NOT NULL DEFAULT 'A',
  `peso_inicial_kg` decimal(10,2) NOT NULL,
  `peso_kg` decimal(10,2) NOT NULL,
  `peso_neto_maduracion_kg` decimal(10,2) DEFAULT NULL,
  `perdida_maduracion_kg` decimal(10,2) DEFAULT NULL,
  `cantidad_unidades` int(11) DEFAULT NULL,
  `estado_maduracion` enum('Verde','Sarazo','Maduro','Sobre maduro') NOT NULL DEFAULT 'Verde',
  `estado_registro` enum('Activo','Listo para produccion','Enviado a produccion','Derivado a red','Inactivo') NOT NULL DEFAULT 'Activo',
  `observaciones` text DEFAULT NULL,
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_sublote`),
  KEY `fk_sublote_lote` (`id_lote_mp`),
  CONSTRAINT `fk_sublote_lote` FOREIGN KEY (`id_lote_mp`) REFERENCES `lotes_materia_prima` (`id_lote_mp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Tabla: tipos_servicio
-- ----------------------------
DROP TABLE IF EXISTS `tipos_servicio`;
CREATE TABLE `tipos_servicio` (
  `id_tipo_servicio` int(11) NOT NULL AUTO_INCREMENT,
  `nombre_servicio` varchar(100) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `km_frecuencia` int(11) DEFAULT NULL,
  PRIMARY KEY (`id_tipo_servicio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Tabla: usuarios
-- ----------------------------
DROP TABLE IF EXISTS `usuarios`;
CREATE TABLE `usuarios` (
  `id_usuario` int(11) NOT NULL AUTO_INCREMENT,
  `nombre_completo` varchar(100) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `rol` enum('Administrador','Produccion','Logistica','Piloto') NOT NULL,
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `estado_registro` enum('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  `fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_usuario`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Tabla: vehiculos
-- ----------------------------
DROP TABLE IF EXISTS `vehiculos`;
CREATE TABLE `vehiculos` (
  `id_vehiculo` int(11) NOT NULL AUTO_INCREMENT,
  `placa` varchar(15) NOT NULL,
  `modelo` varchar(50) DEFAULT NULL,
  `estado` enum('Disponible','En Ruta','Mantenimiento') DEFAULT 'Disponible',
  `kilometraje_actual` decimal(10,2) DEFAULT 0.00,
  `estado_registro` enum('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  `fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_vehiculo`),
  UNIQUE KEY `placa` (`placa`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- Despues de desplegar, crea un usuario Administrador (hash bcrypt de 10 rondas) para poder
-- iniciar sesion, por ejemplo insertando directamente en `usuarios` o via un script de siembra.
