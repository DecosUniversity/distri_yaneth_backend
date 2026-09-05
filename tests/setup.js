// Se ejecuta antes de cualquier import de un archivo de prueba: garantiza que
// src/config/db.js abra el pool contra la base de datos de PRUEBAS, no la real.
process.env.NODE_ENV = 'test';
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.test') });

if (!String(process.env.DB_NAME || '').endsWith('_test')) {
  throw new Error(
    `Bloqueado: DB_NAME="${process.env.DB_NAME}" no termina en "_test". ` +
      'Las pruebas nunca deben apuntar a la base de datos real.'
  );
}
