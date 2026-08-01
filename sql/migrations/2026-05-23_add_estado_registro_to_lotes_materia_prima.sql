ALTER TABLE lotes_materia_prima
  ADD COLUMN estado_registro ENUM('Pendiente', 'Activo', 'Completo', 'Inactivo') NOT NULL DEFAULT 'Pendiente' AFTER peso_inicial_kg;

UPDATE lotes_materia_prima
SET estado_registro = CASE
  WHEN estado_maduracion = 'Listo para produccion' THEN 'Completo'
  ELSE 'Activo'
END;