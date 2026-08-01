ALTER TABLE lotes_materia_prima
  ADD COLUMN id_entrada_origen INT NULL AFTER id_proveedor;

ALTER TABLE lotes_materia_prima
  ADD CONSTRAINT fk_lotes_entrada_origen
    FOREIGN KEY (id_entrada_origen) REFERENCES entradas_mercancia(id_entrada);
