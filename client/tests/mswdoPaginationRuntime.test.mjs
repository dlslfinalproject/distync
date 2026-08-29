import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createServer } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const runtimeModuleId = "\0distync-mswdo-pagination-runtime-react";
const iconsModuleId = "\0distync-mswdo-pagination-runtime-icons";
const runtimeKey = "__DISTYNC_MSWDO_PAGINATION_RUNTIME__";

const runtimeModuleSource = `
const getRuntime = () => globalThis.${runtimeKey};
export const Fragment = Symbol.for("distync.mswdo.pagination.fragment");
export const createElement = (...args) => getRuntime().createElement(...args);
export const useState = (...args) => getRuntime().useState(...args);
export const useEffect = (...args) => getRuntime().useEffect(...args);
export default { Fragment, createElement, useState, useEffect };
`;

const iconsModuleSource = `
const Icon = () => null;
export const FaHandHolding = Icon;
export const FiChevronLeft = Icon;
export const FiChevronRight = Icon;
export const FiEdit2 = Icon;
export const FiEye = Icon;
export const FiFileText = Icon;
`;

const shellModuleSource = `
export const shellStyles = {
  card: {},
  mutedText: {},
};
`;

const statusModuleSource = `
const StatusPill = () => null;
export default StatusPill;
`;

const actionsModuleSource = `
import React from "react";
const TableActionsMenu = () =>
  React.createElement("button", { type: "button", "aria-label": "Actions" }, "Actions");
export default TableActionsMenu;
`;

const disasterFormatterModuleSource = `
export const formatDisasterEventDate = (value) => value || "-";
export const getAffectedBarangayDisplayItems = (value) =>
  Array.isArray(value) ? value : [];
`;

const sectorModuleSource = `
export const formatOrderedSectorText = (value) => value || "-";
`;

const syncStatusModuleSource = `
const SyncStatusIcon = () => null;
export default SyncStatusIcon;
`;

const qrPanelModuleSource = `
import React from "react";
const QrCodePanel = ({ emptyLabel = "QR unavailable" }) =>
  React.createElement("span", null, emptyLabel);
export default QrCodePanel;
`;

const mockSources = new Map([
  [
    path.resolve(clientRoot, "src/components/layout/BarangayLayout"),
    shellModuleSource,
  ],
  [
    path.resolve(clientRoot, "src/components/shared/StatusPill"),
    statusModuleSource,
  ],
  [
    path.resolve(clientRoot, "src/components/shared/TableActionsMenu"),
    actionsModuleSource,
  ],
  [
    path.resolve(clientRoot, "src/features/disaster-events/disasterEventFormatters"),
    disasterFormatterModuleSource,
  ],
  [
    path.resolve(clientRoot, "src/utils/sectorDisplay"),
    sectorModuleSource,
  ],
  [
    path.resolve(clientRoot, "src/components/shared/SyncStatusIcon"),
    syncStatusModuleSource,
  ],
  [
    path.resolve(clientRoot, "src/components/stubs/QrCodePanel"),
    qrPanelModuleSource,
  ],
]);
const mockSourceById = new Map();

const runtimePlugin = {
  name: "distync-mswdo-pagination-runtime-test-mocks",
  enforce: "pre",
  resolveId(id, importer) {
    if (id === "react") {
      return runtimeModuleId;
    }

    if (id === "react-icons/fi" || id === "react-icons/fa6") {
      return iconsModuleId;
    }

    const resolvedId = importer && !id.startsWith("\0")
      ? path.resolve(path.dirname(importer), id)
      : id;
    const normalizedResolvedId = path.normalize(resolvedId);

    for (const [mockPath, source] of mockSources) {
      if (
        normalizedResolvedId === path.normalize(mockPath) ||
        normalizedResolvedId === path.normalize(`${mockPath}.jsx`) ||
        normalizedResolvedId === path.normalize(`${mockPath}.js`)
      ) {
        const mockId = `\0distync-mswdo-pagination-mock-${mockPath}`;
        mockSourceById.set(mockId, source);
        return mockId;
      }
    }

    return null;
  },
  load(id) {
    if (id === runtimeModuleId) {
      return runtimeModuleSource;
    }

    if (id === iconsModuleId) {
      return iconsModuleSource;
    }

    return mockSourceById.get(id) ?? null;
  },
};

const createElement = (type, props, ...children) => ({
  type,
  props: {
    ...(props || {}),
    children:
      children.length === 0
        ? undefined
        : children.length === 1
          ? children[0]
          : children,
  },
});

const createRenderer = (Component) => {
  const stateSlots = [];
  let hookIndex = 0;
  let pendingEffects = [];

  const runtime = {
    createElement,
    useState(initialValue) {
      const slotIndex = hookIndex;
      hookIndex += 1;

      if (!Object.hasOwn(stateSlots, slotIndex)) {
        stateSlots[slotIndex] =
          typeof initialValue === "function" ? initialValue() : initialValue;
      }

      const setState = (nextValue) => {
        stateSlots[slotIndex] =
          typeof nextValue === "function"
            ? nextValue(stateSlots[slotIndex])
            : nextValue;
      };

      return [stateSlots[slotIndex], setState];
    },
    useEffect(effect) {
      pendingEffects.push(effect);
    },
  };

  return {
    render(props) {
      hookIndex = 0;
      pendingEffects = [];
      globalThis[runtimeKey] = runtime;

      const tree = Component(props);
      pendingEffects.forEach((effect) => effect());

      return materialize(tree);
    },
  };
};

const materialize = (node) => {
  if (node === null || node === undefined || typeof node !== "object") {
    return node;
  }

  if (Array.isArray(node)) {
    return node.map(materialize);
  }

  if (typeof node.type === "function") {
    return materialize(node.type(node.props || {}));
  }

  if (typeof node.type === "symbol") {
    return materialize(node.props?.children);
  }

  return {
    ...node,
    props: {
      ...node.props,
      children: materialize(node.props?.children),
    },
  };
};

const findAll = (tree, predicate, matches = []) => {
  if (Array.isArray(tree)) {
    tree.forEach((child) => findAll(child, predicate, matches));
    return matches;
  }

  if (tree === null || tree === undefined || typeof tree !== "object") {
    return matches;
  }

  if (predicate(tree)) {
    matches.push(tree);
  }

  findAll(tree.props?.children, predicate, matches);
  return matches;
};

const getTextContent = (tree) => {
  if (Array.isArray(tree)) {
    return tree.map(getTextContent).join("");
  }

  if (tree === null || tree === undefined || typeof tree === "boolean") {
    return "";
  }

  if (typeof tree !== "object") {
    return String(tree);
  }

  return getTextContent(tree.props?.children);
};

const getPageLabel = (tree) => {
  const pageLabel = findAll(
    tree,
    (element) =>
      element.type === "span" && element.props?.["aria-live"] === "polite",
  ).find((element) => getTextContent(element).startsWith("Page "));

  return getTextContent(pageLabel);
};

const getVisibleRows = (tree) =>
  findAll(tree, (element) => element.type === "tr");

const getPaginationButton = (tree, ariaLabel) =>
  findAll(
    tree,
    (element) =>
      element.type === "button" && element.props?.["aria-label"] === ariaLabel,
  )[0];

const createDisasterEventRows = (count) =>
  Array.from({ length: count }, (_, index) => ({
    id: `event-${index + 1}`,
    title: `Event ${index + 1}`,
    disaster_type: "Flood",
    affected_barangays: [{ id: "barangay-1", name: "Poblacion" }],
    start_date: "2026-01-01T00:00:00.000Z",
    end_date: null,
    status: "ACTIVE",
  }));

const createStubRows = (count) =>
  Array.from({ length: count }, (_, index) => ({
    id: `stub-${index + 1}`,
    family_head_name: `Family ${index + 1}`,
    members_count: 2,
    sectors_text: "Adult",
    relief_pack_name: "Family Pack",
    display_stub_no: `STUB#${index + 1}`,
    status: "ISSUED",
    is_local_only: false,
    qr_code_value: `qr-${index + 1}`,
    assigned_relief_packs: [],
  }));

test("MSWDO disaster event and relief distribution tables execute canonical pagination", async () => {
  const server = await createServer({
    root: clientRoot,
    configFile: false,
    appType: "custom",
    logLevel: "error",
    ssr: {
      noExternal: true,
    },
    plugins: [runtimePlugin],
  });

  try {
    const { default: DisasterEventsTable } = await server.ssrLoadModule(
      "/src/components/disaster-events/DisasterEventsTable.jsx?mswdo-pagination-runtime",
    );
    const { default: MswdoStubResultsTable } = await server.ssrLoadModule(
      "/src/components/stubs/MswdoStubResultsTable.jsx?mswdo-pagination-runtime",
    );

    const eventRows = createDisasterEventRows(26);
    const eventRenderer = createRenderer(DisasterEventsTable);
    let tree = eventRenderer.render({
      rows: eventRows,
      isLoading: false,
      errorMessage: "",
      onViewEvent: () => {},
      onEditEvent: () => {},
      onExportEvent: () => {},
    });

    assert.match(getTextContent(tree), /Showing 26 loaded entries/);
    assert.equal(getPageLabel(tree), "Page 1 of 2");
    assert.equal(getVisibleRows(tree).length, 26);
    assert.equal(
      getPaginationButton(tree, "Go to previous disaster event page").props.disabled,
      true,
    );

    getPaginationButton(tree, "Go to next disaster event page").props.onClick();
    tree = eventRenderer.render({
      rows: eventRows,
      isLoading: false,
      errorMessage: "",
      onViewEvent: () => {},
      onEditEvent: () => {},
      onExportEvent: () => {},
    });
    assert.equal(getPageLabel(tree), "Page 2 of 2");
    assert.equal(getVisibleRows(tree).length, 2);
    assert.equal(
      getPaginationButton(tree, "Go to next disaster event page").props.disabled,
      true,
    );

    tree = eventRenderer.render({
      rows: createDisasterEventRows(1),
      isLoading: false,
      errorMessage: "",
    });
    assert.match(getTextContent(tree), /Showing 1 loaded entry/);
    assert.equal(getPageLabel(tree), "Page 1 of 1");
    assert.equal(getVisibleRows(tree).length, 2);

    const eventPageSizeSelect = findAll(
      tree,
      (element) => element.type === "select",
    )[0];
    eventPageSizeSelect.props.onChange({ target: { value: "50" } });
    tree = eventRenderer.render({
      rows: eventRows,
      isLoading: false,
      errorMessage: "",
      onViewEvent: () => {},
      onEditEvent: () => {},
      onExportEvent: () => {},
    });
    assert.equal(getPageLabel(tree), "Page 1 of 1");
    assert.equal(getVisibleRows(tree).length, 27);

    tree = eventRenderer.render({
      rows: [],
      isLoading: false,
      errorMessage: "",
    });
    assert.doesNotMatch(getTextContent(tree), /Page 1 of 0/);

    const stubRows = createStubRows(26);
    const stubRenderer = createRenderer(MswdoStubResultsTable);
    tree = stubRenderer.render({
      rows: stubRows,
      isLoading: false,
      errorMessage: "",
      hasSelectedEvent: true,
      hasSelectedBarangay: true,
      claimingStubId: "",
      claimErrorMessage: "",
      onClaimStub: () => {},
      selectedStubIds: [],
      onToggleSelect: () => {},
      onSelectAll: () => {},
      onViewStub: () => {},
    });

    assert.match(getTextContent(tree), /Showing 26 loaded entries/);
    assert.equal(getPageLabel(tree), "Page 1 of 2");
    assert.equal(getVisibleRows(tree).length, 26);

    getPaginationButton(
      tree,
      "Go to next relief goods distribution page",
    ).props.onClick();
    tree = stubRenderer.render({
      rows: stubRows,
      isLoading: false,
      errorMessage: "",
      hasSelectedEvent: true,
      hasSelectedBarangay: true,
      claimingStubId: "",
      claimErrorMessage: "",
      onClaimStub: () => {},
      selectedStubIds: [],
      onToggleSelect: () => {},
      onSelectAll: () => {},
      onViewStub: () => {},
    });
    assert.equal(getPageLabel(tree), "Page 2 of 2");
    assert.equal(getVisibleRows(tree).length, 2);
    assert.equal(
      getPaginationButton(
        tree,
        "Go to previous relief goods distribution page",
      ).props.disabled,
      false,
    );

    tree = stubRenderer.render({
      rows: [],
      isLoading: false,
      errorMessage: "",
      hasSelectedEvent: true,
      hasSelectedBarangay: true,
    });
    assert.doesNotMatch(getTextContent(tree), /Page 1 of 0/);
  } finally {
    delete globalThis[runtimeKey];
    await server.close();
  }
});
