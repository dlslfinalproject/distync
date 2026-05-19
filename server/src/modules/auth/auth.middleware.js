const { verifyAccessToken } = require("./auth.token");

const ROLE_CODES = {
  BARANGAY: "BARANGAY",
  MSWDO: "MSWDO",
  MAYOR: "MAYOR",
  DONOR: "DONOR",
};

const extractBearerToken = (authorizationHeader) => {
  if (
    typeof authorizationHeader !== "string" ||
    !authorizationHeader.startsWith("Bearer ")
  ) {
    return null;
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();
  return token || null;
};

const requireAuthentication = (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({
        message: "Authentication is required for this request",
      });
    }

    const decodedToken = verifyAccessToken(token);

    req.auth = {
      userId: decodedToken.sub,
      roleCode: decodedToken.role,
      email: decodedToken.email || null,
      defaultBarangayId: decodedToken.default_barangay_id || null,
    };

    return next();
  } catch (error) {
    return res.status(401).json({
      message: "Your session is invalid or has expired. Please sign in again.",
    });
  }
};

const requireRoles = (...allowedRoles) => {
  return (req, res, next) => {
    requireAuthentication(req, res, () => {
      if (!allowedRoles.includes(req.auth.roleCode)) {
        return res.status(403).json({
          message: "You do not have permission to access this resource",
        });
      }

      return next();
    });
  };
};

module.exports = {
  ROLE_CODES,
  requireAuthentication,
  requireRoles,
};
