export const TABLE_PAGE_SIZE_OPTIONS = Object.freeze([25, 50, 100]);
export const DEFAULT_TABLE_PAGE_SIZE = TABLE_PAGE_SIZE_OPTIONS[0];

export const getLoadedEntriesLabel = (totalItems) =>
  Number(totalItems) === 1 ? "entry" : "entries";

const getSafePageSizeOptions = (pageSizeOptions) => {
  const normalizedOptions = (
    Array.isArray(pageSizeOptions) ? pageSizeOptions : []
  )
    .map((option) => Number(option))
    .filter((option) => Number.isInteger(option) && option > 0);

  return normalizedOptions.length > 0
    ? [...new Set(normalizedOptions)]
    : [...TABLE_PAGE_SIZE_OPTIONS];
};

export const normalizeTablePageSize = (
  pageSize,
  pageSizeOptions = TABLE_PAGE_SIZE_OPTIONS,
) => {
  const safePageSizeOptions = getSafePageSizeOptions(pageSizeOptions);
  const normalizedPageSize = Number(pageSize);

  return safePageSizeOptions.includes(normalizedPageSize)
    ? normalizedPageSize
    : safePageSizeOptions[0] || DEFAULT_TABLE_PAGE_SIZE;
};

export const getTablePaginationState = ({
  totalItems = 0,
  currentPage = 1,
  pageSize = DEFAULT_TABLE_PAGE_SIZE,
  pageSizeOptions = TABLE_PAGE_SIZE_OPTIONS,
} = {}) => {
  const numericTotalItems = Number(totalItems);
  const safeTotalItems = Number.isFinite(numericTotalItems)
    ? Math.max(0, Math.floor(numericTotalItems))
    : 0;
  const safePageSizeOptions = getSafePageSizeOptions(pageSizeOptions);
  const safePageSize = normalizeTablePageSize(pageSize, safePageSizeOptions);
  const totalPages =
    safeTotalItems > 0 ? Math.ceil(safeTotalItems / safePageSize) : 0;
  const numericCurrentPage = Number(currentPage);
  const requestedPage = Number.isFinite(numericCurrentPage)
    ? Math.floor(numericCurrentPage)
    : 1;
  const safeCurrentPage =
    totalPages > 0 ? Math.min(Math.max(requestedPage, 1), totalPages) : 1;

  return {
    totalItems: safeTotalItems,
    totalPages,
    currentPage: safeCurrentPage,
    pageSize: safePageSize,
    pageSizeOptions: safePageSizeOptions,
    hasPreviousPage: safeCurrentPage > 1,
    hasNextPage: totalPages > 0 && safeCurrentPage < totalPages,
  };
};

export const paginateRows = (
  rows,
  currentPage = 1,
  pageSize = DEFAULT_TABLE_PAGE_SIZE,
) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const pagination = getTablePaginationState({
    totalItems: safeRows.length,
    currentPage,
    pageSize,
  });

  return safeRows.slice(
    (pagination.currentPage - 1) * pagination.pageSize,
    pagination.currentPage * pagination.pageSize,
  );
};
