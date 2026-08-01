UPDATE lotes_materia_prima l
JOIN (
  SELECT id_lote_mp,
         id_proveedor,
         DATE(fecha_recepcion) AS fecha_recepcion,
         ROW_NUMBER() OVER (PARTITION BY id_proveedor, DATE(fecha_recepcion) ORDER BY id_lote_mp DESC) AS rn
  FROM lotes_materia_prima
  WHERE id_entrada_origen IS NULL
) lots ON lots.id_lote_mp = l.id_lote_mp
JOIN (
  SELECT id_entrada,
         id_proveedor,
         DATE(fecha_recepcion) AS fecha_recepcion,
         ROW_NUMBER() OVER (PARTITION BY id_proveedor, DATE(fecha_recepcion) ORDER BY id_entrada DESC) AS rn
  FROM entradas_mercancia
  WHERE estado_registro = 'Activo'
) entries
  ON entries.id_proveedor = lots.id_proveedor
 AND entries.fecha_recepcion = lots.fecha_recepcion
 AND entries.rn = lots.rn
SET l.id_entrada_origen = entries.id_entrada
WHERE l.id_entrada_origen IS NULL;
