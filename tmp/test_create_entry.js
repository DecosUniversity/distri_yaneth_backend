const mysql = require('mysql2/promise');

(async () => {
  const pool = await mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'dercas_sistema',
    port: 3306,
  });

  try {
    const [provRows] = await pool.query("SELECT id_proveedor FROM proveedores WHERE estado_registro='Activo' LIMIT 1");
    const [prodRows] = await pool.query("SELECT id_producto FROM productos WHERE estado_registro='Activo' LIMIT 1");
    const [userRows] = await pool.query("SELECT id_usuario FROM usuarios WHERE estado_registro='Activo' LIMIT 1");

    const prov = provRows[0];
    const prod = prodRows[0];
    const user = userRows[0];

    if (!prov || !prod || !user) {
      console.error('Missing provider/product/user. Found:', { prov, prod, user });
      process.exit(1);
    }

    const id_proveedor = prov.id_proveedor;
    const id_producto = prod.id_producto;
    const id_usuario_receptor = user.id_usuario;

    await pool.query('START TRANSACTION');

    const [entryResult] = await pool.query(
      'INSERT INTO entradas_mercancia (id_proveedor, documento_referencia, id_usuario_receptor, estado_registro) VALUES (?, ?, ?, ?)',
      [id_proveedor, 'Prueba API', id_usuario_receptor, 'Activo']
    );

    const insertedEntryId = entryResult.insertId;

    const [lotResult] = await pool.query(
      'INSERT INTO lotes_materia_prima (id_producto, id_proveedor, id_entrada_origen, fecha_recepcion, cantidad_unidades, peso_inicial_kg, estado_maduracion) VALUES (?, ?, ?, CURRENT_DATE, ?, ?, ?)',
      [id_producto, id_proveedor, insertedEntryId, null, 0, 'Verde']
    );

    await pool.query('COMMIT');

    const [lotRows] = await pool.query('SELECT id_lote_mp, id_entrada_origen, fecha_recepcion FROM lotes_materia_prima WHERE id_lote_mp = ?', [lotResult.insertId]);

    console.log('OK', JSON.stringify({ entryId: insertedEntryId, lot: lotRows[0] }, null, 2));
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('ERROR', error.message || error);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
