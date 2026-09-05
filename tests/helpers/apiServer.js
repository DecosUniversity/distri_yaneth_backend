// Arranca el worker de la cola dentro del MISMO registro de modulos que el archivo de
// prueba (Vitest aisla cada archivo), para que enqueueDbJob() encolado por una peticion
// de supertest sea procesado por un worker que vive en ese mismo contexto.
const { startDbWorker, stopDbWorker } = require('../../src/workers/db.worker');
const { ensureDbQueueReady, closeDbQueue } = require('../../src/queues/db.queue');
const { pool } = require('../../src/config/db');
const app = require('../../src/app');

const startTestServer = async () => {
  await ensureDbQueueReady();
  await startDbWorker();
  return app;
};

const stopTestServer = async () => {
  await stopDbWorker();
  await closeDbQueue();
};

module.exports = {
  app,
  pool,
  startTestServer,
  stopTestServer,
};
