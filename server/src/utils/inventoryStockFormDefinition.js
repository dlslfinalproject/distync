const normalizeStockFormDefinitionText = (value) =>
  String(value ?? "").trim().toLowerCase();

const normalizeStockFormDefinitionNumber = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const areInventoryStockFormDefinitionsEqual = (
  firstDefinition,
  secondDefinition,
) =>
  normalizeStockFormDefinitionText(firstDefinition?.packaging) ===
    normalizeStockFormDefinitionText(secondDefinition?.packaging) &&
  normalizeStockFormDefinitionNumber(firstDefinition?.units_per_packaging) ===
    normalizeStockFormDefinitionNumber(secondDefinition?.units_per_packaging) &&
  normalizeStockFormDefinitionText(firstDefinition?.unit_of_measure) ===
    normalizeStockFormDefinitionText(secondDefinition?.unit_of_measure) &&
  normalizeStockFormDefinitionNumber(firstDefinition?.unit_of_measure_value) ===
    normalizeStockFormDefinitionNumber(secondDefinition?.unit_of_measure_value);

module.exports = {
  normalizeStockFormDefinitionText,
  normalizeStockFormDefinitionNumber,
  areInventoryStockFormDefinitionsEqual,
};
