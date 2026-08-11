export const getActiveCrossEventTitles = (response) => {
  const activeCrossEventInformation =
    response?.data?.active_cross_event_information;
  const activeEvents =
    activeCrossEventInformation?.active_disaster_events;

  if (
    !activeCrossEventInformation?.has_active_cross_event_match ||
    !Array.isArray(activeEvents) ||
    activeEvents.length === 0
  ) {
    return [];
  }

  return activeEvents.reduce((eventTitles, eventItem) => {
    const eventTitle = String(eventItem?.disaster_event_title || "").trim();

    if (eventTitle && !eventTitles.includes(eventTitle)) {
      eventTitles.push(eventTitle);
    }

    return eventTitles;
  }, []);
};
