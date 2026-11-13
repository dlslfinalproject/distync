const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const schemaPath = path.resolve(
  __dirname,
  "../../database/schema/distync_schema.sql",
);

const readSchema = () => fs.readFileSync(schemaPath, "utf8");

const getTableBlock = (schema, tableName) =>
  schema.match(
    new RegExp(`CREATE TABLE public\\.${tableName} \\(([\\s\\S]*?)\\r?\\n\\);`),
  )?.[1];

test("canonical schema declares the proven relief-pack template-item contract", () => {
  const schema = readSchema();
  const tableBlock = getTableBlock(schema, "relief_pack_template_items");

  assert.ok(tableBlock, "relief_pack_template_items schema block should exist");
  assert.match(tableBlock, /id uuid NOT NULL DEFAULT gen_random_uuid\(\)/i);
  assert.match(tableBlock, /template_id uuid NOT NULL/i);
  assert.match(tableBlock, /inventory_item_id uuid NOT NULL/i);
  assert.match(tableBlock, /quantity_required integer NOT NULL CHECK \(quantity_required > 0\)/i);
  assert.match(tableBlock, /created_at timestamp with time zone NOT NULL DEFAULT now\(\)/i);
  assert.match(tableBlock, /CONSTRAINT relief_pack_template_items_pkey PRIMARY KEY \(id\)/i);
  assert.match(tableBlock, /CONSTRAINT uq_relief_pack_item UNIQUE \(template_id, inventory_item_id\)/i);
  assert.match(
    tableBlock,
    /CONSTRAINT relief_pack_template_items_template_id_fkey FOREIGN KEY \(template_id\) REFERENCES public\.relief_pack_templates\(id\) ON DELETE CASCADE/i,
  );
  assert.match(
    tableBlock,
    /CONSTRAINT relief_pack_template_items_inventory_item_id_fkey FOREIGN KEY \(inventory_item_id\) REFERENCES public\.inventory_items\(id\) ON DELETE RESTRICT/i,
  );
  assert.equal((schema.match(/\buq_relief_pack_item\b/g) || []).length, 1);
});

test("canonical schema declares the reconciled relief-pack template parent contract", () => {
  const schema = readSchema();
  const tableBlock = getTableBlock(schema, "relief_pack_templates");
  const distributionTableBlock = getTableBlock(
    schema,
    "distribution_transactions",
  );
  const historicalJunctionBlock = getTableBlock(
    schema,
    "distribution_transaction_relief_pack_templates",
  );

  assert.ok(tableBlock, "relief_pack_templates schema block should exist");
  assert.ok(
    distributionTableBlock,
    "distribution_transactions schema block should exist",
  );
  assert.ok(
    historicalJunctionBlock,
    "distribution_transaction_relief_pack_templates schema block should exist",
  );

  assert.match(tableBlock, /name character varying\(150\) NOT NULL UNIQUE/i);
  assert.match(
    tableBlock,
    /CONSTRAINT relief_pack_templates_created_by_fkey FOREIGN KEY \(created_by\) REFERENCES public\.users\(id\) ON DELETE SET NULL/i,
  );

  const sectorForeignKey = tableBlock.match(
    /CONSTRAINT relief_pack_templates_sector_id_fkey FOREIGN KEY \(sector_id\) REFERENCES public\.sectors\(id\)[^\r\n]*/i,
  )?.[0];
  assert.equal(
    sectorForeignKey,
    "CONSTRAINT relief_pack_templates_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES public.sectors(id)",
  );

  assert.equal(
    (
      schema.match(
        /CREATE UNIQUE INDEX relief_pack_templates_name_normalized_unique\s+ON public\.relief_pack_templates\s+\(LOWER\(BTRIM\(name\)\)\);/gi,
      ) || []
    ).length,
    1,
  );

  assert.match(distributionTableBlock, /relief_pack_template_id uuid,/i);
  assert.match(
    distributionTableBlock,
    /CONSTRAINT distribution_transactions_relief_pack_template_id_fkey FOREIGN KEY \(relief_pack_template_id\) REFERENCES public\.relief_pack_templates\(id\) ON DELETE SET NULL/i,
  );

  assert.match(
    historicalJunctionBlock,
    /CONSTRAINT distribution_transaction_relief_pack_templates_template_id_fkey FOREIGN KEY \(relief_pack_template_id\) REFERENCES public\.relief_pack_templates\(id\)(?:\r?\n|$)/i,
  );
  assert.doesNotMatch(
    historicalJunctionBlock,
    /distribution_transaction_relief_pack_templates_template_id_fkey[^\r\n]*ON DELETE/i,
  );
});

test("canonical schema declares the proven disaster-applicability contract", () => {
  const schema = readSchema();
  const tableBlock = getTableBlock(
    schema,
    "relief_pack_template_disaster_types",
  );

  assert.ok(
    tableBlock,
    "relief_pack_template_disaster_types schema block should exist",
  );
  assert.match(tableBlock, /id uuid NOT NULL DEFAULT gen_random_uuid\(\)/i);
  assert.match(tableBlock, /template_id uuid NOT NULL/i);
  assert.match(tableBlock, /disaster_type character varying NOT NULL/i);
  assert.match(tableBlock, /created_at timestamp with time zone NOT NULL DEFAULT now\(\)/i);
  assert.match(
    tableBlock,
    /CONSTRAINT relief_pack_template_disaster_types_pkey PRIMARY KEY \(id\)/i,
  );
  assert.match(
    tableBlock,
    /CONSTRAINT relief_pack_template_disaster_types_unique UNIQUE \(template_id, disaster_type\)/i,
  );
  assert.match(
    tableBlock,
    /CONSTRAINT relief_pack_template_disaster_types_template_id_fkey FOREIGN KEY \(template_id\) REFERENCES public\.relief_pack_templates\(id\) ON DELETE CASCADE/i,
  );

  const standaloneIndexPattern =
    /CREATE INDEX idx_relief_pack_template_disaster_types_template_id\s+ON public\.relief_pack_template_disaster_types \(template_id\);/gi;
  assert.equal((schema.match(standaloneIndexPattern) || []).length, 1);
  assert.doesNotMatch(
    schema,
    /CREATE UNIQUE INDEX idx_relief_pack_template_disaster_types_template_id/i,
  );
});
