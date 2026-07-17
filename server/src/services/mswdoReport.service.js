const mswdoReportRepository = require("../repositories/mswdoReport.repository");

const getAnomalyTracking = async (filters) => {
  return mswdoReportRepository.getMswdoAnomalyTracking({
    disasterEventId: filters.disasterEventId || filters.disaster_event_id || null,
    barangayId: filters.barangayId || filters.barangay_id || null,
    status: filters.status || null,
    dateFrom: filters.dateFrom || filters.date_from || null,
    dateTo: filters.dateTo || filters.date_to || null,
    limit: filters.limit || 100,
  });
};

module.exports = {
  getAnomalyTracking,
};
