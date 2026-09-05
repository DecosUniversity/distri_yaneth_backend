const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('orderReturns.findAll', {});
};

const findPendingReview = async () => {
  return enqueueDbJob('orderReturns.findPendingReview', {});
};

const create = async (payload) => {
  return enqueueDbJob('orderReturns.create', payload);
};

const resolve = async (id, payload) => {
  return enqueueDbJob('orderReturns.resolve', { id, ...payload });
};

module.exports = {
  findAll,
  findPendingReview,
  create,
  resolve,
};
