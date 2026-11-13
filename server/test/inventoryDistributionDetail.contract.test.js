const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryPath = path.join(
  __dirname,
  "..",
  "src",
  "repositories",
  "distributionTransaction.repository.js",
);
const servicePath = path.join(
  __dirname,
  "..",
  "src",
  "services",
  "distributionTransaction.service.js",
);

test("inventory distribution detail reads immutable transaction item and source snapshots", () => {
  const repositorySource = fs.readFileSync(repositoryPath, "utf8");
  const serviceSource = fs.readFileSync(servicePath, "utf8");

  assert.match(
    repositorySource,
    /const getInventoryDistributionTransactionItems = async \([\s\S]*?dti\.item_code_snapshot AS item_code,[\s\S]*?dti\.item_name_snapshot AS item_name,[\s\S]*?dti\.unit_of_measure_snapshot AS unit_of_measure,[\s\S]*?dti\.relief_pack_type_snapshot,[\s\S]*?dti\.relief_pack_template_id_snapshot,/,
  );
  assert.match(repositorySource, /linked_template_names\.snapshots AS relief_pack_template_snapshots/);
  assert.match(repositorySource, /dti\.category_snapshot AS category/);
  assert.match(repositorySource, /dti\.source_type_snapshot AS source_type/);
  assert.match(
    repositorySource,
    /dti\.source_relief_type_snapshot AS source_relief_type/,
  );
  assert.match(
    repositorySource,
    /dti\.donor_name_snapshot AS donor_name/,
  );
  assert.match(
    repositorySource,
    /dti\.donated_relief_pack_name_snapshot AS donated_relief_pack_name/,
  );
  assert.match(
    repositorySource,
    /FROM distribution_transaction_items dti[\s\S]*WHERE dti\.distribution_transaction_id = \$1/,
  );
  assert.doesNotMatch(repositorySource, /source_donation\.donation_item_remarks/);
  assert.match(
    repositorySource,
    /distribution_transaction_items: transactionItems,/,
  );
  assert.match(
    serviceSource,
    /detail\.distribution_transaction_items \|\| \[\]/,
  );
  assert.match(serviceSource, /donated_relief_pack_name: item\.donated_relief_pack_name/);
  assert.match(serviceSource, /relief_pack_type_snapshot: item\.relief_pack_type_snapshot/);
  assert.match(
    serviceSource,
    /relief_pack_template_id_snapshot:\s*item\.relief_pack_template_id_snapshot/,
  );
  assert.match(serviceSource, /distribution_transaction_items: distributionTransactionItems,/);
});
