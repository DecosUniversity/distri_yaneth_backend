-- Migracion incremental: bitacora de kilometraje por vehiculo
-- Fecha: 2026-04-27

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS reporte_kilometraje_vehiculo (
  id_reporte_kilometraje INT AUTO_INCREMENT PRIMARY KEY,
  id_vehiculo INT NOT NULL,
  id_usuario_modificador INT NOT NULL,
  kilometraje_registrado DECIMAL(12,2) NOT NULL,
  fecha_reporte TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reporte_kilometraje_vehiculo
    FOREIGN KEY (id_vehiculo) REFERENCES vehiculos(id_vehiculo),
  CONSTRAINT fk_reporte_kilometraje_usuario
    FOREIGN KEY (id_usuario_modificador) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;