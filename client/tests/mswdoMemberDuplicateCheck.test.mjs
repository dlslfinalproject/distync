import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("MSWDO uses the shared household-registration duplicate lookup hook", () => {
  const source = read("../src/features/mswdo-masterlist/useMswdoMasterlistPage.js");

  assert.match(
    source,
    /import \{ useHouseholdRegistrationForm \} from "\.\.\/household-registration\/useHouseholdRegistrationForm"/,
  );
  assert.equal(
    (source.match(/useHouseholdRegistrationForm\(\{/g) || []).length,
    3,
  );
});

test("shared duplicate lookup cancels stale requests when the settled lookup changes", () => {
  const source = read(
    "../src/features/household-registration/useHouseholdRegistrationForm.js",
  );

  assert.match(
    source,
    /window\.clearTimeout\(timeoutId\);\s*\/\/ A changed eligible lookup supersedes[\s\S]*invalidateDuplicateSuggestionRequests\(\);/,
  );
  assert.match(source, /POSSIBLE_MATCH_LOOKUP_DEBOUNCE_MS/);
  assert.match(source, /new AbortController\(\)/);
  assert.match(source, /requestGeneration !== duplicateSuggestionGenerationRef\.current/);
});
