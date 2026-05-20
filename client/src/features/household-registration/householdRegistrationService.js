const API_BASE_URL =
import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const parseJsonResponse = async (response) => {
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || "Request failed");
  }

  return payload;
};

export const fetchActiveDisasterEvents = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/disaster-events/active`);
  return parseJsonResponse(response);
};

export const fetchSectors = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/sectors`);
  return parseJsonResponse(response);
};

export const fetchBarangays = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/barangays`);
  return parseJsonResponse(response);
};

export const fetchEvacuationCenters = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/evacuation-centers`);

    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    return Array.isArray(payload.data) ? payload.data : payload;
  } catch (error) {
    return [];
  }
};

export const fetchEvacuationCentersByBarangay = async (barangayId) => {
  if (!barangayId) {
    return [];
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/evacuation-centers/barangay/${barangayId}`,
    );

    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    return Array.isArray(payload.data) ? payload.data : payload;
  } catch (error) {
    return [];
  }
};

export const registerHousehold = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/households/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(response);
};

export const updateHousehold = async (householdId, payload) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/households/${householdId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(response);
};
