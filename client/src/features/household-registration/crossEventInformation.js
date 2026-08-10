export const buildActiveCrossEventInfoMessage = (response, selectedEvent) => {
  const activeEvents =
    response?.data?.active_cross_event_information?.active_disaster_events;

  if (!Array.isArray(activeEvents) || activeEvents.length === 0) {
    return "";
  }

  const eventTitles = activeEvents
    .map((eventItem) => String(eventItem?.disaster_event_title || "").trim())
    .filter(Boolean);

  if (eventTitles.length === 0) {
    return "";
  }

  const targetEventTitle =
    selectedEvent?.title || selectedEvent?.event_name || "the selected disaster event";
  const formattedEventTitles =
    eventTitles.length === 1
      ? eventTitles[0]
      : `${eventTitles.slice(0, -1).join(", ")} and ${eventTitles.at(-1)}`;

  return eventTitles.length === 1
    ? `Note: This household is also registered under the active disaster event "${formattedEventTitles}". Records for "${targetEventTitle}" are maintained separately.`
    : `Note: This household is also registered under other active disaster events: ${formattedEventTitles}. Records remain separate for each event.`;
};
