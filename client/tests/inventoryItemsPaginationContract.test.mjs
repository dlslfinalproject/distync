import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const readSource = (relativePath) =>
  fs.readFile(path.join(__dirname, "..", relativePath), "utf8");

test("Items Record table uses a consistent above-table responsive paginator", async () => {
  const [tableSource, cssSource] = await Promise.all([
    readSource("src/components/inventory-items/InventoryItemsTable.jsx"),
    readSource("src/index.css"),
  ]);

  assert.match(tableSource, /const INVENTORY_ITEMS_PAGE_SIZE_OPTIONS = \[25, 50, 100\]/);
  assert.match(tableSource, /const \[currentPage, setCurrentPage\] = useState\(1\)/);
  assert.match(tableSource, /const \[pageSize, setPageSize\] = useState/);
  assert.match(tableSource, /const paginatedRows = safeRows\.slice\(/);
  assert.match(
    tableSource,
    /useEffect\(\(\) => \{\s*setCurrentPage\(1\);\s*\}, \[rows\]\)/s,
  );
  assert.match(
    tableSource,
    /Showing \{paginationTotalItems\} loaded entries/,
  );
  assert.match(tableSource, /Rows per page/);
  assert.match(tableSource, /FiChevronLeft/);
  assert.match(tableSource, /FiChevronRight/);
  assert.match(tableSource, /Page \{safeCurrentPage\} of \{totalPages\}/);
  assert.match(tableSource, /const paginationBar = showPagination \? \(/);
  assert.doesNotMatch(
    tableSource,
    /hasMultiplePages \? \(/,
  );
  assert.match(tableSource, /disabled=\{safeCurrentPage <= 1\}/);
  assert.match(tableSource, /disabled=\{safeCurrentPage >= totalPages\}/);
  assert.match(tableSource, /aria-label="Inventory items pagination"/);
  assert.match(cssSource, /\.inventory-items-pagination-bar/);
  assert.match(cssSource, /\.inventory-items-pagination-button/);
  assert.match(cssSource, /\.inventory-items-pagination-controls span/);

  const paginationBarIndex = tableSource.indexOf(
    'className="inventory-items-pagination-bar"',
  );
  const tableIndex = tableSource.indexOf(
    'className="inventory-items-table-scroll"',
  );

  assert.ok(paginationBarIndex >= 0);
  assert.ok(tableIndex >= 0);
  assert.ok(paginationBarIndex < tableIndex);
});
