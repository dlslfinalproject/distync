const test = require("node:test");
const assert = require("node:assert/strict");

const servicePath = require.resolve("../src/modules/auth/auth.service");
const repositoryPath = require.resolve("../src/modules/auth/auth.repository");
const accessModePath = require.resolve("../src/config/accessMode");
const tokenPath = require.resolve("../src/modules/auth/auth.token");

const withStubbedAuthService = async (stubs, runTest) => {
  const dependencyPaths = [repositoryPath, accessModePath, tokenPath];
  const originalEntries = new Map(
    dependencyPaths.map((modulePath) => [modulePath, require.cache[modulePath]]),
  );

  delete require.cache[servicePath];

  try {
    dependencyPaths.forEach((modulePath) => {
      require.cache[modulePath] = {
        id: modulePath,
        filename: modulePath,
        loaded: true,
        exports: stubs[modulePath],
      };
    });

    const authService = require(servicePath);
    await runTest(authService);
  } finally {
    delete require.cache[servicePath];

    dependencyPaths.forEach((modulePath) => {
      const originalEntry = originalEntries.get(modulePath);

      if (originalEntry) {
        require.cache[modulePath] = originalEntry;
      } else {
        delete require.cache[modulePath];
      }
    });
  }
};

const withMockedGoogleToken = async (tokenPayload, runTest) => {
  const originalFetch = global.fetch;
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  const requests = [];

  process.env.GOOGLE_CLIENT_ID = "google-auth-regression-client";
  global.fetch = async (requestUrl) => {
    requests.push(String(requestUrl));

    return {
      ok: true,
      async json() {
        return {
          aud: "google-auth-regression-client",
          iss: "https://accounts.google.com",
          email_verified: true,
          given_name: "Google",
          family_name: "Fixture",
          ...tokenPayload,
        };
      },
    };
  };

  try {
    await runTest(requests);
  } finally {
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      delete global.fetch;
    }

    if (originalClientId === undefined) {
      delete process.env.GOOGLE_CLIENT_ID;
    } else {
      process.env.GOOGLE_CLIENT_ID = originalClientId;
    }
  }
};

const buildUser = (overrides = {}) => ({
  id: "user-google-fixture",
  google_sub: "google-sub-fixture",
  email: "example@domain.com",
  first_name: "Existing",
  middle_name: null,
  last_name: "Account",
  default_barangay_id: "barangay-fixture",
  is_active: true,
  ...overrides,
});

const withGoogleAuthHarness = async (
  { tokenPayload, repository = {} },
  runTest,
) => {
  const calls = {
    googleSubLookups: [],
    emailLookups: [],
    identityUpdates: [],
    roleLookups: [],
    tokenPayloads: [],
  };

  const userByGoogleSub = repository.getUserByGoogleSub || (async () => null);
  const userByEmail = repository.getUserByEmail || (async () => null);
  const updateGoogleIdentity =
    repository.updateUserGoogleIdentity ||
    (async (userId, update) => ({
      ...buildUser({ id: userId }),
      google_sub: update.googleSub,
      first_name: update.firstName || "Existing",
      last_name: update.lastName || "Account",
    }));
  const roleByUserId =
    repository.getRoleByUserId || (async () => ({ code: "MAYOR" }));

  await withMockedGoogleToken(tokenPayload, async (requests) => {
    await withStubbedAuthService(
      {
        [repositoryPath]: {
          getUserByGoogleSub: async (googleSub) => {
            calls.googleSubLookups.push(googleSub);
            return userByGoogleSub(googleSub);
          },
          getUserByEmail: async (email) => {
            calls.emailLookups.push(email);
            return userByEmail(email);
          },
          updateUserGoogleIdentity: async (userId, update) => {
            calls.identityUpdates.push({ userId, update });
            return updateGoogleIdentity(userId, update);
          },
          getRoleByUserId: async (userId) => {
            calls.roleLookups.push(userId);
            return roleByUserId(userId);
          },
        },
        [accessModePath]: {
          isDevelopmentBypassEnabled: () => false,
        },
        [tokenPath]: {
          TOKEN_EXPIRY: "8h",
          createAccessToken: (payload) => {
            calls.tokenPayloads.push(payload);
            return `fixture-jwt-${payload.roleCode}`;
          },
        },
      },
      async (authService) => runTest(authService, { calls, requests }),
    );
  });
};

const assertAuthorizationError = async (operation, expectedStatus = 403) => {
  await assert.rejects(operation, (error) => {
    assert.equal(error.statusCode, expectedStatus);
    assert.equal(error.message, "This account is not authorized to access DISTYNC.");
    return true;
  });
};

test("Google authentication uses google_sub first and preserves role-bearing JWT session context", async () => {
  const user = buildUser({ google_sub: "subject-match" });

  await withGoogleAuthHarness(
    {
      tokenPayload: {
        sub: "subject-match",
        email: "IGNORED-BECAUSE-SUB-MATCH@DOMAIN.COM",
      },
      repository: {
        getUserByGoogleSub: async (googleSub) => {
          assert.equal(googleSub, "subject-match");
          return user;
        },
        getUserByEmail: async () => {
          throw new Error("email fallback must not run after a subject match");
        },
        getRoleByUserId: async (userId) => {
          assert.equal(userId, user.id);
          return { code: "MAYOR" };
        },
      },
    },
    async (_authService, { calls, requests }) => {
      const session = await _authService.authenticateWithGoogle("mock-id-token");

      assert.equal(requests.length, 1);
      assert.match(requests[0], /oauth2\.googleapis\.com\/tokeninfo/);
      assert.match(requests[0], /id_token=mock-id-token/);
      assert.deepEqual(calls.googleSubLookups, ["subject-match"]);
      assert.deepEqual(calls.emailLookups, []);
      assert.deepEqual(calls.identityUpdates, []);
      assert.deepEqual(calls.tokenPayloads, [
        {
          userId: user.id,
          roleCode: "MAYOR",
          email: user.email,
          defaultBarangayId: user.default_barangay_id,
        },
      ]);
      assert.equal(session.access_token, "fixture-jwt-MAYOR");
      assert.equal(session.token_type, "Bearer");
      assert.equal(session.expires_in, "8h");
      assert.equal(session.user.id, user.id);
      assert.equal(session.user.role, "MAYOR");
      assert.equal(session.user.email, user.email);
      assert.equal(session.user.default_barangay_id, user.default_barangay_id);
      assert.equal(session.user.is_active, true);
    },
  );
});

test("Google email fallback remains case-insensitive and lowercases the verified token email", async () => {
  const user = buildUser({ google_sub: null, email: "example@domain.com" });

  await withGoogleAuthHarness(
    {
      tokenPayload: {
        sub: "subject-email-fallback",
        email: "EXAMPLE@DOMAIN.COM",
      },
      repository: {
        getUserByGoogleSub: async () => null,
        getUserByEmail: async (email) => {
          assert.equal(email, "example@domain.com");
          return user;
        },
        updateUserGoogleIdentity: async (_userId, update) =>
          buildUser({ google_sub: update.googleSub }),
        getRoleByUserId: async () => ({ code: "MSWDO" }),
      },
    },
    async (authService, { calls }) => {
      const session = await authService.authenticateWithGoogle("mock-token");

      assert.deepEqual(calls.googleSubLookups, ["subject-email-fallback"]);
      assert.deepEqual(calls.emailLookups, ["example@domain.com"]);
      assert.equal(session.user.role, "MSWDO");
    },
  );
});

test("Google authentication binds a previously-null google_sub to the verified subject", async () => {
  const user = buildUser({
    id: "user-null-sub",
    google_sub: null,
    first_name: "",
    last_name: "",
  });
  const boundUser = buildUser({
    ...user,
    google_sub: "subject-to-bind",
    first_name: "Google",
    last_name: "Fixture",
  });

  await withGoogleAuthHarness(
    {
      tokenPayload: {
        sub: "subject-to-bind",
        email: "EXAMPLE@DOMAIN.COM",
        given_name: "Google",
        family_name: "Fixture",
      },
      repository: {
        getUserByGoogleSub: async () => null,
        getUserByEmail: async () => user,
        updateUserGoogleIdentity: async (userId, update) => {
          assert.equal(userId, user.id);
          assert.deepEqual(update, {
            googleSub: "subject-to-bind",
            firstName: "Google",
            lastName: "Fixture",
          });
          return boundUser;
        },
        getRoleByUserId: async () => ({ code: "BARANGAY" }),
      },
    },
    async (authService, { calls }) => {
      const session = await authService.authenticateWithGoogle("mock-token");

      assert.equal(calls.identityUpdates.length, 1);
      assert.equal(session.user.id, user.id);
      assert.equal(session.user.role, "BARANGAY");
    },
  );
});

test("Google authentication rejects an email row already bound to a conflicting subject", async () => {
  const conflictingUser = buildUser({ google_sub: "different-subject" });

  await withGoogleAuthHarness(
    {
      tokenPayload: {
        sub: "authenticated-subject",
        email: "EXAMPLE@DOMAIN.COM",
      },
      repository: {
        getUserByGoogleSub: async () => null,
        getUserByEmail: async () => conflictingUser,
      },
    },
    async (authService, { calls }) => {
      await assertAuthorizationError(() =>
        authService.authenticateWithGoogle("mock-token"),
      );
      assert.equal(calls.roleLookups.length, 0);
      assert.equal(calls.tokenPayloads.length, 0);
      assert.equal(calls.identityUpdates.length, 0);
    },
  );
});

test("Google authentication rejects an unknown or unprovisioned account", async () => {
  await withGoogleAuthHarness(
    {
      tokenPayload: {
        sub: "unknown-subject",
        email: "UNKNOWN@DOMAIN.COM",
      },
      repository: {
        getUserByGoogleSub: async () => null,
        getUserByEmail: async (email) => {
          assert.equal(email, "unknown@domain.com");
          return null;
        },
      },
    },
    async (authService, { calls }) => {
      await assertAuthorizationError(() =>
        authService.authenticateWithGoogle("mock-token"),
      );
      assert.equal(calls.roleLookups.length, 0);
      assert.equal(calls.tokenPayloads.length, 0);
    },
  );
});

test("Google authentication rejects an inactive account before role resolution", async () => {
  const inactiveUser = buildUser({ is_active: false });

  await withGoogleAuthHarness(
    {
      tokenPayload: {
        sub: inactiveUser.google_sub,
        email: inactiveUser.email,
      },
      repository: {
        getUserByGoogleSub: async () => inactiveUser,
        getRoleByUserId: async () => {
          throw new Error("inactive accounts must not resolve a role");
        },
      },
    },
    async (authService, { calls }) => {
      await assertAuthorizationError(() =>
        authService.authenticateWithGoogle("mock-token"),
      );
      assert.equal(calls.roleLookups.length, 0);
      assert.equal(calls.tokenPayloads.length, 0);
    },
  );
});

test("Google authentication resolves each supported active staff role into the session context", async () => {
  for (const roleCode of ["MAYOR", "MSWDO", "BARANGAY"]) {
    const user = buildUser({
      id: `user-${roleCode.toLowerCase()}`,
      google_sub: `subject-${roleCode.toLowerCase()}`,
    });

    await withGoogleAuthHarness(
      {
        tokenPayload: {
          sub: user.google_sub,
          email: user.email,
        },
        repository: {
          getUserByGoogleSub: async () => user,
          getRoleByUserId: async (userId) => {
            assert.equal(userId, user.id);
            return { code: roleCode };
          },
        },
      },
      async (authService, { calls }) => {
        const session = await authService.authenticateWithGoogle("mock-token");

        assert.deepEqual(calls.roleLookups, [user.id]);
        assert.equal(calls.tokenPayloads[0].roleCode, roleCode);
        assert.equal(session.user.role, roleCode);
        assert.equal(session.access_token, `fixture-jwt-${roleCode}`);
      },
    );
  }
});

test("Google authentication rejects an account whose resolved role is not an authorized staff role", async () => {
  const user = buildUser();

  await withGoogleAuthHarness(
    {
      tokenPayload: {
        sub: user.google_sub,
        email: user.email,
      },
      repository: {
        getUserByGoogleSub: async () => user,
        getRoleByUserId: async () => ({ code: "DONOR" }),
      },
    },
    async (authService, { calls }) => {
      await assertAuthorizationError(() =>
        authService.authenticateWithGoogle("mock-token"),
      );
      assert.equal(calls.tokenPayloads.length, 0);
    },
  );
});
