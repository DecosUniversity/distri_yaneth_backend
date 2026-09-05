-- Permite revertir un proceso de produccion "En proceso" aunque ya tenga etapas,
-- mermas o insumos registrados (antes se bloqueaba por completo). En ese caso el
-- usuario debe declarar el peso que se devuelve al sub-lote y justificar la
-- cancelacion; el worker valida que ingresado - mermas cuadre con lo declarado.
ALTER TABLE procesos_produccion
  ADD COLUMN justificacion_reversion TEXT NULL;
