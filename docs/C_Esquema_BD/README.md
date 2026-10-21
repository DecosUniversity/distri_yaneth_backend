# Apéndice C — Esquema de la base de datos

El esquema se mantiene junto al código para que no exista una copia desactualizada:

| Archivo | Contenido |
|---|---|
| [`sql/schema.sql`](../../sql/schema.sql) | Esquema consolidado (34 tablas, InnoDB, utf8mb4) con llaves primarias, foráneas e índices únicos. Generado el 2026-10-09. |
| [`sql/migrations/`](../../sql/migrations/) | Cambios incrementales fechados (`AAAA-MM-DD_descripcion.sql`) para actualizar bases ya existentes. |
| [`diagramas/base_datos/diagrama_er.png`](../../diagramas/base_datos/diagrama_er.png) | Diagrama entidad-relación (fuente PlantUML en `diagrama_er.puml`). |

## Uso

- **Instalación nueva:** crear la base vacía y ejecutar `schema.sql` completo. No se ejecutan migraciones.
- **Base existente:** aplicar en orden de fecha solo las migraciones posteriores a la última aplicada.

> `schema.sql` elimina y vuelve a crear cada tabla (`DROP TABLE IF EXISTS`). Nunca debe ejecutarse sobre una base con datos.

El esquema no incluye usuarios; el administrador inicial se crea como indica el Manual técnico (Apéndice A, sección 5.2, actividad 2.3).

## Tablas por área

| Área | Tablas |
|---|---|
| Seguridad y auditoría | `usuarios`, `auditoria_cambios` |
| Catálogos | `productos`, `proveedores`, `clientes`, `cat_tipos_etapa`, `cat_tipos_merma`, `cat_cuartos_frio`, `producto_etapas_requeridas`, `recetas` |
| Recepción y maduración | `entradas_mercancia`, `entrada_unidades`, `lotes_materia_prima`, `sublotes_maduracion`, `control_maduracion` |
| Producción | `ordenes_produccion`, `procesos_produccion`, `produccion_etapas`, `produccion_mermas`, `produccion_insumos`, `produccion_cuartos_frio`, `etapas_empaque_detalle`, `redes_verde_detalle` |
| Inventario | `inventario_existencias`, `movimientos_inventario` |
| Distribución | `pedidos`, `pedido_detalle`, `rutas_entrega`, `ruta_pedidos`, `devoluciones_pedido` |
| Flota | `vehiculos`, `tipos_servicio`, `servicios_vehiculo`, `reporte_kilometraje_vehiculo` |
