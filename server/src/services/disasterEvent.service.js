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

const extendDisasterEvent = async (id, endDate) => {
  const disasterEvent = await disasterEventRepository.getDisasterEventById(id);

  if (!disasterEvent) {
    const error = new Error("Disaster event not found");
    error.statusCode = 404;
    throw error;
  }

  if (disasterEvent.status !== "ACTIVE") {
    const error = new Error("Only active disaster events can be extended");
    error.statusCode = 400;
    throw error;
  }

  const nextEndDate = new Date(endDate);
  const startDate = new Date(disasterEvent.start_date);

  if (nextEndDate < startDate) {
    const error = new Error("end_date must not be earlier than start_date");
    error.statusCode = 400;
    throw error;
  }

  if (disasterEvent.end_date) {
    const currentEndDate = new Date(disasterEvent.end_date);

    if (nextEndDate < currentEndDate) {
      const error = new Error(
        "end_date must not be earlier than the current end_date",
      );
      error.statusCode = 400;
      throw error;
    }
  }

  await disasterEventRepository.updateDisasterEventById(id, {
    end_date: endDate,
  });

  return getDisasterEventById(id);
};

const endDisasterEvent = async (id) => {
  const disasterEvent = await disasterEventRepository.getDisasterEventById(id);

  if (!disasterEvent) {
    const error = new Error("Disaster event not found");
    error.statusCode = 404;
    throw error;
  }

  if (disasterEvent.status !== "ACTIVE") {
    const error = new Error("Only active disaster events can be ended");
    error.statusCode = 400;
    throw error;
  }

  const today = new Date().toISOString().slice(0, 10);

  await disasterEventRepository.updateDisasterEventById(id, {
    end_date: today,
    status: "CLOSED",
  });

  return getDisasterEventById(id);
};

module.exports = {
  getAllDisasterEvents,
  getActiveDisasterEvents,
  getDisasterEventById,
  createDisasterEvent,
  extendDisasterEvent,
  endDisasterEvent,
};
