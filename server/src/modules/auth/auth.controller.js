const authService = require("./auth.service");

const loginWithGoogle = async (req, res) => {
  try {
    const idToken = req.body?.id_token || req.body?.credential;

    if (!idToken || typeof idToken !== "string") {
      return res.status(400).json({
        message: "id_token is required",
      });
    }

    const sessionPayload = await authService.authenticateWithGoogle(idToken);

    return res.status(200).json(sessionPayload);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to authenticate with Google",
    });
  }
};

module.exports = {
  loginWithGoogle,
};
