const { enqueueDbJob } = require('../queues/db.queue');

// El empaque de redes se estandarizo dentro de Produccion ("+ Empacar red"): ya no existe una
// via para crear redes nuevas aqui. Este modulo solo sirve para consultar el historico previo
// a ese cambio (ver produccion.worker.js / productionProcesses.addStage con `cajas`).
const findAll = async () => {
  return enqueueDbJob('greenNets.findAll', {});
};

const findBySublot = async (id_sublote) => {
  return enqueueDbJob('greenNets.findBySublot', { id_sublote });
};

module.exports = {
  findAll,
  findBySublot,
};
