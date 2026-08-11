const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repositoryPath = path.join(
  __dirname,
  "..",
  "src",
  "repositories",
  "stub.repository.js",
);

test("stub detail distribution transaction query resolves verifier display name from users", () => {
  const source = fs.readFileSync(repositoryPath, "utf8");

  assert.match(source, /const getLatestDistributionTransactionByStubId = async \(stubId\) => \{/);
  assert.match(source, /dt\.verified_by,/);
  assert.match(
    source,
    /CONCAT_WS\(' ', u\.first_name, u\.middle_name, u\.last_name\) AS verified_by_name,/,
  );
  assert.match(source, /LEFT JOIN users u ON u\.id = dt\.verified_by/);
  assert.match(source, /WHERE dt\.stub_id = \$1/);
});
