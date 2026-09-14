import { getCanonicalSectorCodeFromText } from "../../utils/sectorDisplay.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeSectorValue = (value) => String(value || "").trim().toUpperCase();

const isUuid = (value) => UUID_PATTERN.test(String(value || "").trim());

const addNormalizedValue = (set, value) => {
  const normalizedValue = normalizeSectorValue(value);

  if (normalizedValue) {
    set.add(normalizedValue);
  }
};

const addSectorCode = (set, value) => {
  if (!value || isUuid(value)) {
    return;
  }

  addNormalizedValue(set, getCanonicalSectorCodeFromText(value));
};

const addSelectedSectorAliases = (set, value) => {
  addNormalizedValue(set, value);

  if (!isUuid(value)) {
    addSectorCode(set, value);
  }
};

export const getStubRowSectorAliases = (row = {}) => {
  const aliases = new Set();

  (Array.isArray(row.sector_ids) ? row.sector_ids : []).forEach((value) => {
    addSelectedSectorAliases(aliases, value);
  });

  (Array.isArray(row.sector_codes) ? row.sector_codes : []).forEach((value) => {
    addSectorCode(aliases, value);
  });

  (Array.isArray(row.sectors) ? row.sectors : []).forEach((sector) => {
    addSelectedSectorAliases(aliases, sector?.id);
    addSectorCode(aliases, sector?.code);
    addSectorCode(aliases, sector?.name);
  });

  if (row.sectors_text && row.sectors_text !== "-") {
    String(row.sectors_text)
      .split(",")
      .forEach((value) => addSectorCode(aliases, value));
  }

  return aliases;
};

export const getStubRowSectorCodes = (row = {}) => {
  const codes = new Set();

  (Array.isArray(row.sector_codes) ? row.sector_codes : []).forEach((value) => {
    addSectorCode(codes, value);
  });

  (Array.isArray(row.sectors) ? row.sectors : []).forEach((sector) => {
    addSectorCode(codes, sector?.code);
    addSectorCode(codes, sector?.name);
  });

  if (row.sectors_text && row.sectors_text !== "-") {
    String(row.sectors_text)
      .split(",")
      .forEach((value) => addSectorCode(codes, value));
  }

  return [...codes];
};

export const matchesStubSectorFilter = (row, selectedSectorValues = []) => {
  if (!Array.isArray(selectedSectorValues) || selectedSectorValues.length === 0) {
    return true;
  }

  const rowAliases = getStubRowSectorAliases(row);

  return selectedSectorValues.some((value) => {
    const selectedAliases = new Set();
    addSelectedSectorAliases(selectedAliases, value);

    return [...selectedAliases].some((alias) => rowAliases.has(alias));
  });
};

const addOptionAlias = (optionAliases, value, sourceSectorId) => {
  if (!value || !sourceSectorId) {
    return;
  }

  addNormalizedValue(optionAliases, value);

  if (!isUuid(value)) {
    addNormalizedValue(
      optionAliases,
      getCanonicalSectorCodeFromText(value),
    );
  }
};

export const resolveStubSectorIdsForApi = (
  selectedSectorValues = [],
  sectorOptions = [],
) => {
  const sourceIdByAlias = new Map();

  (Array.isArray(sectorOptions) ? sectorOptions : []).forEach((option) => {
    const sourceSectorId = [
      option?.source_sector_id,
      option?.id,
      option?.value,
    ].find(isUuid);

    if (!sourceSectorId) {
      return;
    }

    [
      option?.id,
      option?.code,
      option?.value,
      option?.source_sector_id,
      option?.name,
      option?.label,
      option?.display_name,
    ].forEach((value) => {
      const aliases = new Set();
      addOptionAlias(aliases, value, sourceSectorId);
      aliases.forEach((alias) => sourceIdByAlias.set(alias, sourceSectorId));
    });
  });

  return [...new Set(
    (Array.isArray(selectedSectorValues) ? selectedSectorValues : [])
      .map((value) => {
        if (isUuid(value)) {
          return String(value).trim();
        }

        const aliases = new Set();
        addSelectedSectorAliases(aliases, value);

        for (const alias of aliases) {
          const sourceSectorId = sourceIdByAlias.get(alias);

          if (sourceSectorId) {
            return sourceSectorId;
          }
        }

        return null;
      })
      .filter(Boolean),
  )];
};
