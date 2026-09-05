// Crea (si no existen) 4 cuentas dedicadas para las pruebas E2E con Playwright, una por cada
// rol del sistema. Es idempotente: si ya existen, no las vuelve a crear ni les cambia la
// contrasena. No toca ninguna cuenta real del usuario.
//
// El login del backend acepta password_hash en texto plano como respaldo si bcrypt.compare
// falla (ver src/controllers/user.controller.js), asi que igual que en seed_demo_data.js no
// hace falta hashear aqui: el mismo texto sirve como password.
//
// Uso: node scripts/seed_e2e_users.js   (desde la carpeta Backend, contra la base de datos REAL)

require('dotenv').config();

const { pool } = require('../src/config/db');
const userHandlers = require('../src/workers/domains/user.worker').handlers;

const log = (...args) => console.log('[seed-e2e]', ...args);

const E2E_PASSWORD = 'E2eTest123!';

const E2E_USERS = [
  { username: 'e2e.admin', nombre_completo: 'E2E Administrador', rol: 'Administrador' },
  { username: 'e2e.produccion', nombre_completo: 'E2E Produccion', rol: 'Produccion' },
  { username: 'e2e.logistica', nombre_completo: 'E2E Logistica', rol: 'Logistica' },
  { username: 'e2e.piloto', nombre_completo: 'E2E Piloto', rol: 'Piloto' },
];

const main = async () => {
  const [dbNameRows] = await pool.query('SELECT DATABASE() AS db');
  log(`Conectado a la base de datos: ${dbNameRows[0].db}`);

  if (dbNameRows[0].db.endsWith('_test')) {
    throw new Error('Este script es para la base de datos real, no para la de pruebas (_test). Aborta.');
  }

  const [existingUsers] = await pool.query('SELECT id_usuario, username, rol FROM usuarios');
  const adminUser = existingUsers.find((u) => u.rol === 'Administrador');

  if (!adminUser) {
    throw new Error('No hay ningun usuario Administrador real en la base de datos para usar como creador.');
  }

  for (const spec of E2E_USERS) {
    const already = existingUsers.find((u) => u.username === spec.username);

    if (already) {
      log(`Ya existe: ${spec.username} (rol ${already.rol}) - no se modifica.`);
      continue;
    }

    await userHandlers['users.create']({
      nombre_completo: spec.nombre_completo,
      username: spec.username,
      password_hash: E2E_PASSWORD,
      rol: spec.rol,
      id_usuario_modificacion: adminUser.id_usuario,
    });
    log(`Creado: ${spec.username} / ${E2E_PASSWORD} (rol ${spec.rol})`);
  }

  log('Listo. Credenciales de prueba: usuario segun tabla anterior, password "E2eTest123!" para todas.');
};

main()
  .catch((error) => {
    console.error('[seed-e2e] FALLO:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
