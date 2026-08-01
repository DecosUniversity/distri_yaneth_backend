const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('vehicleMileageReports.findAll', {});
};

module.exports = {
  findAll,
};