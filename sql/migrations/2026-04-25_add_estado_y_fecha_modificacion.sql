-- Migracion completa de esquema base
-- Fecha: 2026-04-25
-- Objetivo: crear tablas completas con estado_registro y fecha_modificacion
-- Recomendado para base limpia (nueva)

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Si quieres reiniciar todo en una base de pruebas, descomenta estas lineas:
-- DROP TABLE IF EXISTS movimientos_inventario;
-- DROP TABLE IF EXISTS inventario_existencias;
-- DROP TABLE IF EXISTS entradas_mercancia;
-- DROP TABLE IF EXISTS control_maduracion;
-- DROP TABLE IF EXISTS lotes_materia_prima;
-- DROP TABLE IF EXISTS tipos_servicio;
-- DROP TABLE IF EXISTS vehiculos;
-- DROP TABLE IF EXISTS productos;
-- DROP TABLE IF EXISTS clientes;
-- DROP TABLE IF EXISTS proveedores;
-- DROP TABLE IF EXISTS procesos_produccion;
-- DROP TABLE IF EXISTS usuarios;

CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario INT AUTO_INCREMENT PRIMARY KEY,
  nombre_completo VARCHAR(120) NOT NULL,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('Administrador', 'Produccion', 'Logistica', 'Piloto') NOT NULL DEFAULT 'Piloto',
  estado_registro ENUM('Activo', 'Inactivo') NOT NULL DEFAULT 'Activo',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS proveedores (
  id_proveedor INT AUTO_INCREMENT PRIMARY KEY,
  nombre_empresa VARCHAR(100) NOT NULL,
  nit VARCHAR(20),
  contacto_nombre VARCHAR(100),
  telefono VARCHAR(20),
  estado_registro ENUM('Activo', 'Inactivo') NOT NULL DEFAULT 'Activo',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clientes (
  id_cliente INT AUTO_INCREMENT PRIMARY KEY,
  nombre_comercial VARCHAR(150) NOT NULL,
  direccion_entrega TEXT,
  telefono VARCHAR(20),
  nit_facturacion VARCHAR(20),
  estado_registro ENUM('Activo', 'Inactivo') NOT NULL DEFAULT 'Activo',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS productos (
  id_producto INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  unidad_medida VARCHAR(20),
  tipo_producto ENUM('Materia Prima', 'Producto Terminado', 'Insumo', 'Venta Directa') NOT NULL,
  stock_minimo DECIMAL(10,2) NOT NULL DEFAULT 10.00,
  precio_venta_sugerido DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  estado_registro ENUM('Activo', 'Inactivo') NOT NULL DEFAULT 'Activo',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tipos_servicio (
  id_tipo_servicio INT AUTO_INCREMENT PRIMARY KEY,
  nombre_servicio VARCHAR(100) NOT NULL,
  descripcion TEXT,
  km_frecuencia INT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS lotes_materia_prima (
  id_lote_mp INT AUTO_INCREMENT PRIMARY KEY,
  id_producto INT NULL,
  id_proveedor INT NULL,
  fecha_recepcion DATE NOT NULL,
  cantidad_unidades INT NULL,
  peso_inicial_kg DECIMAL(10,2) NOT NULL,
  estado_maduracion VARCHAR(50) DEFAULT 'Verde',
  CONSTRAINT fk_lotes_producto
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto),
  CONSTRAINT fk_lotes_proveedor
    FOREIGN KEY (id_proveedor) REFERENCES proveedores(id_proveedor)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS control_maduracion (
  id_control INT AUTO_INCREMENT PRIMARY KEY,
  id_lote_mp INT NULL,
  fecha_medicion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  grados_brix DECIMAL(5,2) NOT NULL,
  temperatura_cuarto DECIMAL(5,2) NULL,
  observaciones TEXT NULL,
  CONSTRAINT fk_control_lote
    FOREIGN KEY (id_lote_mp) REFERENCES lotes_materia_prima(id_lote_mp)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vehiculos (
  id_vehiculo INT AUTO_INCREMENT PRIMARY KEY,
  placa VARCHAR(20) NOT NULL UNIQUE,
  modelo VARCHAR(100),
  estado ENUM('Disponible', 'En ruta', 'Mantenimiento', 'Inactivo') NOT NULL DEFAULT 'Disponible',
  kilometraje_actual DECIMAL(12,2) NOT NULL DEFAULT 0,
  estado_registro ENUM('Activo', 'Inactivo') NOT NULL DEFAULT 'Activo',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Tabla minima para satisfacer FK de inventario (expande luego segun tu flujo real)
CREATE TABLE IF NOT EXISTS procesos_produccion (
  id_proceso INT AUTO_INCREMENT PRIMARY KEY,
  descripcion VARCHAR(255),
  estado_registro ENUM('Activo', 'Inactivo') NOT NULL DEFAULT 'Activo',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS entradas_mercancia (
  id_entrada INT AUTO_INCREMENT PRIMARY KEY,
  id_proveedor INT NOT NULL,
  fecha_recepcion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  documento_referencia VARCHAR(50),
  id_usuario_receptor INT NOT NULL,
  estado_registro ENUM('Activo', 'Inactivo') NOT NULL DEFAULT 'Activo',
  fecha_modificacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_entradas_proveedor
    FOREIGN KEY (id_proveedor) REFERENCES proveedores(id_proveedor),
  CONSTRAINT fk_entradas_usuario
    FOREIGN KEY (id_usuario_receptor) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventario_existencias (
  id_existencia INT AUTO_INCREMENT PRIMARY KEY,
  id_producto INT NOT NULL,
  id_proveedor INT NOT NULL,
  id_proceso_origen INT NULL,
  id_entrada_origen INT NULL,
  fecha_entrada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_vencimiento DATE NOT NULL,
  cantidad_disponible DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  costo_unitario DECIMAL(10,2),
  estado_registro ENUM('Activo', 'Inactivo') NOT NULL DEFAULT 'Activo',
  fecha_modificacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_existencias_producto
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto),
  CONSTRAINT fk_existencias_proveedor
    FOREIGN KEY (id_proveedor) REFERENCES proveedores(id_proveedor),
  CONSTRAINT fk_existencias_proceso
    FOREIGN KEY (id_proceso_origen) REFERENCES procesos_produccion(id_proceso),
  CONSTRAINT fk_existencias_entrada
    FOREIGN KEY (id_entrada_origen) REFERENCES entradas_mercancia(id_entrada)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id_movimiento INT AUTO_INCREMENT PRIMARY KEY,
  id_existencia INT NOT NULL,
  tipo_movimiento ENUM('Entrada', 'Salida', 'Ajuste', 'Desperdicio') NOT NULL,
  cantidad DECIMAL(10,2) NOT NULL,
  motivo VARCHAR(255),
  fecha_movimiento TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  id_usuario INT NULL,
  estado_registro ENUM('Activo', 'Inactivo') NOT NULL DEFAULT 'Activo',
  fecha_modificacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_movimientos_existencia
    FOREIGN KEY (id_existencia) REFERENCES inventario_existencias(id_existencia),
  CONSTRAINT fk_movimientos_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;

-- Trigger de stock (crear o reemplazar)
DROP TRIGGER IF EXISTS tr_actualizar_stock_existencia;

DELIMITER //
CREATE TRIGGER tr_actualizar_stock_existencia
AFTER INSERT ON movimientos_inventario
FOR EACH ROW
BEGIN
  IF NEW.tipo_movimiento = 'Entrada' THEN
    UPDATE inventario_existencias
    SET cantidad_disponible = cantidad_disponible + NEW.cantidad
    WHERE id_existencia = NEW.id_existencia;
  ELSEIF NEW.tipo_movimiento IN ('Salida', 'Ajuste', 'Desperdicio') THEN
    UPDATE inventario_existencias
    SET cantidad_disponible = cantidad_disponible - NEW.cantidad
    WHERE id_existencia = NEW.id_existencia;
  END IF;
END//
DELIMITER ;

-- Notas:
-- 1) Este script define estructura completa para ambientes nuevos.
-- 2) Para ambiente en produccion con datos existentes, usa una migracion incremental (ALTER).
-- 3) Si deseas borrado logico, backend debe usar UPDATE estado_registro='Inactivo' en lugar de DELETE.
