const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('audit.findAll', {});
};

const findByTable = async (tabla) => {
  return enqueueDbJob('audit.findByTable', { tabla });
};

const findByRecord = async (tabla, id) => {
  return enqueueDbJob('audit.findByRecord', { tabla, id });
};

const findTables = async () => {
  return enqueueDbJob('audit.findTables', {});
};

module.exports = {
  findAll,
  findByTable,
  findByRecord,
  findTables,
};
