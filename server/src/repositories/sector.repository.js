const pool = require("../config/db");

const baseSelectQuery = `
  SELECT
    id,
    code,
    name,
    description,
    sector_group,
    is_barangay_visible,
    is_mswdo_visible,
    created_at
  FROM sectors
`;

const orderByClause = `
  ORDER BY sector_group ASC, name ASC
`;

const getAllSectors = async () => {
  const query = `
    ${baseSelectQuery}
    ${orderByClause}
  `;

  const result = await pool.query(query);
  return result.rows;
};

const getPersonSectors = async () => {
  const query = `
    ${baseSelectQuery}
    WHERE sector_group <> $1
    ${orderByClause}
  `;

  const result = await pool.query(query, ["HOUSEHOLD"]);
  return result.rows;
};

const getHouseholdSectors = async () => {
  const query = `
    ${baseSelectQuery}
    WHERE sector_group = $1
    ${orderByClause}
  `;

  const result = await pool.query(query, ["HOUSEHOLD"]);
  return result.rows;
};

const getBarangayVisibleSectors = async () => {
  const query = `
    ${baseSelectQuery}
    WHERE is_barangay_visible = TRUE
    ${orderByClause}
  `;

  const result = await pool.query(query);
  return result.rows;
};

const getMswdoVisibleSectors = async () => {
  const query = `
    ${baseSelectQuery}
    WHERE is_mswdo_visible = TRUE
    ${orderByClause}
  `;

  const result = await pool.query(query);
  return result.rows;
};

module.exports = {
  getAllSectors,
  getPersonSectors,
  getHouseholdSectors,
  getBarangayVisibleSectors,
  getMswdoVisibleSectors,
};
