-- Reemplaza el codigo de trazabilidad P/E/L/PT (basado en IDs internos) por un codigo
-- legible generado en el servidor: ABREVIATURA_PRODUCTO-YYMMDD-### (secuencia diaria por
-- producto). El codigo se guarda una sola vez, al crear la entrada de mercancia, y toda la
-- familia de sublotes/redes/procesos que se derivan de ella comparten el mismo codigo.

ALTER TABLE entradas_mercancia
  ADD COLUMN codigo_lote VARCHAR(30) NULL,
  ADD UNIQUE KEY uq_entradas_codigo_lote (codigo_lote);
