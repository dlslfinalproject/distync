import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createServer } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const runtimeModuleId = "\0distync-inventory-runtime-react";
const iconsModuleId = "\0distync-inventory-runtime-icons";
const actionsModuleId = "\0distync-inventory-runtime-actions";
const runtimeKey = "__DISTYNC_INVENTORY_RUNTIME__";

const runtimeModuleSource = `
const getRuntime = () => globalThis.${runtimeKey};
export const Fragment = Symbol.for("distync.inventory.runtime.fragment");
export const createElement = (...args) => getRuntime().createElement(...args);
export const useState = (...args) => getRuntime().useState(...args);
export const useEffect = (...args) => getRuntime().useEffect(...args);
export default { Fragment, createElement, useState, useEffect };
`;

const iconsModuleSource = `
export const FiChevronLeft = () => null;
export const FiChevronRight = () => null;
`;

const actionsModuleSource = `
import React from "react";

const TableActionsMenu = ({ buttonAriaLabel = "Actions" }) =>
  React.createElement(
    "button",
    { type: "button", "aria-label": buttonAriaLabel },
    "Actions",
  );

export default TableActionsMenu;
`;

const runtimePlugin = {
  name: "distync-inventory-runtime-test-mocks",
  enforce: "pre",
  resolveId(id, importer) {
    if (id === "react") {
      return runtimeModuleId;
    }

    if (id === "react-icons/fi") {
      return iconsModuleId;
    }

    const resolvedId = importer && !id.startsWith("\0")
      ? path.resolve(path.dirname(importer), id)
      : id;
    const normalizedResolvedId = path.normalize(resolvedId);
    const actionsPath = path
      .resolve(clientRoot, "src/components/shared/TableActionsMenu");

    if (
      normalizedResolvedId === actionsPath ||
      normalizedResolvedId === `${actionsPath}.jsx`
    ) {
      return actionsModuleId;
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

    if (id === actionsModuleId) {
      return actionsModuleSource;
    }

    return null;
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

const createInventoryRows = (count) =>
  Array.from({ length: count }, (_, index) => ({
    id: `inventory-item-${index + 1}`,
    item_name: `Item ${index + 1}`,
    category: "Office",
    total_stock_on_hand: 10,
    stock_form_labels: ["Piece"],
    stock_statuses: [{ key: "Available", label: "Available" }],
    reorder_level: 2,
  }));

const getPageLabel = (tree) => {
  const pageLabel = findAll(
    tree,
    (element) =>
      element.type === "span" && element.props?.["aria-live"] === "polite",
  ).find((element) => getTextContent(element).startsWith("Page "));

  return getTextContent(pageLabel);
};

const getVisibleRows = (tree) =>
  findAll(
    tree,
    (element) => element.type === "tr" && element.props?.className === "inventory-items-table-row",
  );

const getPaginationButton = (tree, ariaLabel) =>
  findAll(
    tree,
    (element) => element.type === "button" && element.props?.["aria-label"] === ariaLabel,
  )[0];

test("InventoryItemsTable executes pagination effects and stays safe across dataset changes", async () => {
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
    const { default: InventoryItemsTable } = await server.ssrLoadModule(
      "/src/components/inventory-items/InventoryItemsTable.jsx?runtime-test",
    );
    const renderer = createRenderer(InventoryItemsTable);

    const oneRecordTree = renderer.render({
      rows: createInventoryRows(1),
      isLoading: false,
      errorMessage: "",
    });
    assert.match(getTextContent(oneRecordTree), /Showing 1 loaded entry/);
    assert.match(getTextContent(oneRecordTree), /Rows per page/);
    assert.equal(getPageLabel(oneRecordTree), "Page 1 of 1");
    assert.equal(
      findAll(oneRecordTree, (element) => element.type === "select").length,
      1,
    );

    for (const [count, expectedPageLabel] of [
      [0, ""],
      [1, "Page 1 of 1"],
      [24, "Page 1 of 1"],
      [25, "Page 1 of 1"],
      [26, "Page 1 of 2"],
      [50, "Page 1 of 2"],
      [51, "Page 1 of 3"],
      [101, "Page 1 of 5"],
    ]) {
      let tree;
      assert.doesNotThrow(() => {
        tree = renderer.render({
          rows: createInventoryRows(count),
          isLoading: false,
          errorMessage: "",
        });
      });

      if (count === 0) {
        assert.doesNotMatch(getTextContent(tree), /Page 1 of 0/);
        assert.match(getTextContent(tree), /No inventory items found/);
      } else {
        assert.equal(getPageLabel(tree), expectedPageLabel);
      }
    }

    let tree = renderer.render({
      rows: createInventoryRows(26),
      isLoading: false,
      errorMessage: "",
    });
    getPaginationButton(tree, "Go to next inventory items page").props.onClick();
    tree = renderer.render({
      rows: createInventoryRows(26),
      isLoading: false,
      errorMessage: "",
    });
    assert.equal(getPageLabel(tree), "Page 2 of 2");
    assert.equal(getVisibleRows(tree).length, 1);
    assert.equal(
      getPaginationButton(tree, "Go to next inventory items page").props.disabled,
      true,
    );

    getPaginationButton(tree, "Go to previous inventory items page").props.onClick();
    tree = renderer.render({
      rows: createInventoryRows(26),
      isLoading: false,
      errorMessage: "",
    });
    assert.equal(getPageLabel(tree), "Page 1 of 2");
    assert.equal(getVisibleRows(tree).length, 25);
    assert.equal(
      getPaginationButton(tree, "Go to previous inventory items page").props.disabled,
      true,
    );

    const pageSizeSelect = findAll(
      tree,
      (element) => element.type === "select",
    )[0];
    pageSizeSelect.props.onChange({ target: { value: "50" } });
    tree = renderer.render({
      rows: createInventoryRows(26),
      isLoading: false,
      errorMessage: "",
    });
    assert.equal(getPageLabel(tree), "Page 1 of 1");
    assert.equal(getVisibleRows(tree).length, 26);

    tree = renderer.render({
      rows: createInventoryRows(51),
      isLoading: false,
      errorMessage: "",
    });
    getPaginationButton(tree, "Go to next inventory items page").props.onClick();
    renderer.render({
      rows: createInventoryRows(51),
      isLoading: false,
      errorMessage: "",
    });
    tree = renderer.render({
      rows: createInventoryRows(1),
      isLoading: false,
      errorMessage: "",
    });
    assert.equal(getPageLabel(tree), "Page 1 of 1");
    assert.equal(getVisibleRows(tree).length, 1);
    assert.doesNotMatch(getTextContent(tree), /Page 2 of/);
  } finally {
    delete globalThis[runtimeKey];
    await server.close();
  }
});
