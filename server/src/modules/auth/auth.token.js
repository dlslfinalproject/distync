const jwt = require("jsonwebtoken");

const TOKEN_ISSUER = "distync-api";
const TOKEN_AUDIENCE = "distync-client";
const TOKEN_EXPIRY = "8h";

const getAccessTokenSecret = () => {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim()) {
    return process.env.JWT_SECRET.trim();
  }

  if (process.env.NODE_ENV === "production") {
    const error = new Error("JWT_SECRET is required in production");
    error.statusCode = 500;
    throw error;
  }

  return "distync-dev-only-secret";
};

const createAccessToken = ({
  userId,
  roleCode,
  email,
  defaultBarangayId,
}) => {
  return jwt.sign(
    {
      sub: userId,
      role: roleCode,
      email,
      default_barangay_id: defaultBarangayId || null,
    },
    getAccessTokenSecret(),
    {
      expiresIn: TOKEN_EXPIRY,
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    },
  );
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, getAccessTokenSecret(), {
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
  });
};

module.exports = {
  TOKEN_EXPIRY,
  createAccessToken,
  verifyAccessToken,
};
