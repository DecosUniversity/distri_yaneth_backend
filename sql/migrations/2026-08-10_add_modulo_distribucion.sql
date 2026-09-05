SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS pedidos (
  id_pedido INT AUTO_INCREMENT PRIMARY KEY,
  id_cliente INT NOT NULL,
  estado ENUM('Pendiente','Preparado','En Ruta','Entregado','Con Devolucion','Cancelado')
    NOT NULL DEFAULT 'Pendiente',
  observaciones TEXT NULL,
  id_usuario_creacion INT NOT NULL,
  id_usuario_modificacion INT NULL,
  estado_registro ENUM('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pedido_cliente FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente),
  CONSTRAINT fk_pedido_usuario FOREIGN KEY (id_usuario_creacion) REFERENCES usuarios(id_usuario),
  CONSTRAINT fk_pedido_usuario_mod FOREIGN KEY (id_usuario_modificacion) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;

-- Varios productos por pedido
CREATE TABLE IF NOT EXISTS pedido_detalle (
  id_detalle INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido INT NOT NULL,
  id_producto INT NOT NULL,
  cantidad DECIMAL(10,2) NOT NULL,
  estado_entrega ENUM('Pendiente','Entregado','Devuelto') NOT NULL DEFAULT 'Pendiente',
  CONSTRAINT fk_detalle_pedido FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido),
  CONSTRAINT fk_detalle_producto FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rutas_entrega (
  id_ruta INT AUTO_INCREMENT PRIMARY KEY,
  id_vehiculo INT NOT NULL,
  id_piloto INT NOT NULL,
  estado ENUM('Preparado','En Ruta','Cerrada') NOT NULL DEFAULT 'Preparado',
  km_salida DECIMAL(12,2) NULL,
  km_llegada DECIMAL(12,2) NULL,
  galones_combustible DECIMAL(10,2) NULL,
  fecha_salida DATETIME NULL,
  fecha_llegada DATETIME NULL,
  id_usuario_creacion INT NOT NULL,
  id_usuario_modificacion INT NULL,
  estado_registro ENUM('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ruta_vehiculo FOREIGN KEY (id_vehiculo) REFERENCES vehiculos(id_vehiculo),
  CONSTRAINT fk_ruta_piloto FOREIGN KEY (id_piloto) REFERENCES usuarios(id_usuario),
  CONSTRAINT fk_ruta_usuario FOREIGN KEY (id_usuario_creacion) REFERENCES usuarios(id_usuario),
  CONSTRAINT fk_ruta_usuario_mod FOREIGN KEY (id_usuario_modificacion) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;

-- Manifiesto: varios pedidos por ruta
CREATE TABLE IF NOT EXISTS ruta_pedidos (
  id_ruta INT NOT NULL,
  id_pedido INT NOT NULL,
  orden_entrega INT NULL,
  PRIMARY KEY (id_ruta, id_pedido),
  CONSTRAINT fk_rp_ruta FOREIGN KEY (id_ruta) REFERENCES rutas_entrega(id_ruta),
  CONSTRAINT fk_rp_pedido FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido)
) ENGINE=InnoDB;

-- Recepcion de devoluciones: paso manual y separado (alguien confirma que el producto
-- volvio fisicamente). No se genera automaticamente al cerrar la ruta: las lineas no
-- entregadas quedan en pedido_detalle.estado_entrega = 'Pendiente' hasta que un usuario
-- de logistica/bodega la reciba aqui explicitamente. Despues (puede ser otro momento/
-- otro usuario) se resuelve que pasa con el producto.
CREATE TABLE IF NOT EXISTS devoluciones_pedido (
  id_devolucion INT AUTO_INCREMENT PRIMARY KEY,
  id_detalle INT NOT NULL,
  cantidad_devuelta DECIMAL(10,2) NOT NULL,
  motivo TEXT NULL,
  resolucion ENUM('Pendiente de revision','Reingresado a inventario','Perdida')
    NOT NULL DEFAULT 'Pendiente de revision',
  id_usuario_recepcion INT NOT NULL,
  id_usuario_resolucion INT NULL,
  fecha_recepcion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_resolucion DATETIME NULL,
  CONSTRAINT fk_devolucion_detalle FOREIGN KEY (id_detalle) REFERENCES pedido_detalle(id_detalle),
  CONSTRAINT fk_devolucion_recepcion FOREIGN KEY (id_usuario_recepcion) REFERENCES usuarios(id_usuario),
  CONSTRAINT fk_devolucion_resolucion FOREIGN KEY (id_usuario_resolucion) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;
