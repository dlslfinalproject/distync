const mswdoReportRepository = require("../repositories/mswdoReport.repository");

const getAnomalyTracking = async (filters) => {
  return mswdoReportRepository.getMswdoAnomalyTracking(filters);
};

module.exports = {
  getAnomalyTracking,
};
