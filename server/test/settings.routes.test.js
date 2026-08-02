const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const routesPath = require.resolve("../src/routes/settings.routes");
const authMiddlewarePath = require.resolve("../src/modules/auth/auth.middleware");
const settingsServicePath = require.resolve("../src/services/settings.service");
const validatorPath = require.resolve("../src/validators/settings.validator");

const withStubbedSettingsRoute = async ({
  authMiddlewareStub,
  settingsServiceStub,
  validatorStub,
}, runTest) => {
  const dependencyPaths = [
    authMiddlewarePath,
    settingsServicePath,
    validatorPath,
  ];
  const originalEntries = new Map(
    dependencyPaths.map((modulePath) => [modulePath, require.cache[modulePath]]),
  );

  delete require.cache[routesPath];

  try {
    require.cache[authMiddlewarePath] = {
      id: authMiddlewarePath,
      filename: authMiddlewarePath,
      loaded: true,
      exports: authMiddlewareStub,
    };
    require.cache[settingsServicePath] = {
      id: settingsServicePath,
      filename: settingsServicePath,
      loaded: true,
      exports: settingsServiceStub,
    };
    require.cache[validatorPath] = {
      id: validatorPath,
      filename: validatorPath,
      loaded: true,
      exports: validatorStub,
    };

    const router = require(routesPath);
    await runTest(router);
  } finally {
    delete require.cache[routesPath];

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

test("settings save route hides raw SQL errors from the client", async () => {
  await withStubbedSettingsRoute(
    {
      authMiddlewareStub: {
        ROLE_CODES: {
          MAYOR: "MAYOR",
          MSWDO: "MSWDO",
          BARANGAY: "BARANGAY",
        },
        requireRoles: () => (req, _res, next) => {
          req.auth = {
            userId: "user-1",
            roleCode: "MAYOR",
          };
          next();
        },
      },
      settingsServiceStub: {
        saveCurrentSettings: async () => {
          const error = new Error("INSERT has more expressions than target columns");
          error.code = "42601";
          throw error;
        },
      },
      validatorStub: {
        validateSaveCurrentSettings: (req, _res, next) => {
          req.validatedBody = {
            settings: {
              profile: {},
              profilePicture: {
                action: "UNCHANGED",
              },
            },
          };
          next();
        },
        validateUploadCurrentProfilePicture: (_req, _res, next) => next(),
      },
    },
    async (router) => {
      const app = express();
      app.use(express.json());
      app.use("/api/v1/settings", router);

      const server = await new Promise((resolve) => {
        const instance = app.listen(0, () => resolve(instance));
      });

      try {
        const port = server.address().port;
        const response = await fetch(`http://127.0.0.1:${port}/api/v1/settings/current`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            settings: {
              profile: {},
            },
          }),
        });
        const payload = await response.json();

        assert.equal(response.status, 500);
        assert.equal(payload.code, "SETTINGS_SAVE_FAILED");
        assert.equal(payload.message, "Account settings could not be saved.");
        assert.equal(
          /insert has more expressions than target columns/i.test(payload.message),
          false,
        );
      } finally {
        await new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    },
  );
});
