-- Al finalizar un proceso de produccion, el peso ingresado debe coincidir exactamente con
-- lo producido + las mermas registradas. Si no coincide, se exige justificar la diferencia.
ALTER TABLE procesos_produccion
  ADD COLUMN diferencia_kg DECIMAL(10,2) NULL,
  ADD COLUMN justificacion_diferencia TEXT NULL;
