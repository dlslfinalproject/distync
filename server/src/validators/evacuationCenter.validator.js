const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUuid = (value) => {
  return typeof value === "string" && uuidPattern.test(value);
};

const validateBarangayIdParam = (req, res, next) => {
  try {
    const { barangayId } = req.params;

    if (!isValidUuid(barangayId)) {
      return res.status(400).json({
        message: "barangayId must be a valid UUID",
      });
    }

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate barangayId",
      error: error.message,
    });
  }
};

module.exports = {
  validateBarangayIdParam,
};
