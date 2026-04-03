const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUuid = (value) => {
  return typeof value === "string" && uuidPattern.test(value);
};

const parseOptionalBoolean = (value) => {
  if (value === undefined) {
    return { isProvided: false, value: null };
  }

  if (value === "true") {
    return { isProvided: true, value: true };
  }

  if (value === "false") {
    return { isProvided: true, value: false };
  }

  return { isProvided: true, value: "invalid" };
};

const validateSupplierId = (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        message: "id must be a valid UUID",
      });
    }

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate supplier id",
      error: error.message,
    });
  }
};

const validateGetSuppliers = (req, res, next) => {
  try {
    const { search, has_moa } = req.query;
    const parsedHasMoa = parseOptionalBoolean(has_moa);

    if (parsedHasMoa.value === "invalid") {
      return res.status(400).json({
        message: "has_moa must be true or false when provided",
      });
    }

    req.validatedQuery = {
      search: typeof search === "string" && search.trim() ? search.trim() : null,
      has_moa: parsedHasMoa.isProvided ? parsedHasMoa.value : null,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate supplier filters",
      error: error.message,
    });
  }
};

const validateSupplierPayload = (req, res, next) => {
  try {
    const {
      name,
      contact_person,
      contact_number,
      address,
      has_moa,
      notes,
    } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        message: "name is required and must be a non-empty string",
      });
    }

    if (
      contact_person !== undefined &&
      contact_person !== null &&
      typeof contact_person !== "string"
    ) {
      return res.status(400).json({
        message: "contact_person must be a string or null",
      });
    }

    if (
      contact_number !== undefined &&
      contact_number !== null &&
      typeof contact_number !== "string"
    ) {
      return res.status(400).json({
        message: "contact_number must be a string or null",
      });
    }

    if (address !== undefined && address !== null && typeof address !== "string") {
      return res.status(400).json({
        message: "address must be a string or null",
      });
    }

    if (has_moa !== undefined && typeof has_moa !== "boolean") {
      return res.status(400).json({
        message: "has_moa must be a boolean when provided",
      });
    }

    if (notes !== undefined && notes !== null && typeof notes !== "string") {
      return res.status(400).json({
        message: "notes must be a string or null",
      });
    }

    req.validatedBody = {
      name: name.trim(),
      contact_person: contact_person ?? null,
      contact_number: contact_number ?? null,
      address: address ?? null,
      has_moa: has_moa ?? false,
      notes: notes ?? null,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate supplier payload",
      error: error.message,
    });
  }
};

module.exports = {
  validateSupplierId,
  validateGetSuppliers,
  validateSupplierPayload,
};
