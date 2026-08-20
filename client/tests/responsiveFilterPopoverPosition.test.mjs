import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import {
  calculateFilterPopoverPosition,
  isTriggerVisibleInViewport,
} from "../src/components/shared/responsiveFilterPopoverPosition.js";

test("filter popover opens below when there is enough space", () => {
  const position = calculateFilterPopoverPosition({
    triggerRect: { top: 120, bottom: 164, left: 960, right: 1080 },
    panelHeight: 260,
    viewportWidth: 1366,
    viewportHeight: 768,
  });

  assert.equal(position.placement, "bottom");
  assert.equal(position.top, 176);
  assert.ok(position.left >= 16);
  assert.ok(position.left + position.width <= 1350);
  assert.ok(position.maxHeight <= 576);
});

test("filter popover flips above when bottom space is constrained", () => {
  const position = calculateFilterPopoverPosition({
    triggerRect: { top: 520, bottom: 564, left: 920, right: 1040 },
    panelHeight: 280,
    viewportWidth: 1024,
    viewportHeight: 600,
  });

  assert.equal(position.placement, "top");
  assert.ok(position.top >= 16);
  assert.ok(position.top + 280 <= 508);
  assert.ok(position.maxHeight >= 280);
});

test("filter popover shifts horizontally inside narrow viewports", () => {
  const position = calculateFilterPopoverPosition({
    triggerRect: { top: 100, bottom: 144, left: 300, right: 390 },
    panelHeight: 220,
    viewportWidth: 390,
    viewportHeight: 844,
  });

  assert.equal(position.width, 358);
  assert.equal(position.left, 16);
  assert.equal(position.left + position.width, 374);
});

test("trigger visibility detects fully detached triggers", () => {
  assert.equal(
    isTriggerVisibleInViewport(
      { top: 20, bottom: 60, left: 20, right: 120 },
      390,
      844,
    ),
    true,
  );
  assert.equal(
    isTriggerVisibleInViewport(
      { top: -80, bottom: -20, left: 20, right: 120 },
      390,
      844,
    ),
    false,
  );
});

test("FLT-RWD-001: scope lifecycle does not close on stable key rerenders", async () => {
  const source = await fs.readFile(
    path.join(process.cwd(), "src", "components", "shared", "ResponsiveFilterPopover.jsx"),
    "utf8",
  );

  assert.match(source, /previousScopeKeyRef = useRef\(scopeKey\)/);
  assert.match(source, /previousScopeKeyRef\.current === scopeKey/);
  assert.doesNotMatch(
    source,
    /if \(!isOpen\) return;\s*close\(\);\s*}\s*, \[close, scopeKey\]/,
  );
});
