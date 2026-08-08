const pool = require("../config/db");

const getSuppliers = async (filters) => {
  const values = [];
  const conditions = [];

  if (filters.search) {
    values.push(`%${filters.search}%`);
    conditions.push(
      `(name ILIKE $${values.length} OR contact_person ILIKE $${values.length} OR contact_number ILIKE $${values.length})`,
    );
  }

  if (filters.has_moa !== null) {
    values.push(filters.has_moa);
    conditions.push(`has_moa = $${values.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    SELECT
      id,
      name,
      contact_person,
      contact_number,
      address,
      has_moa,
      notes,
      created_at,
      updated_at
    FROM suppliers
    ${whereClause}
    ORDER BY name ASC
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

const getSupplierById = async (id, dbClient = pool) => {
  const query = `
    SELECT
      id,
      name,
      contact_person,
      contact_number,
      address,
      has_moa,
      notes,
      created_at,
      updated_at
    FROM suppliers
    WHERE id = $1
  `;

  const result = await dbClient.query(query, [id]);
  return result.rows[0] || null;
};

const getSupplierByName = async (name, dbClient = pool) => {
  const query = `
    SELECT
      id,
      name
    FROM suppliers
    WHERE name = $1
  `;

  const result = await dbClient.query(query, [name]);
  return result.rows[0] || null;
};

const insertSupplier = async (supplierData, dbClient = pool) => {
  const query = `
    INSERT INTO suppliers (
      name,
      contact_person,
      contact_number,
      address,
      has_moa,
      notes,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    RETURNING
      id,
      name,
      contact_person,
      contact_number,
      address,
      has_moa,
      notes,
      created_at,
      updated_at
  `;

  const values = [
    supplierData.name,
    supplierData.contact_person,
    supplierData.contact_number,
    supplierData.address,
    supplierData.has_moa,
    supplierData.notes,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0];
};

const updateSupplier = async (id, supplierData, dbClient = pool) => {
  const query = `
    UPDATE suppliers
    SET name = $2,
        contact_person = $3,
        contact_number = $4,
        address = $5,
        has_moa = $6,
        notes = $7,
        updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      name,
      contact_person,
      contact_number,
      address,
      has_moa,
      notes,
      created_at,
      updated_at
  `;

  const values = [
    id,
    supplierData.name,
    supplierData.contact_person,
    supplierData.contact_number,
    supplierData.address,
    supplierData.has_moa,
    supplierData.notes,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0] || null;
};

module.exports = {
  getSuppliers,
  getSupplierById,
  getSupplierByName,
  insertSupplier,
  updateSupplier,
};
