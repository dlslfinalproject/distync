import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourcePath = path.join(process.cwd(), "src", "components", "layout", "SidebarAccountMenu.jsx");
const sidebarPath = path.join(process.cwd(), "src", "components", "layout", "Sidebar.jsx");
const headerPath = path.join(process.cwd(), "src", "components", "layout", "HeaderNotifications.jsx");
const modalShellPath = path.join(process.cwd(), "src", "components", "shared", "FormModalShell.jsx");

test("sidebar account menu uses the shared identity, settings, and logout pattern", async () => {
  const source = await fs.readFile(sourcePath, "utf8");

  assert.match(source, /ProfileAvatar/);
  assert.match(source, /aria-haspopup="menu"/);
  assert.match(source, /aria-expanded=\{isOpen\}/);
  assert.match(source, /Account Settings/);
  assert.match(source, /Log Out/);
  assert.doesNotMatch(source, /Switch Role/);
  assert.match(source, /bottom: "calc\(100% \+ 10px\)"/);
  assert.match(source, /ConfirmationModal/);
  assert.match(source, /accessMode === ACCESS_MODES\.DEVELOPMENT/);
});

test("authenticated shell removes legacy role controls and header settings shortcut", async () => {
  const [sidebar, header] = await Promise.all([
    fs.readFile(sidebarPath, "utf8"),
    fs.readFile(headerPath, "utf8"),
  ]);

  assert.match(sidebar, /SidebarAccountMenu/);
  assert.doesNotMatch(sidebar, /Switch Role/);
  assert.doesNotMatch(sidebar, /Current Role/);
  assert.match(header, /FiBell/);
  assert.doesNotMatch(header, /FiSettings/);
});

test("shared modal shell portals its viewport-fixed backdrop outside sidebar containers", async () => {
  const source = await fs.readFile(modalShellPath, "utf8");

  assert.match(source, /import \{ createPortal \} from "react-dom"/);
  assert.match(source, /position: "fixed"/);
  assert.match(source, /inset: 0/);
  assert.match(source, /alignItems: "center"/);
  assert.match(source, /justifyContent: "center"/);
  assert.match(source, /createPortal\(modalContent, document\.body\)/);
});
