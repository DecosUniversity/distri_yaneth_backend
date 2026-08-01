const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('inventory.findAll', {});
};

module.exports = {
  findAll,
};