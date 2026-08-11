const pool = require("../../config/db");

const baseUserSelect = `
  SELECT
    id,
    google_sub,
    email,
    first_name,
    middle_name,
    last_name,
    default_barangay_id,
    is_active,
    last_login_at
  FROM users
`;

const getUserByGoogleSub = async (googleSub) => {
  const query = `
    ${baseUserSelect}
    WHERE google_sub = $1
  `;

  const result = await pool.query(query, [googleSub]);
  return result.rows[0] || null;
};

const getUserByEmail = async (email) => {
  const query = `
    ${baseUserSelect}
    WHERE LOWER(email) = LOWER($1)
  `;

  const result = await pool.query(query, [email]);
  return result.rows[0] || null;
};

const updateUserGoogleIdentity = async (
  userId,
  { googleSub, firstName, lastName },
) => {
  const query = `
    UPDATE users
    SET google_sub = $2,
        first_name = CASE
          WHEN COALESCE(NULLIF(BTRIM(first_name), ''), NULL) IS NULL
            THEN COALESCE($3, first_name)
          ELSE first_name
        END,
        last_name = CASE
          WHEN COALESCE(NULLIF(BTRIM(last_name), ''), NULL) IS NULL
            THEN COALESCE($4, last_name)
          ELSE last_name
        END,
        updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      google_sub,
      email,
      first_name,
      middle_name,
      last_name,
      default_barangay_id,
      is_active
  `;

  const result = await pool.query(query, [userId, googleSub, firstName, lastName]);
  return result.rows[0] || null;
};

const getRoleByUserId = async (userId) => {
  const query = `
    SELECT
      r.code
    FROM user_roles ur
    INNER JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = $1
    ORDER BY ur.assigned_at ASC
    LIMIT 1
  `;

  const result = await pool.query(query, [userId]);
  return result.rows[0] || null;
};

const getFirstActiveUserByRoleCode = async (roleCode) => {
  const query = `
    SELECT
      u.id,
      u.google_sub,
      u.email,
      u.first_name,
      u.middle_name,
      u.last_name,
      u.default_barangay_id,
      u.is_active,
      r.code AS role_code
    FROM users u
    INNER JOIN user_roles ur ON ur.user_id = u.id
    INNER JOIN roles r ON r.id = ur.role_id
    WHERE r.code = $1
      AND u.is_active = TRUE
    ORDER BY ur.assigned_at ASC, u.created_at ASC
    LIMIT 1
  `;

  const result = await pool.query(query, [roleCode]);
  return result.rows[0] || null;
};

module.exports = {
  getFirstActiveUserByRoleCode,
  getRoleByUserId,
  getUserByEmail,
  getUserByGoogleSub,
  updateUserGoogleIdentity,
};
