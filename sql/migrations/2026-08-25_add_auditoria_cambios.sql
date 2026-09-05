-- Historial completo de cambios (valores anteriores/nuevos) para todas las escrituras
-- que pasan por el worker de la cola (src/workers/domains/*). A diferencia de
-- id_usuario_modificacion (quien toco el registro por ultima vez), esta tabla guarda
-- una fila por cada operacion con el estado antes y despues en JSON.

CREATE TABLE IF NOT EXISTS auditoria_cambios (
  id_auditoria INT AUTO_INCREMENT PRIMARY KEY,
  tabla_afectada VARCHAR(64) NOT NULL,
  id_registro_afectado VARCHAR(64) NULL,
  accion ENUM('Creacion', 'Actualizacion', 'Eliminacion') NOT NULL,
  valores_anteriores JSON NULL,
  valores_nuevos JSON NULL,
  id_usuario INT NULL,
  fecha_accion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_auditoria_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
  INDEX idx_auditoria_tabla_registro (tabla_afectada, id_registro_afectado),
  INDEX idx_auditoria_fecha (fecha_accion)
);
