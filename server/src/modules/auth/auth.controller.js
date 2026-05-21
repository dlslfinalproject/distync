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

const loginWithDemoCredentials = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email) {
      return res.status(400).json({
        message: "email is required",
      });
    }

    if (!password) {
      return res.status(400).json({
        message: "password is required",
      });
    }

    const sessionPayload = await authService.authenticateWithDemoCredentials({
      email,
      password,
    });

    return res.status(200).json(sessionPayload);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to authenticate demo credentials",
    });
  }
};

const loginDevelopmentRole = async (req, res) => {
  try {
    const roleCode = String(req.body?.role || "").trim().toUpperCase();

    if (!roleCode) {
      return res.status(400).json({
        message: "role is required",
      });
    }

    const sessionPayload =
      await authService.authenticateDevelopmentRole(roleCode);

    return res.status(200).json(sessionPayload);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to authenticate development role",
    });
  }
};

module.exports = {
  loginWithDemoCredentials,
  loginDevelopmentRole,
  loginWithGoogle,
};
