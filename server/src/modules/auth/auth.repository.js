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
    is_active
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
        first_name = COALESCE($3, first_name),
        last_name = COALESCE($4, last_name),
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

module.exports = {
  getRoleByUserId,
  getUserByEmail,
  getUserByGoogleSub,
  updateUserGoogleIdentity,
};
