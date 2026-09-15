import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourcePath = (...segments) => path.join(process.cwd(), "src", ...segments);

const readSource = (relativePath) =>
  fs.readFile(sourcePath(...relativePath), "utf8");

test("MSWDO analytics export occupies a full mobile row", async () => {
  const [pageSource, cssSource] = await Promise.all([
    readSource(["pages", "mswdo", "AnalyticsDashboardPage.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(pageSource, /className="mswdo-analytics-export-row"/);
  assert.match(pageSource, /className="mswdo-analytics-export-button"/);
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.mswdo-analytics-export-row \{[\s\S]*?justify-content: stretch !important;[\s\S]*?width: 100% !important;/,
  );
  assert.match(
    cssSource,
    /\.mswdo-analytics-export-button \{[\s\S]*?width: 100% !important;/,
  );
});
