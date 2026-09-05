const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'node',
    // El backend es CommonJS puro; con globals:true los archivos de prueba
    // usan describe/it/expect sin necesitar require('vitest') (que falla en CJS).
    globals: true,
    setupFiles: ['./tests/setup.js'],
    testTimeout: 20000,
    hookTimeout: 20000,
    // Todas las pruebas de integracion comparten una sola base de datos de pruebas
    // (se trunca y siembra entre archivos), asi que no pueden correr en paralelo.
    fileParallelism: false,
  },
});
