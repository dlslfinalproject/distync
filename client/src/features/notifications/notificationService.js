const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const handleJsonResponse = async (response, fallbackMessage) => {
  const responseData = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(responseData?.message || fallbackMessage);
  }

  return responseData;
};

export const fetchNotifications = async ({
  status = "ALL",
  category = "ALL",
  priority = "ALL",
  cursor = null,
  limit = 25,
} = {}) => {
  const searchParams = new URLSearchParams();

  if (status && status !== "ALL") {
    searchParams.set("status", status);
  }

  if (category && category !== "ALL") {
    searchParams.set("category", category);
  }

  if (priority && priority !== "ALL") {
    searchParams.set("priority", priority);
  }

  if (cursor) searchParams.set("cursor", cursor);

  searchParams.set("limit", String(limit));

  const response = await fetch(
    `${API_BASE_URL}/api/v1/notifications?${searchParams.toString()}`,
  );

  return handleJsonResponse(response, "Failed to fetch notifications");
};

export const fetchUnreadNotificationCount = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/notifications/unread-count`);
  return handleJsonResponse(response, "Failed to fetch unread notification count");
};

export const markNotificationAsRead = async (notificationId) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/notifications/${notificationId}/read`,
    {
      method: "POST",
    },
  );

  return handleJsonResponse(response, "Failed to mark notification as read");
};

export const markAllNotificationsAsRead = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/notifications/read-all`, {
    method: "POST",
  });

  return handleJsonResponse(response, "Failed to mark all notifications as read");
};

export const fetchMayorNotifications = fetchNotifications;
export const fetchMayorUnreadNotificationCount = fetchUnreadNotificationCount;
export const markMayorNotificationAsRead = markNotificationAsRead;
export const markAllMayorNotificationsAsRead = markAllNotificationsAsRead;
