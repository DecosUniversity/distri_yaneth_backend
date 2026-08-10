-- Las etapas de produccion pasan a registrarse en dos pasos (iniciar / finalizar) mas edicion
-- posterior, para poder tomar tiempos exactos y capturar la merma cuando este disponible.
-- cantidad_personas es el dato obligatorio ("cuantas personas estan involucradas");
-- personal_asignado (nombres) pasa a ser opcional.
ALTER TABLE produccion_etapas
  ADD COLUMN cantidad_personas INT NULL AFTER nombre_etapa,
  MODIFY COLUMN personal_asignado VARCHAR(150) NULL;
