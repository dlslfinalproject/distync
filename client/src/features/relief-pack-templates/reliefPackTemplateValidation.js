const POSITIVE_INTEGER_PATTERN = /^\d+$/;

export const normalizeReliefPackTemplateName = (value) =>
  String(value ?? "").trim().toLowerCase();

export const getReliefPackTemplateNameValidationError = (
  value,
  existingTemplates = [],
  currentTemplateId = null,
) => {
  const normalizedName = normalizeReliefPackTemplateName(value);

  if (!normalizedName) {
    return "Pack name is required.";
  }

  const templates = Array.isArray(existingTemplates) ? existingTemplates : [];
  const hasDuplicateName = templates.some((template) => {
    const isCurrentTemplate =
      currentTemplateId !== null &&
      currentTemplateId !== undefined &&
      String(template?.id) === String(currentTemplateId);

    return (
      !isCurrentTemplate &&
      normalizeReliefPackTemplateName(template?.name) === normalizedName
    );
  });

  return hasDuplicateName
    ? "A relief pack template with this name already exists. Choose a different name."
    : "";
};

export const getPositiveIntegerValidationError = (
  value,
  fieldLabel = "Quantity per pack",
) => {
  const label = String(fieldLabel || "Quantity per pack").trim() || "Quantity per pack";
  const normalizedValue = String(value ?? "").trim();

  if (!normalizedValue) {
    return `${label} is required.`;
  }

  if (normalizedValue.startsWith("-")) {
    return `${label} cannot be negative.`;
  }

  if (/[.,]/.test(normalizedValue)) {
    return `${label} must be a whole number; decimal values are not allowed.`;
  }

  if (!POSITIVE_INTEGER_PATTERN.test(normalizedValue)) {
    return `${label} must contain whole numbers only.`;
  }

  const parsedValue = Number(normalizedValue);

  if (!Number.isSafeInteger(parsedValue)) {
    return `${label} must be a valid whole number.`;
  }

  if (parsedValue <= 0) {
    return `${label} must be greater than 0.`;
  }

  return "";
};

export const parsePositiveInteger = (value) => {
  if (getPositiveIntegerValidationError(value)) {
    return null;
  }

  return Number(String(value ?? "").trim());
};
