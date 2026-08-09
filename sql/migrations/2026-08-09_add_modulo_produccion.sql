-- Iteracion 3 (REQ003): Modulo de Produccion y Rendimiento
--
-- NOTA: procesos_produccion ya existia en la base de datos con un diseño
-- ad-hoc (id_operador, peso_ingreso_real, temperatura_fritura,
-- fecha_ingreso_congelado, estado_proceso con 'Enfriamiento'/'Congelado')
-- que nunca quedo documentado en una migracion. No se reconocio ese diseño,
-- asi que esta migracion lo reemplaza por el esquema generico del modulo
-- (la tabla estaba vacia, 0 filas, sin riesgo de perdida de datos).

-- Control de consumo del lote de materia prima: un lote puede alimentar
-- mas de un proceso de produccion, asi que hay que saber cuanto queda disponible.
ALTER TABLE lotes_materia_prima
  ADD COLUMN peso_consumido_kg DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER peso_inicial_kg,
  ADD COLUMN peso_disponible_kg DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER peso_consumido_kg;

UPDATE lotes_materia_prima
SET peso_disponible_kg = peso_inicial_kg
WHERE peso_consumido_kg = 0;

-- Reemplaza los campos ad-hoc de procesos_produccion por el esquema del modulo.
ALTER TABLE procesos_produccion
  DROP FOREIGN KEY procesos_produccion_ibfk_2;

ALTER TABLE procesos_produccion
  DROP COLUMN id_operador,
  DROP COLUMN peso_ingreso_real,
  DROP COLUMN temperatura_fritura,
  DROP COLUMN fecha_ingreso_congelado;

ALTER TABLE procesos_produccion
  MODIFY COLUMN estado_proceso ENUM('En proceso', 'Pausado', 'Finalizado') NOT NULL DEFAULT 'En proceso',
  ADD COLUMN id_producto_resultado INT NULL AFTER id_lote_mp,
  ADD COLUMN cantidad_ingresada_kg DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER id_producto_resultado,
  ADD COLUMN cantidad_producida_kg DECIMAL(10,2) NULL AFTER cantidad_ingresada_kg,
  ADD COLUMN rendimiento_porcentaje DECIMAL(6,2) NULL AFTER cantidad_producida_kg,
  ADD COLUMN fecha_fin DATETIME NULL AFTER fecha_inicio,
  ADD COLUMN cuarto_congelado VARCHAR(120) NULL AFTER fecha_fin,
  ADD COLUMN ubicacion_cuarto_congelado VARCHAR(120) NULL AFTER cuarto_congelado,
  ADD COLUMN observaciones TEXT NULL AFTER ubicacion_cuarto_congelado,
  ADD COLUMN id_usuario_registro INT NULL AFTER observaciones,
  ADD COLUMN estado_registro ENUM('Activo', 'Inactivo') NOT NULL DEFAULT 'Activo' AFTER id_usuario_registro,
  ADD COLUMN fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER estado_registro,
  ADD COLUMN fecha_modificacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER fecha_creacion;

ALTER TABLE procesos_produccion
  ADD CONSTRAINT fk_produccion_producto
    FOREIGN KEY (id_producto_resultado) REFERENCES productos(id_producto),
  ADD CONSTRAINT fk_produccion_usuario
    FOREIGN KEY (id_usuario_registro) REFERENCES usuarios(id_usuario);

CREATE TABLE IF NOT EXISTS produccion_etapas (
  id_etapa INT AUTO_INCREMENT PRIMARY KEY,
  id_proceso INT NOT NULL,
  nombre_etapa ENUM('Pelado', 'Corte', 'Fritura', 'Embalaje') NOT NULL,
  fecha_inicio DATETIME NOT NULL,
  fecha_fin DATETIME NULL,
  personal_asignado VARCHAR(150) NOT NULL,
  cantidad_entrada_kg DECIMAL(10,2) NULL,
  cantidad_salida_kg DECIMAL(10,2) NULL,
  merma_kg DECIMAL(10,2) NULL,
  observaciones TEXT NULL,
  estado_registro ENUM('Activo', 'Inactivo') NOT NULL DEFAULT 'Activo',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_produccion_etapas_proceso
    FOREIGN KEY (id_proceso) REFERENCES procesos_produccion(id_proceso)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS produccion_mermas (
  id_merma INT AUTO_INCREMENT PRIMARY KEY,
  id_proceso INT NOT NULL,
  id_etapa INT NULL,
  categoria_merma ENUM('Cascara', 'Punta', 'Cuaches', 'Coccion', 'Quemados', 'Otra') NOT NULL,
  cantidad_kg DECIMAL(10,2) NOT NULL,
  observaciones TEXT NULL,
  fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado_registro ENUM('Activo', 'Inactivo') NOT NULL DEFAULT 'Activo',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_produccion_mermas_proceso
    FOREIGN KEY (id_proceso) REFERENCES procesos_produccion(id_proceso),
  CONSTRAINT fk_produccion_mermas_etapa
    FOREIGN KEY (id_etapa) REFERENCES produccion_etapas(id_etapa)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS produccion_insumos (
  id_consumo INT AUTO_INCREMENT PRIMARY KEY,
  id_proceso INT NOT NULL,
  id_etapa INT NULL,
  tipo_insumo ENUM('Aceite', 'Bolsas de empaque', 'Bolsas de basura', 'Otro') NOT NULL,
  cantidad DECIMAL(10,2) NOT NULL,
  unidad_medida VARCHAR(20) NOT NULL DEFAULT 'Unidad',
  observaciones TEXT NULL,
  fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado_registro ENUM('Activo', 'Inactivo') NOT NULL DEFAULT 'Activo',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_produccion_insumos_proceso
    FOREIGN KEY (id_proceso) REFERENCES procesos_produccion(id_proceso),
  CONSTRAINT fk_produccion_insumos_etapa
    FOREIGN KEY (id_etapa) REFERENCES produccion_etapas(id_etapa)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS produccion_cuartos_frio (
  id_ingreso_cuarto INT AUTO_INCREMENT PRIMARY KEY,
  id_proceso INT NOT NULL,
  fecha_ingreso DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ubicacion_cuarto VARCHAR(120) NOT NULL,
  cantidad_kg DECIMAL(10,2) NOT NULL,
  observaciones TEXT NULL,
  estado_registro ENUM('Activo', 'Inactivo') NOT NULL DEFAULT 'Activo',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_produccion_cuartos_proceso
    FOREIGN KEY (id_proceso) REFERENCES procesos_produccion(id_proceso)
) ENGINE=InnoDB;
