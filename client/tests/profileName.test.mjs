import assert from "node:assert/strict";
import test from "node:test";
import { getStoredUserDisplayName } from "../src/utils/profileName.mjs";

test("stored DISTYNC profile names take precedence over the session fallback", () => {
  assert.equal(
    getStoredUserDisplayName({
      authenticatedUser: {
        first_name: "Google",
        last_name: "Name",
        email: "user@example.com",
      },
      storedProfile: {
        firstName: "Juan Miguel",
        lastName: "dela Cruz",
      },
    }),
    "Juan Miguel dela Cruz",
  );
});

test("profile display names handle partial fields without malformed spacing or null text", () => {
  assert.equal(
    getStoredUserDisplayName({
      storedProfile: { firstName: " Maria ", lastName: null },
    }),
    "Maria",
  );
  assert.equal(
    getStoredUserDisplayName({
      authenticatedUser: { first_name: "", last_name: "", email: "user@example.com" },
    }),
    "user@example.com",
  );
  assert.doesNotMatch(
    getStoredUserDisplayName({
      storedProfile: { firstName: "", lastName: "" },
      authenticatedUser: { first_name: "", last_name: "" },
    }),
    /undefined|null|\s{2,}/,
  );
  assert.equal(getStoredUserDisplayName({ authenticatedUser: null }), "DISTYNC User");
});
