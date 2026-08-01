const authRepository = require("./auth.repository");
const { isDevelopmentBypassEnabled } = require("../../config/accessMode");
const { TOKEN_EXPIRY, createAccessToken } = require("./auth.token");

const AUTHORIZED_ROLE_CODES = new Set(["MSWDO", "BARANGAY", "MAYOR"]);
const GOOGLE_ISSUERS = new Set([
  "accounts.google.com",
  "https://accounts.google.com",
]);

const getGoogleClientId = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId || typeof clientId !== "string" || !clientId.trim()) {
    const error = new Error("GOOGLE_CLIENT_ID is missing in the backend environment");
    error.statusCode = 500;
    throw error;
  }

  return clientId.trim();
};

const verifyGoogleIdToken = async (idToken) => {
  const googleClientId = getGoogleClientId();
  const tokenInfoUrl = new URL("https://oauth2.googleapis.com/tokeninfo");
  tokenInfoUrl.searchParams.set("id_token", idToken);

  let response;

  try {
    response = await fetch(tokenInfoUrl);
  } catch (error) {
    const verificationError = new Error("Failed to verify Google sign-in");
    verificationError.statusCode = 502;
    throw verificationError;
  }

  const payload = await response.json();

  if (!response.ok) {
    const error = new Error("Google sign-in could not be verified");
    error.statusCode = 401;
    throw error;
  }

  if (payload.aud !== googleClientId) {
    const error = new Error("Google token audience does not match this application");
    error.statusCode = 401;
    throw error;
  }

  if (!GOOGLE_ISSUERS.has(payload.iss)) {
    const error = new Error("Google token issuer is invalid");
    error.statusCode = 401;
    throw error;
  }

  if (!payload.sub || !payload.email) {
    const error = new Error("Google token is missing required identity claims");
    error.statusCode = 401;
    throw error;
  }

  if (!(payload.email_verified === true || payload.email_verified === "true")) {
    const error = new Error("Google account email must be verified");
    error.statusCode = 401;
    throw error;
  }

  return {
    sub: payload.sub,
    email: String(payload.email).toLowerCase(),
    firstName: payload.given_name || null,
    lastName: payload.family_name || null,
  };
};

const buildSessionPayload = (user, roleCode) => {
  const accessToken = createAccessToken({
    userId: user.id,
    roleCode,
    email: user.email,
    defaultBarangayId: user.default_barangay_id,
  });

  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: TOKEN_EXPIRY,
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      middle_name: user.middle_name || null,
      last_name: user.last_name,
      role: roleCode,
      default_barangay_id: user.default_barangay_id,
      is_active: user.is_active,
    },
  };
};

const resolveAuthorizedRoleForUser = async (user) => {
  if (!user.is_active) {
    const error = new Error("This account is not authorized to access DISTYNC.");
    error.statusCode = 403;
    throw error;
  }

  const role = await authRepository.getRoleByUserId(user.id);

  if (!role) {
    const error = new Error("This account is not authorized to access DISTYNC.");
    error.statusCode = 403;
    throw error;
  }

  if (!AUTHORIZED_ROLE_CODES.has(role.code)) {
    const error = new Error("This account is not authorized to access DISTYNC.");
    error.statusCode = 403;
    throw error;
  }

  return role.code;
};

const authenticateWithGoogle = async (idToken) => {
  const verifiedIdentity = await verifyGoogleIdToken(idToken);

  let user = await authRepository.getUserByGoogleSub(verifiedIdentity.sub);

  if (!user) {
    const userByEmail = await authRepository.getUserByEmail(verifiedIdentity.email);

    if (!userByEmail) {
      const error = new Error("This account is not authorized to access DISTYNC.");
      error.statusCode = 403;
      throw error;
    }

    if (
      userByEmail.google_sub &&
      userByEmail.google_sub !== verifiedIdentity.sub
    ) {
      const error = new Error("This account is not authorized to access DISTYNC.");
      error.statusCode = 403;
      throw error;
    }

    user = userByEmail;

    if (!user.google_sub) {
      user = await authRepository.updateUserGoogleIdentity(user.id, {
        googleSub: verifiedIdentity.sub,
        firstName: verifiedIdentity.firstName,
        lastName: verifiedIdentity.lastName,
      });
    }
  }

  const roleCode = await resolveAuthorizedRoleForUser(user);

  return buildSessionPayload(user, roleCode);
};

const authenticateDevelopmentRole = async (roleCode) => {
  if (!isDevelopmentBypassEnabled()) {
    const error = new Error(
      "Development authentication bypass is disabled on the server.",
    );
    error.statusCode = 403;
    throw error;
  }

  if (!AUTHORIZED_ROLE_CODES.has(roleCode)) {
    const error = new Error("Only staff roles are allowed for development login.");
    error.statusCode = 400;
    throw error;
  }

  const user = await authRepository.getFirstActiveUserByRoleCode(roleCode);

  if (!user) {
    const error = new Error(
      `No active seeded user is available for the ${roleCode} role.`,
    );
    error.statusCode = 404;
    throw error;
  }

  return buildSessionPayload(user, roleCode);
};

module.exports = {
  authenticateDevelopmentRole,
  authenticateWithGoogle,
};
