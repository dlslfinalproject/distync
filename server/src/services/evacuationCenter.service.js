const evacuationCenterRepository = require("../repositories/evacuationCenter.repository");

const mapEvacuationCenter = (center) => {
  return {
    id: center.id,
    barangay_id: center.barangay_id,
    barangay: {
      id: center.barangay_id,
      code: center.barangay_code,
      name: center.barangay_name,
    },
    name: center.name,
    individual_capacity: center.individual_capacity,
    is_active: center.is_active,
    created_at: center.created_at,
    updated_at: center.updated_at,
  };
};

const getEvacuationCenters = async () => {
  const centers = await evacuationCenterRepository.getEvacuationCenters();
  return centers.map(mapEvacuationCenter);
};

const getEvacuationCentersByBarangayId = async (barangayId) => {
  const centers =
    await evacuationCenterRepository.getEvacuationCentersByBarangayId(barangayId);

  return centers.map(mapEvacuationCenter);
};

module.exports = {
  getEvacuationCenters,
  getEvacuationCentersByBarangayId,
};
