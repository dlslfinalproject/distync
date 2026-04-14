const pool = require("../config/db");

const baseSelectQuery = `
  SELECT
    ec.id,
    ec.barangay_id,
    b.code AS barangay_code,
    b.name AS barangay_name,
    ec.name,
    ec.individual_capacity,
    ec.is_active,
    ec.created_at,
    ec.updated_at
  FROM evacuation_centers ec
  INNER JOIN barangays b ON b.id = ec.barangay_id
`;

const getEvacuationCenters = async () => {
  const query = `
    ${baseSelectQuery}
    ORDER BY b.name ASC, ec.name ASC
  `;

  const result = await pool.query(query);
  return result.rows;
};

const getEvacuationCentersByBarangayId = async (barangayId) => {
  const query = `
    ${baseSelectQuery}
    WHERE ec.barangay_id = $1
    ORDER BY ec.name ASC
  `;

  const result = await pool.query(query, [barangayId]);
  return result.rows;
};

module.exports = {
  getEvacuationCenters,
  getEvacuationCentersByBarangayId,
};
