export const SETTINGS_SECTIONS = Object.freeze({
  ACCOUNT: "account",
  NOTIFICATIONS: "notifications",
  SYSTEM: "system",
});

export const DEFAULT_SETTINGS_SECTION = SETTINGS_SECTIONS.ACCOUNT;

const VALID_SETTINGS_SECTIONS = new Set(Object.values(SETTINGS_SECTIONS));

export const isValidSettingsSection = (value) =>
  VALID_SETTINGS_SECTIONS.has(value);

export const getSettingsSectionFromSearchParams = (searchParams) => {
  const requestedSection =
    typeof searchParams?.get === "function"
      ? searchParams.get("section")
      : null;

  return isValidSettingsSection(requestedSection)
    ? requestedSection
    : DEFAULT_SETTINGS_SECTION;
};

export const withSettingsSection = (searchParams, nextSection) => {
  const normalizedSection = isValidSettingsSection(nextSection)
    ? nextSection
    : DEFAULT_SETTINGS_SECTION;
  const nextParams = new URLSearchParams(searchParams);

  nextParams.delete("section");
  nextParams.set("section", normalizedSection);

  return nextParams;
};

export const getSettingsSectionNormalization = (searchParams) => {
  const requestedSection =
    typeof searchParams?.get === "function"
      ? searchParams.get("section")
      : null;
  const sectionValues =
    typeof searchParams?.getAll === "function"
      ? searchParams.getAll("section")
      : [];
  const section = getSettingsSectionFromSearchParams(searchParams);

  return {
    section,
    params: withSettingsSection(searchParams, section),
    shouldNormalize:
      !isValidSettingsSection(requestedSection) || sectionValues.length !== 1,
  };
};
