import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const layoutSourcePath = new URL(
  "../src/components/layout/BarangayLayout.jsx",
  import.meta.url,
);

test("dashboard sidebar routes render the current React Router outlet", async () => {
  const source = await fs.readFile(layoutSourcePath, "utf8");

  assert.match(source, /import \{ Outlet, useLocation \} from "react-router-dom";/);
  assert.match(source, /<Outlet \/>/);
  assert.doesNotMatch(source, /DashboardRouteOutletCache|cachedRoutesRef|useOutlet/);
});
