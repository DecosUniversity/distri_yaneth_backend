// Vacia la base de datos REAL (.env, no .env.test), dejando intacta unicamente la tabla
// `usuarios`. Pensado para volver a arrancar de cero con datos de demostracion nuevos sin
// perder las cuentas reales que el usuario ya configuro.
//
// Uso: node scripts/wipe_except_usuarios.js   (desde la carpeta Backend)

require('dotenv').config();

const { pool } = require('../src/config/db');

const log = (...args) => console.log('[wipe]', ...args);

// Todas las tablas del esquema excepto `usuarios`.
const TABLES_TO_TRUNCATE = [
  'auditoria_cambios',
  'cat_tipos_merma',
  'clientes',
  'control_maduracion',
  'devoluciones_pedido',
  'entrada_unidades',
  'entradas_mercancia',
  'inventario_existencias',
  'lotes_materia_prima',
  'movimientos_inventario',
  'pedido_detalle',
  'pedidos',
  'procesos_produccion',
  'produccion_cuartos_frio',
  'produccion_etapas',
  'produccion_insumos',
  'produccion_mermas',
  'productos',
  'proveedores',
  'recetas',
  'redes_verde_detalle',
  'reporte_kilometraje_vehiculo',
  'ruta_pedidos',
  'rutas_entrega',
  'servicios_vehiculo',
  'sublotes_maduracion',
  'tipos_servicio',
  'vehiculos',
];

const main = async () => {
  const [dbNameRows] = await pool.query('SELECT DATABASE() AS db');
  const dbName = dbNameRows[0].db;
  log(`Conectado a la base de datos: ${dbName}`);

  if (dbName.endsWith('_test')) {
    throw new Error('Este script es para la base de datos real, no para la de pruebas (_test). Aborta.');
  }

  const [userRows] = await pool.query('SELECT COUNT(*) AS total FROM usuarios');
  log(`Se conservaran ${userRows[0].total} usuarios existentes.`);

  await pool.query('SET FOREIGN_KEY_CHECKS = 0');

  for (const table of TABLES_TO_TRUNCATE) {
    await pool.query(`TRUNCATE TABLE \`${table}\``);
    log(`Tabla vaciada: ${table}`);
  }

  await pool.query('SET FOREIGN_KEY_CHECKS = 1');

  log('Listo. Base de datos vacia excepto la tabla usuarios.');
};

main()
  .catch((error) => {
    console.error('[wipe] FALLO:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
