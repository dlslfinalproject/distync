const validateSaveCurrentSettings = (req, res, next) => {
  try {
    const { settings } = req.body || {};

    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      return res.status(400).json({
        message: "settings must be an object",
      });
    }

    req.validatedBody = {
      settings,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate settings payload",
      error: error.message,
    });
  }
};

module.exports = {
  validateSaveCurrentSettings,
};
