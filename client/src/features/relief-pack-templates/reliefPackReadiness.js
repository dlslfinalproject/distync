import { allocateSharedReliefPackInventory } from "./reliefPackAvailability.js";
import { isReliefPackInventoryBatchEligible } from "./reliefPackInventory.js";

export const RELIEF_PACK_READINESS_STATUS = Object.freeze({
  READY: "READY_FOR_DISTRIBUTION",
  NEEDS_REPLENISHMENT: "NEEDS_REPLENISHMENT",
});

export const RELIEF_PACK_READINESS_LABELS = Object.freeze({
  [RELIEF_PACK_READINESS_STATUS.READY]: "Ready for Distribution",
  [RELIEF_PACK_READINESS_STATUS.NEEDS_REPLENISHMENT]: "Needs Replenishment",
});

const getPositiveNumber = (value) => {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
};

const normalizeIdentifier = (value) => String(value || "").trim();

const getTemplateFamilySizeCoverage = (template) => {
  const parsedCoverage = Number.parseInt(
    String(template?.description || "").trim(),
    10,
  );

  return Number.isInteger(parsedCoverage) && parsedCoverage > 0
    ? parsedCoverage
    : 0;
};

export const getReliefPackTemplatePackMultiplier = (
  template,
  householdSize,
) => {
  if (!template?.based_on_family_size) {
    return 1;
  }

  const normalizedHouseholdSize = Number.parseInt(String(householdSize || 0), 10);
  const familySizeCoverage = getTemplateFamilySizeCoverage(template);

  if (
    !Number.isInteger(normalizedHouseholdSize) ||
    normalizedHouseholdSize <= 0 ||
    familySizeCoverage <= 0
  ) {
    return 1;
  }

  return Math.max(1, Math.ceil(normalizedHouseholdSize / familySizeCoverage));
};

const getEligibleAvailabilityByItemId = ({
  inventoryBatches = [],
  targetDisasterEventId,
  disasterEvents = [],
  referenceDate = new Date(),
} = {}) => {
  const availabilityByItemId = new Map();

  (inventoryBatches || []).forEach((batch) => {
    if (
      !isReliefPackInventoryBatchEligible(
        batch,
        referenceDate,
        {
          targetDisasterEventId,
          disasterEvents,
        },
      )
    ) {
      return;
    }

    const itemId = normalizeIdentifier(batch?.inventory_item_id);
    const quantityAvailable = getPositiveNumber(batch?.quantity_available);

    if (!itemId || quantityAvailable <= 0) {
      return;
    }

    availabilityByItemId.set(
      itemId,
      (availabilityByItemId.get(itemId) || 0) + quantityAvailable,
    );
  });

  return availabilityByItemId;
};

const buildHouseholdReadinessTemplates = (templates, householdSize) =>
  (templates || [])
    .filter((template) => template?.id && template?.is_active !== false)
    .map((template) => {
      const packMultiplier = getReliefPackTemplatePackMultiplier(
        template,
        householdSize,
      );

      return {
        ...template,
        items: (Array.isArray(template.items) ? template.items : []).map(
          (item) => ({
            ...item,
            inventory_item_id:
              normalizeIdentifier(item?.inventory_item_id) ||
              item?.inventory_item_id,
            quantity_required:
              getPositiveNumber(item?.quantity_required) * packMultiplier,
          }),
        ),
      };
    });

const buildReadinessResult = ({
  allocation,
  template,
  packMultiplier = 1,
}) => {
  const templateItems = Array.isArray(template?.items) ? template.items : [];
  const hasValidItems =
    templateItems.length > 0 &&
    templateItems.every(
      (item) =>
        Boolean(normalizeIdentifier(item?.inventory_item_id)) &&
        getPositiveNumber(item?.quantity_required) > 0,
    );
  const shortageItems = Array.isArray(allocation?.shortageItems)
    ? allocation.shortageItems
    : [];
  const isReady =
    hasValidItems &&
    Number(allocation?.packsWeCanCreate || 0) >= 1 &&
    shortageItems.length === 0;
  const status = isReady
    ? RELIEF_PACK_READINESS_STATUS.READY
    : RELIEF_PACK_READINESS_STATUS.NEEDS_REPLENISHMENT;

  return {
    status,
    label: RELIEF_PACK_READINESS_LABELS[status],
    isReady,
    packMultiplier,
    shortageItems,
  };
};

export const getReliefPackReadinessForTemplates = ({
  templates = [],
  inventoryBatches = [],
  targetDisasterEventId,
  disasterEvents = [],
  householdSize = 0,
  referenceDate = new Date(),
} = {}) => {
  const readinessTemplates = buildHouseholdReadinessTemplates(
    templates,
    householdSize,
  );
  const availabilityByItemId = getEligibleAvailabilityByItemId({
    inventoryBatches,
    targetDisasterEventId,
    disasterEvents,
    referenceDate,
  });
  const demandByTemplateId = new Map(
    readinessTemplates.map((template) => [template.id, { neededPacks: 1 }]),
  );
  const { allocationByTemplateId } = allocateSharedReliefPackInventory({
    templates: readinessTemplates,
    availabilityByItemId,
    demandByTemplateId,
    getItemRequiredQuantity: (item) => getPositiveNumber(item?.quantity_required),
  });
  const byTemplateId = new Map();

  readinessTemplates.forEach((template) => {
    byTemplateId.set(
      template.id,
      buildReadinessResult({
        allocation: allocationByTemplateId.get(template.id),
        template,
        packMultiplier: getReliefPackTemplatePackMultiplier(
          template,
          householdSize,
        ),
      }),
    );
  });

  const readinessValues = [...byTemplateId.values()];
  const isReady =
    readinessValues.length > 0 && readinessValues.every((entry) => entry.isReady);
  const status = isReady
    ? RELIEF_PACK_READINESS_STATUS.READY
    : RELIEF_PACK_READINESS_STATUS.NEEDS_REPLENISHMENT;

  return {
    status,
    label: RELIEF_PACK_READINESS_LABELS[status],
    isReady,
    byTemplateId,
  };
};
