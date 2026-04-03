const pool = require("../config/db");
const disasterEventRepository = require("../repositories/disasterEvent.repository");

const allowedStatuses = ["PLANNED", "ACTIVE", "CLOSED", "ARCHIVED"];

const getAllDisasterEvents = async () => {
  return disasterEventRepository.getAllDisasterEvents();
};

const getActiveDisasterEvents = async () => {
  return disasterEventRepository.getActiveDisasterEvents();
};

const getDisasterEventById = async (id) => {
  const disasterEvent = await disasterEventRepository.getDisasterEventById(id);

  if (!disasterEvent) {
    return null;
  }

  const affectedBarangays =
    await disasterEventRepository.getAffectedBarangaysByDisasterEventId(id);

  return {
    ...disasterEvent,
    affected_barangays: affectedBarangays,
  };
};

const createDisasterEvent = async (disasterEventData) => {
  if (!allowedStatuses.includes(disasterEventData.status)) {
    const error = new Error("Status must be PLANNED, ACTIVE, CLOSED, or ARCHIVED");
    error.statusCode = 400;
    throw error;
  }

  if (
    disasterEventData.end_date &&
    new Date(disasterEventData.end_date) < new Date(disasterEventData.start_date)
  ) {
    const error = new Error("end_date must not be earlier than start_date");
    error.statusCode = 400;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const createdDisasterEvent = await disasterEventRepository.insertDisasterEvent(
      disasterEventData,
      client,
    );

    if (disasterEventData.barangay_ids.length > 0) {
      await disasterEventRepository.insertDisasterEventBarangays(
        createdDisasterEvent.id,
        disasterEventData.barangay_ids,
        client,
      );
    }

    await client.query("COMMIT");

    return getDisasterEventById(createdDisasterEvent.id);
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      const duplicateError = new Error("event_code already exists");
      duplicateError.statusCode = 409;
      throw duplicateError;
    }

    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  getAllDisasterEvents,
  getActiveDisasterEvents,
  getDisasterEventById,
  createDisasterEvent,
};
