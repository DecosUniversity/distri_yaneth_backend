-- Reformulacion de Maduracion: un lote de materia prima deja de madurar como unidad
-- indivisible. La unidad real de maduracion/produccion pasa a ser el sub-lote.
-- Ortografia de estado_maduracion confirmada: 'Sarazo' y 'Sobre maduro' (igual al frontend actual).
-- Umbral tecnico de Grados Brix para promocion automatica: configurable via
-- MATURATION_BRIX_THRESHOLD (valor por defecto 22 en el codigo, no en la BD).

CREATE TABLE IF NOT EXISTS sublotes_maduracion (
  id_sublote INT AUTO_INCREMENT PRIMARY KEY,
  id_lote_mp INT NOT NULL,
  codigo_sublote VARCHAR(10) NOT NULL DEFAULT 'A',
  peso_inicial_kg DECIMAL(10,2) NOT NULL,
  peso_kg DECIMAL(10,2) NOT NULL,
  peso_neto_maduracion_kg DECIMAL(10,2) NULL,
  perdida_maduracion_kg DECIMAL(10,2) NULL,
  cantidad_unidades INT NULL,
  estado_maduracion ENUM('Verde', 'Sarazo', 'Maduro', 'Sobre maduro') NOT NULL DEFAULT 'Verde',
  estado_registro ENUM('Activo', 'Listo para produccion', 'Enviado a produccion', 'Derivado a red', 'Inactivo')
    NOT NULL DEFAULT 'Activo',
  observaciones TEXT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sublote_lote FOREIGN KEY (id_lote_mp) REFERENCES lotes_materia_prima(id_lote_mp)
) ENGINE=InnoDB;

-- control_maduracion pasa a medir el sub-lote. listo_para_proceso queda superado por
-- sublotes_maduracion.estado_registro (una sola fuente de verdad para ese estado);
-- porcentaje_materia_seca se conserva como metrica adicional disponible a futuro.
ALTER TABLE control_maduracion
  DROP FOREIGN KEY control_maduracion_ibfk_1,
  DROP COLUMN id_lote_mp,
  DROP COLUMN listo_para_proceso,
  ADD COLUMN id_sublote INT NOT NULL AFTER id_control,
  ADD COLUMN peso_medido_kg DECIMAL(10,2) NULL AFTER grados_brix,
  ADD CONSTRAINT fk_control_sublote FOREIGN KEY (id_sublote) REFERENCES sublotes_maduracion(id_sublote);

-- Detalle de cada red de platano verde empacada (peso variable por unidad).
CREATE TABLE IF NOT EXISTS redes_verde_detalle (
  id_red INT AUTO_INCREMENT PRIMARY KEY,
  id_sublote INT NOT NULL,
  id_existencia INT NOT NULL,
  peso_kg DECIMAL(10,2) NOT NULL,
  id_usuario INT NOT NULL,
  fecha_empaque TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_red_sublote FOREIGN KEY (id_sublote) REFERENCES sublotes_maduracion(id_sublote),
  CONSTRAINT fk_red_existencia FOREIGN KEY (id_existencia) REFERENCES inventario_existencias(id_existencia),
  CONSTRAINT fk_red_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;

-- Produccion pasa a trabajar sobre el sub-lote listo, no sobre el lote completo.
ALTER TABLE procesos_produccion
  DROP FOREIGN KEY procesos_produccion_ibfk_1;

ALTER TABLE procesos_produccion
  CHANGE COLUMN id_lote_mp id_sublote INT NULL;

ALTER TABLE procesos_produccion
  ADD CONSTRAINT fk_produccion_sublote FOREIGN KEY (id_sublote) REFERENCES sublotes_maduracion(id_sublote);

-- El consumo disponible ahora se trackea por sub-lote (sublotes_maduracion.peso_kg), no por lote.
ALTER TABLE lotes_materia_prima
  DROP COLUMN peso_consumido_kg,
  DROP COLUMN peso_disponible_kg;
