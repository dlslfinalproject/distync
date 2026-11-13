const normalizeReliefPackDemandIdentifier = (value) =>
  String(value || "").trim();

export const formatDisasterEventOptionLabel = (event) => {
  const title = String(event?.title || "").trim();
  const eventCode = String(event?.event_code || "").trim();
  const codePrefixPattern = /^DE-\d{4}-\d{4}\s*[-:]\s*/i;
  const titleWithoutCode = title.replace(codePrefixPattern, "").trim();

  if (
    eventCode &&
    titleWithoutCode.toLowerCase().startsWith(eventCode.toLowerCase())
  ) {
    return titleWithoutCode.slice(eventCode.length).replace(/^[-:\s]+/, "").trim();
  }

  return titleWithoutCode || title || "Untitled disaster event";
};

export const buildReliefPackTemplateDemandFromAggregates = (
  template,
  demandAggregates,
  disasterEvent,
) => {
  const templateId = normalizeReliefPackDemandIdentifier(template?.id);
  const disasterEventId = normalizeReliefPackDemandIdentifier(disasterEvent?.id);
  const barangayDemandMap = new Map();

  (demandAggregates || [])
    .filter(
      (entry) =>
        normalizeReliefPackDemandIdentifier(entry?.template_id) === templateId &&
        normalizeReliefPackDemandIdentifier(entry?.disaster_event_id) ===
          disasterEventId,
    )
    .forEach((entry) => {
      const barangayId =
        entry?.barangay_id || entry?.barangay_name || "unknown-barangay";
      const key = `${disasterEventId}::${barangayId}`;
      const existingEntry = barangayDemandMap.get(key);

      if (existingEntry) {
        existingEntry.families_count += Number(entry?.families_count || 0);
        existingEntry.packs_needed += Number(entry?.packs_needed || 0);
        return;
      }

      barangayDemandMap.set(key, {
        barangay_id: entry?.barangay_id || key,
        barangay_name: entry?.barangay_name || "Unknown barangay",
        disaster_event_id: disasterEventId,
        disaster_event_name: formatDisasterEventOptionLabel(disasterEvent),
        families_count: Number(entry?.families_count || 0),
        packs_needed: Number(entry?.packs_needed || 0),
      });
    });

  const perBarangayDemand = [...barangayDemandMap.values()].sort(
    (leftBarangay, rightBarangay) =>
      rightBarangay.packs_needed - leftBarangay.packs_needed,
  );
  const familiesCount = perBarangayDemand.reduce(
    (total, entry) => total + Number(entry.families_count || 0),
    0,
  );
  const neededPacks = perBarangayDemand.reduce(
    (total, entry) => total + Number(entry.packs_needed || 0),
    0,
  );

  return {
    neededPacks,
    perBarangayDemand,
    perEventDemand:
      perBarangayDemand.length > 0
        ? [
            {
              disaster_event_id: disasterEventId,
              disaster_event_name: formatDisasterEventOptionLabel(disasterEvent),
              families_count: familiesCount,
              packs_needed: neededPacks,
            },
          ]
        : [],
  };
};
