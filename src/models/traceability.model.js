const { enqueueDbJob } = require('../queues/db.queue');

const trace = async ({ codigo, tipo, id }) => {
  return enqueueDbJob('traceability.trace', { codigo, tipo, id });
};

const search = async (q) => {
  return enqueueDbJob('traceability.search', { q });
};

const searchByFilters = async ({ areas, desde, hasta }) => {
  return enqueueDbJob('traceability.searchByFilters', { areas, desde, hasta });
};

module.exports = {
  trace,
  search,
  searchByFilters,
};
