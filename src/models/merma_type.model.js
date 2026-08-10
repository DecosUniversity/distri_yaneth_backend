const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('mermaTypes.findAll', {});
};

module.exports = {
  findAll,
};
