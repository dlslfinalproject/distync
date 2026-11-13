export const STAY_TYPE_OPTIONS = [
  {
    value: "EVAC_CENTER",
    label: "Evacuation Center",
  },
  {
    value: "RELATIVES",
    label: "Staying with Relatives",
  },
  {
    value: "OTHER_SAFE_PLACE",
    label: "Other Safe Place",
  },
];

const stayTypeLabels = Object.fromEntries(
  STAY_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

export const formatStayTypeLabel = (value) => {
  if (!value) {
    return "\u2014";
  }

  return stayTypeLabels[value] || value;
};
