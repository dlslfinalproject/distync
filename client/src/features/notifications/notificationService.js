const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const handleJsonResponse = async (response, fallbackMessage) => {
  const responseData = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(responseData?.message || fallbackMessage);
  }

  return responseData;
};

export const fetchMayorNotifications = async ({
  status = "ALL",
  limit = 40,
} = {}) => {
  const searchParams = new URLSearchParams();

  if (status && status !== "ALL") {
    searchParams.set("status", status);
  }

  searchParams.set("limit", String(limit));

  const response = await fetch(
    `${API_BASE_URL}/api/v1/notifications?${searchParams.toString()}`,
  );

  return handleJsonResponse(response, "Failed to fetch notifications");
};

export const fetchMayorUnreadNotificationCount = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/notifications/unread-count`);
  return handleJsonResponse(response, "Failed to fetch unread notification count");
};

export const markMayorNotificationAsRead = async (notificationId) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/notifications/${notificationId}/read`,
    {
      method: "POST",
    },
  );

  return handleJsonResponse(response, "Failed to mark notification as read");
};

export const markAllMayorNotificationsAsRead = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/notifications/read-all`, {
    method: "POST",
  });

  return handleJsonResponse(response, "Failed to mark all notifications as read");
};
