-- Permite registrar redes verdes por caja en vez de una a una: cada fila de
-- redes_verde_detalle pasa a representar una CAJA (cantidad_redes que contiene +
-- peso_kg total de esa caja), en vez de una sola red individual. Las filas existentes
-- quedan como cajas de 1 red (semanticamente equivalente a lo que ya representaban).
ALTER TABLE redes_verde_detalle
  ADD COLUMN cantidad_redes INT NOT NULL DEFAULT 1;
