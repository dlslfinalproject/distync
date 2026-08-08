const mswdoReportRepository = require("../repositories/mswdoReport.repository");

const getAnomalyTracking = async (filters) => {
  return mswdoReportRepository.getMswdoAnomalyTracking({
    disasterEventId: filters.disasterEventId || filters.disaster_event_id || null,
    barangayId: filters.barangayId || filters.barangay_id || null,
    status: filters.status || null,
    statusCategory: filters.statusCategory || filters.status_category || null,
    anomalyType: filters.anomalyType || filters.anomaly_type || null,
    search: filters.search || null,
    order: filters.order || "newest",
    dateFrom: filters.dateFrom || filters.date_from || null,
    dateTo: filters.dateTo || filters.date_to || null,
    limit: filters.limit || 100,
    page: filters.page || 1,
    pageSize: filters.pageSize || filters.page_size || filters.limit || 50,
  });
};

module.exports = {
  getAnomalyTracking,
};
