import React, { useEffect, useMemo, useState } from "react";
import { FiMoreHorizontal } from "react-icons/fi";

const menuStyles = {
  button: {
    background: "none",
    border: "none",
    cursor: "pointer",
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#24496e",
  },
  dropdown: {
    position: "fixed",
    background: "#fff",
    borderRadius: "12px",
    boxShadow: "0 8px 24px rgba(18, 39, 60, 0.16)",
    padding: "8px",
    zIndex: 1300,
    display: "grid",
    gap: "6px",
    border: "1px solid #d7e2ef",
  },
  dropdownButton: {
    border: "none",
    borderRadius: "10px",
    width: "100%",
    backgroundColor: "#ffffff",
    color: "#24496e",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "10px",
    cursor: "pointer",
    padding: "10px 12px",
    fontSize: "14px",
    fontWeight: 600,
    textAlign: "left",
  },
};

const TableActionsMenu = ({
  row,
  menuId,
  items = [],
  disabled = false,
  buttonTitle = "Actions",
  buttonAriaLabel = "Actions",
  menuWidth = 176,
  onToggle,
  dataPrefix = "table-actions",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({
    top: 0,
    left: 0,
  });

  const availableItems = useMemo(
    () => items.filter((item) => item && item.hidden !== true),
    [items],
  );

  useEffect(() => {
    const handleOtherMenuOpened = (event) => {
      if (event.detail?.menuId !== menuId) {
        setIsOpen(false);
      }
    };

    window.addEventListener("shared-table-actions-open", handleOtherMenuOpened);

    return () => {
      window.removeEventListener(
        "shared-table-actions-open",
        handleOtherMenuOpened,
      );
    };
  }, [menuId]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleClose = (event) => {
      const menuElement = event.target?.closest?.(
        `[data-${dataPrefix}-menu='true']`,
      );
      const menuButtonElement = event.target?.closest?.(
        `[data-${dataPrefix}-button='true']`,
      );

      if (menuElement || menuButtonElement) {
        return;
      }

      setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClose);
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);

    return () => {
      document.removeEventListener("mousedown", handleClose);
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
    };
  }, [dataPrefix, isOpen]);

  if (!availableItems.length) {
    return null;
  }

  const handleToggleMenu = (event) => {
    event.stopPropagation();
    event.preventDefault();

    const buttonRect = event.currentTarget.getBoundingClientRect();
    const dropdownHeight = Math.max(availableItems.length * 52, 64);
    const spacing = 8;

    const shouldOpenUpward =
      window.innerHeight - buttonRect.bottom < dropdownHeight + spacing;

    const calculatedLeft = Math.min(
      Math.max(buttonRect.left + buttonRect.width / 2 - menuWidth / 2, 12),
      window.innerWidth - menuWidth - 12,
    );

    const calculatedTop = shouldOpenUpward
      ? buttonRect.top - dropdownHeight - spacing
      : buttonRect.bottom + spacing;

    setMenuPosition({
      top: calculatedTop,
      left: calculatedLeft,
    });

    onToggle?.(row);
    window.dispatchEvent(
      new CustomEvent("shared-table-actions-open", {
        detail: {
          menuId,
        },
      }),
    );
    setIsOpen((currentValue) => !currentValue);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleToggleMenu}
        style={menuStyles.button}
        title={buttonTitle}
        aria-label={buttonAriaLabel}
        disabled={disabled}
        {...{ [`data-${dataPrefix}-button`]: "true" }}
      >
        <FiMoreHorizontal size={18} />
      </button>

      {isOpen ? (
        <div
          style={{
            ...menuStyles.dropdown,
            width: `${menuWidth}px`,
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
          }}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          {...{ [`data-${dataPrefix}-menu`]: "true" }}
        >
          {availableItems.map((item) => (
            <button
              key={item.key || item.label}
              type="button"
              onClick={() => {
                item.onClick?.(row);
                setIsOpen(false);
              }}
              style={{
                ...menuStyles.dropdownButton,
                color: item.disabled ? "#8f9fb0" : item.tone === "warning" ? "#8a5d22" : "#24496e",
              }}
              disabled={item.disabled}
              title={item.title || item.label}
            >
              {item.icon ? item.icon : null}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
};

export default TableActionsMenu;
