import React from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  getLoadedEntriesLabel,
  getTablePaginationState,
  TABLE_PAGE_SIZE_OPTIONS,
} from "../../features/pagination/pagination.mjs";

const TablePagination = ({
  totalItems = 0,
  currentPage = 1,
  pageSize = DEFAULT_TABLE_PAGE_SIZE,
  pageSizeOptions = TABLE_PAGE_SIZE_OPTIONS,
  onPageChange,
  onPageSizeChange,
  isVisible = true,
  disabled = false,
  disablePageSize = false,
  ariaLabel = "Table pagination",
  previousAriaLabel = "Go to previous page",
  nextAriaLabel = "Go to next page",
  className = "",
}) => {
  const pagination = getTablePaginationState({
    totalItems,
    currentPage,
    pageSize,
    pageSizeOptions,
  });
  const loadedEntriesLabel = getLoadedEntriesLabel(pagination.totalItems);

  if (!isVisible || pagination.totalItems === 0) {
    return null;
  }

  const rootClassName = ["table-pagination-bar", className]
    .filter(Boolean)
    .join(" ");
  const goToPage = (nextPage) => {
    const safeNextPage = Math.min(
      Math.max(Number(nextPage) || 1, 1),
      pagination.totalPages,
    );

    onPageChange?.(safeNextPage);
  };
  const handlePageSizeChange = (event) => {
    const nextPageSize = Number(event.target.value);

    if (!pagination.pageSizeOptions.includes(nextPageSize)) {
      return;
    }

    onPageSizeChange?.(nextPageSize);
  };

  return (
    <div className={rootClassName} role="navigation" aria-label={ariaLabel}>
      <p className="table-pagination-range" aria-live="polite">
        Showing {pagination.totalItems} loaded {loadedEntriesLabel}
      </p>
      <div className="table-pagination-controls">
        <label className="table-pagination-size">
          <span>Rows per page</span>
          <select
            value={pagination.pageSize}
            onChange={handlePageSizeChange}
            disabled={disablePageSize}
          >
            {pagination.pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <div className="table-pagination-navigation">
          <button
            type="button"
            onClick={() => goToPage(pagination.currentPage - 1)}
            disabled={disabled || !pagination.hasPreviousPage}
            aria-label={previousAriaLabel}
            title="Previous page"
            className="table-pagination-button"
          >
            <FiChevronLeft aria-hidden="true" />
          </button>
          <span aria-live="polite">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
          <button
            type="button"
            onClick={() => goToPage(pagination.currentPage + 1)}
            disabled={disabled || !pagination.hasNextPage}
            aria-label={nextAriaLabel}
            title="Next page"
            className="table-pagination-button"
          >
            <FiChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TablePagination;
