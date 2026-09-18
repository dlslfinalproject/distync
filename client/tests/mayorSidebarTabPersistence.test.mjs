import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const layoutSourcePath = new URL(
  "../src/components/layout/BarangayLayout.jsx",
  import.meta.url,
);

test("dashboard sidebar routes preserve visited page state between tab switches", async () => {
  const source = await fs.readFile(layoutSourcePath, "utf8");

  assert.match(source, /const DashboardRouteOutletCache = \(\) => \{/);
  assert.match(source, /const cachedRoutesRef = useRef\(new Map\(\)\);/);
  assert.match(
    source,
    /cachedRoutesRef\.current\.set\(routeKey, outlet\);/,
  );
  assert.match(source, /hidden=\{isInactive\}/);
  assert.match(source, /aria-hidden=\{isInactive\}/);
  assert.match(source, /<DashboardRouteOutletCache \/>/);
  assert.doesNotMatch(source, /isMayorPortal \? <DashboardRouteOutletCache/);
});
