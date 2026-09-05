const { Worker } = require('bullmq');

const { redisConnection } = require('../config/redis');
const { DB_QUEUE_NAME } = require('../queues/db.queue');

const { handlers: userHandlers } = require('./domains/user.worker');
const { handlers: providerHandlers } = require('./domains/provider.worker');
const { handlers: clientHandlers } = require('./domains/client.worker');
const { handlers: entradasMercanciaHandlers } = require('./domains/entradas_mercancia.worker');
const { handlers: inventoryHandlers } = require('./domains/inventory.worker');
const { handlers: productHandlers } = require('./domains/product.worker');
const { handlers: serviceTypeHandlers } = require('./domains/service_type.worker');
const { handlers: mermaTypeHandlers } = require('./domains/merma_type.worker');
const { handlers: stageTypeHandlers } = require('./domains/stage_type.worker');
const { handlers: maturationHandlers } = require('./domains/maturation.worker');
const { handlers: greenNetHandlers } = require('./domains/green_net.worker');
const { handlers: productionHandlers } = require('./domains/production.worker');
const { handlers: productionOrderHandlers } = require('./domains/production_order.worker');
const { handlers: vehicleHandlers } = require('./domains/vehicle.worker');
const { handlers: vehicleMileageReportHandlers } = require('./domains/vehicle_mileage_report.worker');
const { handlers: vehicleServiceHandlers } = require('./domains/vehicle_service.worker');
const { handlers: orderHandlers } = require('./domains/order.worker');
const { handlers: routeHandlers } = require('./domains/route.worker');
const { handlers: orderReturnHandlers } = require('./domains/order_return.worker');
const { handlers: auditHandlers } = require('./domains/audit.worker');
const { handlers: traceabilityHandlers } = require('./domains/traceability.worker');

const handlers = {
  ...userHandlers,
  ...providerHandlers,
  ...clientHandlers,
  ...entradasMercanciaHandlers,
  ...inventoryHandlers,
  ...productHandlers,
  ...serviceTypeHandlers,
  ...mermaTypeHandlers,
  ...stageTypeHandlers,
  ...maturationHandlers,
  ...greenNetHandlers,
  ...productionHandlers,
  ...productionOrderHandlers,
  ...vehicleHandlers,
  ...vehicleMileageReportHandlers,
  ...vehicleServiceHandlers,
  ...orderHandlers,
  ...routeHandlers,
  ...orderReturnHandlers,
  ...auditHandlers,
  ...traceabilityHandlers,
};

let dbWorker;

const startDbWorker = async () => {
  if (dbWorker) {
    return dbWorker;
  }

  dbWorker = new Worker(
    DB_QUEUE_NAME,
    async (job) => {
      const handler = handlers[job.name];

      if (!handler) {
        throw new Error(`No existe handler para el job: ${job.name}`);
      }

      return handler(job.data || {});
    },
    {
      connection: redisConnection,
      concurrency: Number(process.env.DB_QUEUE_CONCURRENCY) || 5,
    }
  );

  dbWorker.on('failed', (job, err) => {
    const jobId = job ? job.id : 'sin-id';
    console.error(`Job fallido (${jobId}):`, err.message);
  });

  await dbWorker.waitUntilReady();
  console.log(`Worker de cola listo: ${DB_QUEUE_NAME}`);

  return dbWorker;
};

const stopDbWorker = async () => {
  if (!dbWorker) {
    return;
  }

  const workerToClose = dbWorker;
  dbWorker = undefined;
  await workerToClose.close();
};

module.exports = {
  startDbWorker,
  stopDbWorker,
};
