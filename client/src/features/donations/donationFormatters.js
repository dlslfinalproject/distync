export const donorTypeLabels = {
  INDIVIDUAL: "Individual",
  NGO: "NGO",
  PRIVATE_ORGANIZATION: "Private Organization",
  GOVERNMENT_PARTNER: "Government Partner",
  OTHER: "Other",
};

const legacyDonorTypeMap = {
  "PRIVATE ORGANIZATION": "PRIVATE_ORGANIZATION",
  "GOVERNMENT PARTNER": "GOVERNMENT_PARTNER",
};

export const normalizeDonorType = (value) => {
  const normalizedValue = String(value || "").trim().toUpperCase();
  return legacyDonorTypeMap[normalizedValue] || normalizedValue || "INDIVIDUAL";
};

export const formatDonorType = (value, otherValue = null) => {
  const normalizedValue = normalizeDonorType(value);

  if (normalizedValue === "OTHER") {
    const trimmedOtherValue = String(otherValue || "").trim();
    return trimmedOtherValue
      ? `${donorTypeLabels[normalizedValue]} - ${trimmedOtherValue}`
      : donorTypeLabels[normalizedValue];
  }

  return donorTypeLabels[normalizedValue] || "--";
};

export const formatDonationDateTime = (value) => {
  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const formatDonationDateOnly = (value) => {
  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};
