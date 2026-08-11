-- Adds "last modified by" tracking (id_usuario_modificacion) to every actively-used table,
-- so reports can show who last touched a record and when (fecha_modificacion already
-- auto-updates via ON UPDATE CURRENT_TIMESTAMP on tables that had it; added where missing).
-- Only touches tables wired to a live route in src/app.js; legacy/unused tables
-- (pedidos, detalle_pedido, recetas, control_combustible, despachos_logistica) are skipped.

ALTER TABLE usuarios
  ADD COLUMN id_usuario_modificacion INT NULL,
  ADD CONSTRAINT fk_usuarios_usuario_mod FOREIGN KEY (id_usuario_modificacion) REFERENCES usuarios(id_usuario);

ALTER TABLE proveedores
  ADD COLUMN id_usuario_modificacion INT NULL,
  ADD CONSTRAINT fk_proveedores_usuario_mod FOREIGN KEY (id_usuario_modificacion) REFERENCES usuarios(id_usuario);

ALTER TABLE clientes
  ADD COLUMN id_usuario_modificacion INT NULL,
  ADD CONSTRAINT fk_clientes_usuario_mod FOREIGN KEY (id_usuario_modificacion) REFERENCES usuarios(id_usuario);

ALTER TABLE entradas_mercancia
  ADD COLUMN id_usuario_modificacion INT NULL,
  ADD CONSTRAINT fk_entradas_usuario_mod FOREIGN KEY (id_usuario_modificacion) REFERENCES usuarios(id_usuario);

-- entrada_unidades already tracks this via creado_por (int, NOT NULL) + created_at/updated_at
-- (updated_at has ON UPDATE CURRENT_TIMESTAMP) - no changes needed there.

ALTER TABLE inventario_existencias
  ADD COLUMN id_usuario_modificacion INT NULL,
  ADD CONSTRAINT fk_inventario_usuario_mod FOREIGN KEY (id_usuario_modificacion) REFERENCES usuarios(id_usuario);

ALTER TABLE lotes_materia_prima
  ADD COLUMN id_usuario_modificacion INT NULL,
  ADD CONSTRAINT fk_lotes_mp_usuario_mod FOREIGN KEY (id_usuario_modificacion) REFERENCES usuarios(id_usuario);

ALTER TABLE sublotes_maduracion
  ADD COLUMN id_usuario_modificacion INT NULL,
  ADD CONSTRAINT fk_sublotes_usuario_mod FOREIGN KEY (id_usuario_modificacion) REFERENCES usuarios(id_usuario);

ALTER TABLE control_maduracion
  ADD COLUMN id_usuario_modificacion INT NULL,
  ADD COLUMN fecha_modificacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ADD CONSTRAINT fk_control_maduracion_usuario_mod FOREIGN KEY (id_usuario_modificacion) REFERENCES usuarios(id_usuario);

ALTER TABLE productos
  ADD COLUMN id_usuario_modificacion INT NULL,
  ADD CONSTRAINT fk_productos_usuario_mod FOREIGN KEY (id_usuario_modificacion) REFERENCES usuarios(id_usuario);

ALTER TABLE procesos_produccion
  ADD COLUMN id_usuario_modificacion INT NULL,
  ADD CONSTRAINT fk_procesos_produccion_usuario_mod FOREIGN KEY (id_usuario_modificacion) REFERENCES usuarios(id_usuario);

ALTER TABLE produccion_etapas
  ADD COLUMN id_usuario_modificacion INT NULL,
  ADD CONSTRAINT fk_produccion_etapas_usuario_mod FOREIGN KEY (id_usuario_modificacion) REFERENCES usuarios(id_usuario);

ALTER TABLE produccion_mermas
  ADD COLUMN id_usuario_modificacion INT NULL,
  ADD CONSTRAINT fk_produccion_mermas_usuario_mod FOREIGN KEY (id_usuario_modificacion) REFERENCES usuarios(id_usuario);

ALTER TABLE produccion_insumos
  ADD COLUMN id_usuario_modificacion INT NULL,
  ADD CONSTRAINT fk_produccion_insumos_usuario_mod FOREIGN KEY (id_usuario_modificacion) REFERENCES usuarios(id_usuario);

ALTER TABLE produccion_cuartos_frio
  ADD COLUMN id_usuario_modificacion INT NULL,
  ADD CONSTRAINT fk_produccion_cuartos_frio_usuario_mod FOREIGN KEY (id_usuario_modificacion) REFERENCES usuarios(id_usuario);

ALTER TABLE vehiculos
  ADD COLUMN id_usuario_modificacion INT NULL,
  ADD CONSTRAINT fk_vehiculos_usuario_mod FOREIGN KEY (id_usuario_modificacion) REFERENCES usuarios(id_usuario);

ALTER TABLE servicios_vehiculo
  ADD COLUMN id_usuario_modificacion INT NULL,
  ADD COLUMN fecha_modificacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ADD CONSTRAINT fk_servicios_vehiculo_usuario_mod FOREIGN KEY (id_usuario_modificacion) REFERENCES usuarios(id_usuario);

ALTER TABLE tipos_servicio
  ADD COLUMN id_usuario_modificacion INT NULL,
  ADD COLUMN fecha_modificacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ADD CONSTRAINT fk_tipos_servicio_usuario_mod FOREIGN KEY (id_usuario_modificacion) REFERENCES usuarios(id_usuario);

ALTER TABLE cat_tipos_merma
  ADD COLUMN id_usuario_modificacion INT NULL,
  ADD CONSTRAINT fk_cat_tipos_merma_usuario_mod FOREIGN KEY (id_usuario_modificacion) REFERENCES usuarios(id_usuario);
