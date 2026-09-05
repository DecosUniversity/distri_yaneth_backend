const auditModel = require('../models/audit.model');

const getAuditRecords = async (req, res, next) => {
  try {
    const { tabla, id } = req.query;

    if (tabla && id) {
      const records = await auditModel.findByRecord(String(tabla), String(id));
      return res.status(200).json(records);
    }

    if (tabla) {
      const records = await auditModel.findByTable(String(tabla));
      return res.status(200).json(records);
    }

    const records = await auditModel.findAll();
    return res.status(200).json(records);
  } catch (error) {
    return next(error);
  }
};

const getAuditTables = async (_req, res, next) => {
  try {
    const tables = await auditModel.findTables();
    return res.status(200).json(tables);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getAuditRecords,
  getAuditTables,
};
