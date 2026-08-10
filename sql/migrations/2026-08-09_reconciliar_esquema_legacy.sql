-- Reconciliacion de un segundo esquema legacy que existia en la BD sin codigo que lo usara.
-- mermas_produccion/consumos_produccion/detalle_cajas_lote quedan absorbidas por las tablas
-- produccion_mermas/produccion_insumos (creadas en la migracion de Produccion) y por
-- entrada_unidades (pesaje por caja). cat_tipos_merma se adopta como catalogo real de mermas
-- en vez del ENUM fijo que se uso originalmente.
-- Todas las tablas involucradas estaban vacias (0 filas) al momento de esta migracion.

DROP TABLE IF EXISTS mermas_produccion;
DROP TABLE IF EXISTS consumos_produccion;
DROP TABLE IF EXISTS detalle_cajas_lote;

ALTER TABLE cat_tipos_merma
  ADD COLUMN fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN fecha_modificacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  MODIFY COLUMN estado_registro ENUM('Activo', 'Inactivo') NOT NULL DEFAULT 'Activo';

INSERT INTO cat_tipos_merma (nombre_merma, descripcion, estado_registro) VALUES
  ('Cascara', 'Cascara retirada en pelado', 'Activo'),
  ('Punta', 'Puntas descartadas en corte', 'Activo'),
  ('Cuaches', 'Piezas deformes o defectuosas', 'Activo'),
  ('Coccion', 'Perdida durante la friture', 'Activo'),
  ('Quemados', 'Producto quemado durante la friture', 'Activo'),
  ('Otra', 'Otra categoria de merma no listada', 'Activo');

-- produccion_mermas pasa de categoria_merma (ENUM) a id_tipo_merma (catalogo)
ALTER TABLE produccion_mermas
  ADD COLUMN id_tipo_merma INT NULL AFTER id_etapa;

UPDATE produccion_mermas pm
  JOIN cat_tipos_merma ctm ON ctm.nombre_merma = pm.categoria_merma
  SET pm.id_tipo_merma = ctm.id_tipo_merma;

ALTER TABLE produccion_mermas
  MODIFY COLUMN id_tipo_merma INT NOT NULL,
  DROP COLUMN categoria_merma,
  ADD CONSTRAINT fk_produccion_mermas_tipo
    FOREIGN KEY (id_tipo_merma) REFERENCES cat_tipos_merma(id_tipo_merma);

-- produccion_insumos pasa de tipo_insumo (ENUM) a id_producto (catalogo real de productos,
-- tipo_producto = 'Insumo'), para poder descontar inventario real al consumir.
ALTER TABLE produccion_insumos
  ADD COLUMN id_producto INT NULL AFTER id_etapa;

ALTER TABLE produccion_insumos
  MODIFY COLUMN id_producto INT NOT NULL,
  DROP COLUMN tipo_insumo,
  ADD CONSTRAINT fk_produccion_insumos_producto
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto);
