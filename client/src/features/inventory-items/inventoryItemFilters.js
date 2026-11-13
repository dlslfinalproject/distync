const normalizeInventoryFilterText = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const normalizeInventoryCategory = (value) =>
  normalizeInventoryFilterText(value).replace(/[\s_]+/g, "-");

const getInventoryItemStockForms = (item) =>
  Array.isArray(item?.stock_forms) ? item.stock_forms : [];

export const matchesInventoryItemSearch = (item, searchTerm) => {
  const normalizedSearchTerm = normalizeInventoryFilterText(searchTerm);

  if (!normalizedSearchTerm) {
    return true;
  }

  const searchableValues = [
    item?.item_name,
    item?.name,
    item?.product_name,
    item?.item_code,
    item?.barcode,
    item?.category,
    item?.unit_of_measure,
    item?.tracking_method,
    item?.packaging,
    ...getInventoryItemStockForms(item).flatMap((stockForm) => [
      stockForm?.barcode,
      stockForm?.packaging,
      stockForm?.units_per_packaging,
      stockForm?.unit_of_measure,
      stockForm?.unit_of_measure_value,
    ]),
  ];

  return searchableValues.some((value) =>
    normalizeInventoryFilterText(value).includes(normalizedSearchTerm),
  );
};

export const matchesInventoryItemCategory = (item, category) => {
  const normalizedCategory = normalizeInventoryCategory(category) || "all";

  if (normalizedCategory === "all") {
    return true;
  }

  const itemCategory = normalizeInventoryCategory(item?.category);

  if (itemCategory === normalizedCategory) {
    return true;
  }

  if (itemCategory === "perishable" || itemCategory === "non-perishable") {
    return false;
  }

  const normalizedPerishableFlag = normalizeInventoryFilterText(
    item?.is_perishable,
  );

  if (!["true", "false"].includes(normalizedPerishableFlag)) {
    return false;
  }

  return (
    normalizedPerishableFlag === "true" ? "perishable" : "non-perishable"
  ) === normalizedCategory;
};
