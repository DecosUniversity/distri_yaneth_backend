
-- Migration (MySQL): crea la tabla de unidades pequeñas asociadas a una entrada de mercancía
-- Contendrá referencia a la entrada, peso por unidad, usuario que registró y fecha de pesaje

CREATE TABLE IF NOT EXISTS entrada_unidades (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_entrada INT NOT NULL,
  unidad_codigo VARCHAR(100),
  peso DECIMAL(12,4) NOT NULL,
  creado_por INT NOT NULL,
  fecha_pesos DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_entrada FOREIGN KEY (id_entrada) REFERENCES entradas_mercancia(id_entrada) ON DELETE CASCADE
);

CREATE INDEX idx_entrada_unidades_id_entrada ON entrada_unidades(id_entrada);
