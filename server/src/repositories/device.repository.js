const pool = require("../config/db");

const upsertDeviceByUuid = async (deviceUuid, dbClient = pool) => {
  const query = `
    INSERT INTO devices (
      device_uuid,
      last_seen_at
    )
    VALUES ($1, NOW())
    ON CONFLICT (device_uuid)
    DO UPDATE SET
      last_seen_at = NOW()
    RETURNING
      id,
      device_uuid,
      device_name,
      platform,
      browser,
      last_seen_at,
      created_at
  `;

  const result = await dbClient.query(query, [deviceUuid]);
  return result.rows[0] || null;
};

module.exports = {
  upsertDeviceByUuid,
};
