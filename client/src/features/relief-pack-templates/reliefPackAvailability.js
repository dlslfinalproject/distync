const getNumericValue = (value) => {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
};

const getMapValue = (valueMap, key) => {
  if (valueMap instanceof Map) {
    return getNumericValue(valueMap.get(key));
  }

  return getNumericValue(valueMap?.[key]);
};

const compareTemplateNames = (leftTemplate, rightTemplate) => {
  const nameComparison = String(leftTemplate?.name || "").localeCompare(
    String(rightTemplate?.name || ""),
  );

  if (nameComparison !== 0) {
    return nameComparison;
  }

  return String(leftTemplate?.id || "").localeCompare(
    String(rightTemplate?.id || ""),
  );
};

export const sortReliefPackTemplatesForSharedInventory = (templates) => {
  return [...(templates || [])]
    .filter((template) => template?.is_active !== false)
    .sort((leftTemplate, rightTemplate) => {
      const leftIsAdditional = Boolean(leftTemplate?.is_additional_pack);
      const rightIsAdditional = Boolean(rightTemplate?.is_additional_pack);

      if (leftIsAdditional !== rightIsAdditional) {
        return leftIsAdditional ? 1 : -1;
      }

      if (!leftIsAdditional && !rightIsAdditional) {
        const leftIsFamilySize = Boolean(leftTemplate?.based_on_family_size);
        const rightIsFamilySize = Boolean(rightTemplate?.based_on_family_size);

        if (leftIsFamilySize !== rightIsFamilySize) {
          return leftIsFamilySize ? -1 : 1;
        }
      }

      return compareTemplateNames(leftTemplate, rightTemplate);
    });
};

const getTemplateItemRequirements = (template, getItemRequiredQuantity) => {
  const requirementsByItemId = new Map();
  const itemNamesByItemId = new Map();
  let hasInvalidItem = false;

  (Array.isArray(template?.items) ? template.items : []).forEach((item) => {
    const inventoryItemId = item?.inventory_item_id;
    const requiredQuantity = getNumericValue(getItemRequiredQuantity(item));

    if (!inventoryItemId || requiredQuantity <= 0) {
      hasInvalidItem = true;
      return;
    }

    requirementsByItemId.set(
      inventoryItemId,
      (requirementsByItemId.get(inventoryItemId) || 0) + requiredQuantity,
    );

    if (!itemNamesByItemId.has(inventoryItemId)) {
      itemNamesByItemId.set(
        inventoryItemId,
        item?.inventory_item?.item_name || "Unknown item",
      );
    }
  });

  return {
    hasInvalidItem,
    requirementsByItemId,
    itemNamesByItemId,
  };
};

const buildEmptyAllocation = () => ({
  packsWeCanCreate: 0,
  availableStockByItemId: new Map(),
  allocatedStockByItemId: new Map(),
  shortageItems: [],
});

export const allocateSharedReliefPackInventory = ({
  templates = [],
  availabilityByItemId = new Map(),
  demandByTemplateId = new Map(),
  getItemRequiredQuantity = (item) =>
    getNumericValue(item?.quantity_required || 0),
} = {}) => {
  const remainingAvailabilityByItemId = new Map();

  if (availabilityByItemId instanceof Map) {
    availabilityByItemId.forEach((quantity, itemId) => {
      const normalizedQuantity = getNumericValue(quantity);

      if (normalizedQuantity > 0) {
        remainingAvailabilityByItemId.set(itemId, normalizedQuantity);
      }
    });
  } else {
    Object.entries(availabilityByItemId || {}).forEach(([itemId, quantity]) => {
      const normalizedQuantity = getNumericValue(quantity);

      if (normalizedQuantity > 0) {
        remainingAvailabilityByItemId.set(itemId, normalizedQuantity);
      }
    });
  }

  const allocationByTemplateId = new Map();
  const activeTemplates = sortReliefPackTemplatesForSharedInventory(templates);

  (templates || [])
    .filter((template) => template?.is_active === false)
    .forEach((template) => {
      allocationByTemplateId.set(template.id, buildEmptyAllocation());
    });

  activeTemplates.forEach((template) => {
    const demand =
      demandByTemplateId instanceof Map
        ? demandByTemplateId.get(template.id)
        : demandByTemplateId?.[template.id];
    const neededPacks = Math.floor(getNumericValue(demand?.neededPacks));
    const {
      hasInvalidItem,
      requirementsByItemId,
      itemNamesByItemId,
    } = getTemplateItemRequirements(template, getItemRequiredQuantity);
    const availableStockByItemId = new Map();

    requirementsByItemId.forEach((_requiredQuantity, itemId) => {
      availableStockByItemId.set(
        itemId,
        getMapValue(remainingAvailabilityByItemId, itemId),
      );
    });

    const hasRequirements = requirementsByItemId.size > 0;
    const packsByItem = hasRequirements
      ? [...requirementsByItemId.entries()].map(([itemId, requiredQuantity]) =>
          Math.floor(
            getMapValue(remainingAvailabilityByItemId, itemId) /
              requiredQuantity,
          ),
        )
      : [];
    const packCapacity =
      !hasInvalidItem && hasRequirements ? Math.min(...packsByItem) : 0;
    const packsWeCanCreate =
      neededPacks > 0 ? Math.min(packCapacity, neededPacks) : 0;
    const allocatedStockByItemId = new Map();
    const shortageItems = [];

    requirementsByItemId.forEach((requiredQuantity, itemId) => {
      const availableQuantity = getMapValue(
        remainingAvailabilityByItemId,
        itemId,
      );
      const allocatedQuantity = packsWeCanCreate * requiredQuantity;
      const shortageQuantity = Math.max(
        neededPacks * requiredQuantity - availableQuantity,
        0,
      );

      allocatedStockByItemId.set(itemId, allocatedQuantity);

      if (shortageQuantity > 0) {
        shortageItems.push({
          inventory_item_id: itemId,
          item_name: itemNamesByItemId.get(itemId) || "Unknown item",
          shortage_quantity: shortageQuantity,
        });
      }

      const remainingQuantity = Math.max(
        availableQuantity - allocatedQuantity,
        0,
      );

      if (remainingQuantity > 0) {
        remainingAvailabilityByItemId.set(itemId, remainingQuantity);
      } else {
        remainingAvailabilityByItemId.delete(itemId);
      }
    });

    shortageItems.sort(
      (leftItem, rightItem) =>
        rightItem.shortage_quantity - leftItem.shortage_quantity,
    );

    allocationByTemplateId.set(template.id, {
      packsWeCanCreate: Number.isFinite(packsWeCanCreate)
        ? packsWeCanCreate
        : 0,
      availableStockByItemId,
      allocatedStockByItemId,
      shortageItems,
    });
  });

  return {
    allocationByTemplateId,
    remainingAvailabilityByItemId,
  };
};
