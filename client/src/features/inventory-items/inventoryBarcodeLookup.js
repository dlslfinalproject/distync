import { normalizeInventoryBarcode } from "./inventoryBarcode.js";

export const findInventoryItemBarcodeMatch = (
  inventoryItems = [],
  barcode,
) => {
  const normalizedBarcode = normalizeInventoryBarcode(barcode);

  if (!normalizedBarcode) {
    return null;
  }

  const items = Array.isArray(inventoryItems) ? inventoryItems : [];
  const canonicalMatches = [];

  for (const item of items) {
    for (const stockForm of Array.isArray(item?.stock_forms)
      ? item.stock_forms
      : []) {
      if (normalizeInventoryBarcode(stockForm?.barcode) === normalizedBarcode) {
        canonicalMatches.push({ item, stockForm });
      }
    }
  }

  if (canonicalMatches.length > 1) {
    return { ambiguous: true };
  }

  if (canonicalMatches.length === 1) {
    const match = canonicalMatches[0];

    if (match.item?.is_active === false || match.stockForm?.is_active === false) {
      return { inactive: true };
    }

    return match;
  }

  const legacyMatches = items.filter(
    (item) => normalizeInventoryBarcode(item?.barcode) === normalizedBarcode,
  );

  if (legacyMatches.length > 1) {
    return { ambiguous: true };
  }

  if (legacyMatches.length !== 1) {
    return null;
  }

  return legacyMatches[0]?.is_active === false
    ? { inactive: true }
    : { item: legacyMatches[0], stockForm: null };
};
