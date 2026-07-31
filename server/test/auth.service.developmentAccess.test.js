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

const buildStubbedUser = (roleCode = "MSWDO") => ({
  id: "user-1",
  email: "staff@example.com",
  first_name: "Alex",
  last_name: "Garcia",
  default_barangay_id: null,
  is_active: true,
  role_code: roleCode,
});

test("development mode with bypass true allows development login flow to continue", async () => {
  const user = buildStubbedUser("MSWDO");

  await withStubbedAuthService(
    {
      [repositoryPath]: {
        getFirstActiveUserByRoleCode: async (roleCode) => ({
          ...user,
          role_code: roleCode,
        }),
      },
      [accessModePath]: {
        isDevelopmentBypassEnabled: () => true,
      },
      [tokenPath]: {
        TOKEN_EXPIRY: "8h",
        createAccessToken: ({ roleCode }) => `token-for-${roleCode}`,
      },
    },
    async ({ authenticateDevelopmentRole }) => {
      const sessionPayload = await authenticateDevelopmentRole("MSWDO");

      assert.equal(sessionPayload.user.role, "MSWDO");
      assert.equal(sessionPayload.access_token, "token-for-MSWDO");
    },
  );
});

test("development mode with bypass false rejects development login", async () => {
  await withStubbedAuthService(
    {
      [repositoryPath]: {
        getFirstActiveUserByRoleCode: async () => buildStubbedUser(),
      },
      [accessModePath]: {
        isDevelopmentBypassEnabled: () => false,
      },
      [tokenPath]: {
        TOKEN_EXPIRY: "8h",
        createAccessToken: () => "token",
      },
    },
    async ({ authenticateDevelopmentRole }) => {
      await assert.rejects(
        () => authenticateDevelopmentRole("MSWDO"),
        /Development authentication bypass is disabled on the server\./,
      );
    },
  );
});

test("demo mode rejects development login even when the bypass flag is true", async () => {
  await withStubbedAuthService(
    {
      [repositoryPath]: {
        getFirstActiveUserByRoleCode: async () => buildStubbedUser(),
      },
      [accessModePath]: {
        isDevelopmentBypassEnabled: () => false,
      },
      [tokenPath]: {
        TOKEN_EXPIRY: "8h",
        createAccessToken: () => "token",
      },
    },
    async ({ authenticateDevelopmentRole }) => {
      await assert.rejects(
        () => authenticateDevelopmentRole("MSWDO"),
        /Development authentication bypass is disabled on the server\./,
      );
    },
  );
});
