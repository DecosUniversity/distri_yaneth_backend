const vehicleMileageReportModel = require('../models/vehicle_mileage_report.model');

const getMileageReports = async (_req, res, next) => {
  try {
    const reports = await vehicleMileageReportModel.findAll();
    return res.status(200).json(reports);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getMileageReports,
};