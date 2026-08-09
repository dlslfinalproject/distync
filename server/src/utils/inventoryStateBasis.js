const crypto = require("node:crypto");

const BASIS_VERSION = 1;
const TOKEN_ALGORITHM = "HMAC-SHA-256";
const TOKEN_ENCODING = "base64url";

const getSigningSecret = () => {
  const secret = String(process.env.INVENTORY_STATE_BASIS_SECRET || "").trim();

  if (!secret) {
    const error = new Error("Inventory state basis signing secret is not configured");
    error.code = "INVENTORY_STATE_BASIS_SECRET_MISSING";
    error.statusCode = 500;
    throw error;
  }

  return secret;
};

const assertInventoryStateBasisSecretConfigured = () => {
  getSigningSecret();
};

const normalizeBasisCore = (basis) => ({
  basisVersion: Number(basis?.basisVersion),
  inventoryBatchId: basis?.inventoryBatchId || null,
  inventoryItemId: basis?.inventoryItemId || null,
  stockVersion: Number(basis?.stockVersion),
  quantityAvailable: Number(basis?.quantityAvailable),
  status: basis?.status || null,
  expirationDate: basis?.expirationDate || null,
  observedServerAt: basis?.observedServerAt || null,
});

const buildSignedPayload = (basis) => {
  const normalized = normalizeBasisCore(basis);

  return JSON.stringify([
    normalized.basisVersion,
    normalized.inventoryBatchId,
    normalized.inventoryItemId,
    normalized.stockVersion,
    normalized.quantityAvailable,
    normalized.status,
    normalized.expirationDate,
    normalized.observedServerAt,
  ]);
};

const signBasisPayload = (basis) =>
  crypto
    .createHmac("sha256", getSigningSecret())
    .update(buildSignedPayload(basis))
    .digest(TOKEN_ENCODING);

const timingSafeEqualString = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ""), TOKEN_ENCODING);
  const rightBuffer = Buffer.from(String(right || ""), TOKEN_ENCODING);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const createInventoryStateBasis = (batch, observedServerAt = new Date().toISOString()) => {
  const basis = normalizeBasisCore({
    basisVersion: BASIS_VERSION,
    inventoryBatchId: batch?.id,
    inventoryItemId: batch?.inventory_item_id,
    stockVersion: batch?.stock_version,
    quantityAvailable: batch?.quantity_available,
    status: batch?.status,
    expirationDate: batch?.expiration_date || null,
    observedServerAt,
  });

  return {
    ...basis,
    token: signBasisPayload(basis),
  };
};

const verifyInventoryStateBasis = (basis) => {
  if (!basis || typeof basis !== "object" || typeof basis.token !== "string") {
    return { valid: false, reason: "MISSING_BASIS" };
  }

  const normalized = normalizeBasisCore(basis);

  if (
    normalized.basisVersion !== BASIS_VERSION ||
    !normalized.inventoryBatchId ||
    !Number.isInteger(normalized.stockVersion) ||
    !Number.isInteger(normalized.quantityAvailable) ||
    !normalized.observedServerAt
  ) {
    return { valid: false, reason: "INVALID_BASIS_SHAPE" };
  }

  const expectedToken = signBasisPayload(normalized);

  if (!timingSafeEqualString(expectedToken, basis.token)) {
    return { valid: false, reason: "INVALID_BASIS_TOKEN" };
  }

  return { valid: true, basis: normalized };
};

module.exports = {
  BASIS_VERSION,
  TOKEN_ALGORITHM,
  TOKEN_ENCODING,
  assertInventoryStateBasisSecretConfigured,
  createInventoryStateBasis,
  verifyInventoryStateBasis,
  buildSignedPayload,
};
