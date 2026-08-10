const { enqueueDbJob } = require('../queues/db.queue');

const create = async (payload) => {
  return enqueueDbJob('greenNets.create', payload);
};

const findAll = async () => {
  return enqueueDbJob('greenNets.findAll', {});
};

const findBySublot = async (id_sublote) => {
  return enqueueDbJob('greenNets.findBySublot', { id_sublote });
};

module.exports = {
  create,
  findAll,
  findBySublot,
};
