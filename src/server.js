require('dotenv').config();

const app = require('./app');
const { testConnection } = require('./config/db');
const { ensureDbQueueReady } = require('./queues/db.queue');
const { startDbWorker } = require('./workers/db.worker');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await testConnection();
    await ensureDbQueueReady();
    await startDbWorker();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor escuchando en puerto ${PORT}`);
    });
  } catch (error) {
    console.error('No se pudo iniciar el servidor:', error.message);
    process.exit(1);
  }
};

startServer();
