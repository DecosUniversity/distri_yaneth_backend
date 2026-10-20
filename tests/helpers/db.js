const { pool } = require('../../src/config/db');

// Orden alfabetico tomado de sql/schema.sql; TRUNCATE con FK checks apagados
// evita tener que resolver el orden de dependencias a mano.
const ALL_TABLES = [
  'auditoria_cambios',
  'cat_cuartos_frio',
  'cat_tipos_etapa',
  'cat_tipos_merma',
  'clientes',
  'control_maduracion',
  'devoluciones_pedido',
  'entrada_unidades',
  'entradas_mercancia',
  'etapas_empaque_detalle',
  'inventario_existencias',
  'lotes_materia_prima',
  'movimientos_inventario',
  'ordenes_produccion',
  'pedido_detalle',
  'pedidos',
  'procesos_produccion',
  'produccion_cuartos_frio',
  'produccion_etapas',
  'produccion_insumos',
  'produccion_mermas',
  'producto_etapas_requeridas',
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
  'usuarios',
  'vehiculos',
];

// Salvaguarda: resetDatabase() hace TRUNCATE de TODAS las tablas. Si algo invoca
// las pruebas sin pasar por `npm test` (que carga .env.test via tests/setup.js),
// process.env.DB_NAME cae en el default de src/config/db.js y apunta a la base
// de datos real. Verificar el nombre de la base activa antes de truncar evita
// repetir ese incidente.
const assertTestDatabase = async () => {
  const [[{ db }]] = await pool.query('SELECT DATABASE() AS db');
  if (!db || !db.includes('test')) {
    throw new Error(
      `Salvaguarda: resetDatabase() se iba a ejecutar contra la base de datos "${db}", ` +
        'que no parece ser una base de pruebas (se espera un nombre que contenga "test"). ' +
        'Corre las pruebas con "npm test" (vitest), que carga .env.test, y no con jest ' +
        'directo ni con la base de datos real activa.'
    );
  }
};

const resetDatabase = async () => {
  await assertTestDatabase();
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');

  for (const table of ALL_TABLES) {
    await pool.query(`TRUNCATE TABLE \`${table}\``);
  }

  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
};

// Siembra el minimo de catalogo que casi toda prueba de integracion necesita
// (un usuario admin, un proveedor, un cliente, productos de materia prima y
// producto terminado). Cada prueba especifica agrega lo demas que necesite.
const seedBaseline = async () => {
  const [userResult] = await pool.query(
    "INSERT INTO usuarios (nombre_completo, username, password_hash, rol, estado_registro) VALUES ('Admin Pruebas', 'admin.test', 'x', 'Administrador', 'Activo')"
  );
  const idUsuario = userResult.insertId;

  const [providerResult] = await pool.query(
    "INSERT INTO proveedores (nombre_empresa, nit, estado_registro) VALUES ('Finca de Pruebas', 'CF-1', 'Activo')"
  );
  const idProveedor = providerResult.insertId;

  const [clientResult] = await pool.query(
    "INSERT INTO clientes (nombre_comercial, estado_registro) VALUES ('Cliente de Pruebas', 'Activo')"
  );
  const idCliente = clientResult.insertId;

  const [rawProductResult] = await pool.query(
    "INSERT INTO productos (nombre, unidad_medida, tipo_producto, estado_registro) VALUES ('Platano Verde', 'kg', 'Materia Prima', 'Activo')"
  );
  const idProductoMateriaPrima = rawProductResult.insertId;

  const [finishedProductResult] = await pool.query(
    "INSERT INTO productos (nombre, unidad_medida, tipo_producto, estado_registro) VALUES ('Platano Frito Congelado', 'kg', 'Producto Terminado', 'Activo')"
  );
  const idProductoTerminado = finishedProductResult.insertId;

  const [mermaTypeResult] = await pool.query(
    "INSERT INTO cat_tipos_merma (nombre_merma, estado_registro) VALUES ('Cascara', 'Activo')"
  );
  const idTipoMerma = mermaTypeResult.insertId;

  const [stageTypeResult] = await pool.query(
    "INSERT INTO cat_tipos_etapa (nombre_etapa, estado_registro) VALUES ('Pelado', 'Activo')"
  );
  const idTipoEtapa = stageTypeResult.insertId;

  return {
    idUsuario,
    idProveedor,
    idCliente,
    idProductoMateriaPrima,
    idProductoTerminado,
    idTipoMerma,
    idTipoEtapa,
  };
};

// Codigo de trazabilidad GUARDADO para ese registro (ver src/workers/shared/phaseCode.js).
// Las pruebas lo comparan con formatPhaseCode para asegurar que cada INSERT llamo a
// assignPhaseCode (si un camino de creacion lo olvida, aqui queda en null).
const getStoredPhaseCode = async (tipo, id) => {
  const { PHASE_CODE_COLUMN, PHASE_CODE_COLUMNS } = require('../../src/workers/shared/phaseCode');
  const { table, idColumn } = PHASE_CODE_COLUMNS[tipo];
  const [rows] = await pool.query(`SELECT ${PHASE_CODE_COLUMN} AS codigo FROM ${table} WHERE ${idColumn} = ?`, [id]);
  return rows[0]?.codigo ?? null;
};

module.exports = {
  pool,
  resetDatabase,
  seedBaseline,
  getStoredPhaseCode,
};
