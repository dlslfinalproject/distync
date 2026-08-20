import React, {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  FILTER_MOBILE_BREAKPOINT,
  FILTER_PANEL_WIDTH,
  calculateFilterPopoverPosition,
  isTriggerVisibleInViewport,
} from "./responsiveFilterPopoverPosition";

export const filterSurfaceStyles = {
  title: {
    margin: 0,
    color: "#17324d",
    fontSize: "16px",
    fontWeight: 800,
  },
  field: {
    display: "grid",
    gap: "8px",
  },
  label: {
    color: "#55718b",
    fontSize: "13px",
    fontWeight: 700,
  },
  select: {
    minHeight: "44px",
    border: "1px solid #d0ddeb",
    borderRadius: "14px",
    padding: "10px 12px",
    fontSize: "14px",
    color: "#1f405f",
    backgroundColor: "#ffffff",
    boxSizing: "border-box",
    fontWeight: 600,
    maxWidth: "100%",
  },
  list: {
    display: "grid",
    gap: "10px",
    minHeight: 0,
    paddingRight: "4px",
  },
  option: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    color: "#1f405f",
    fontSize: "14px",
    lineHeight: 1.45,
    minWidth: 0,
  },
  optionText: {
    minWidth: 0,
    overflowWrap: "anywhere",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "auto",
  },
  clearAction: {
    border: "none",
    background: "transparent",
    color: "#55718b",
    padding: "2px 0",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    textDecoration: "underline",
    textUnderlineOffset: "3px",
  },
};

const panelBaseStyle = {
  position: "fixed",
  backgroundColor: "#ffffff",
  border: "1px solid #d6e2ef",
  borderRadius: "18px",
  boxShadow: "0 18px 36px rgba(31, 64, 95, 0.16)",
  padding: "18px",
  zIndex: 1200,
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  overflowY: "auto",
  overscrollBehavior: "contain",
  boxSizing: "border-box",
};

const mobileBackdropStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1200,
  backgroundColor: "rgba(12, 32, 51, 0.32)",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  padding: "12px",
  boxSizing: "border-box",
};

const mobilePanelStyle = {
  ...panelBaseStyle,
  position: "relative",
  width: "100%",
  maxWidth: "520px",
  maxHeight: "min(82dvh, calc(100vh - 24px))",
  borderRadius: "18px",
};

const closeButtonStyle = {
  width: "36px",
  height: "36px",
  border: "1px solid #c6d8ea",
  borderRadius: "12px",
  backgroundColor: "#f8fbfe",
  color: "#24496e",
  cursor: "pointer",
  fontSize: "22px",
  lineHeight: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "0 0 auto",
};

const mergeRefs =
  (...refs) =>
  (node) => {
    refs.forEach((ref) => {
      if (!ref) return;
      if (typeof ref === "function") {
        ref(node);
        return;
      }
      ref.current = node;
    });
  };

const ResponsiveFilterPopover = ({
  children,
  isOpen,
  onOpenChange,
  trigger,
  title = "Filter Records",
  panelClassName,
  panelStyle,
  mobileTitle,
  scopeKey,
}) => {
  const panelId = useId();
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const previousScopeKeyRef = useRef(scopeKey);
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    width: FILTER_PANEL_WIDTH,
    maxHeight: 320,
    placement: "bottom",
  });
  const [isMobile, setIsMobile] = useState(false);

  const close = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const updatePosition = useCallback(() => {
    if (typeof window === "undefined") return;

    const triggerElement = triggerRef.current;
    if (!triggerElement) return;

    const triggerRect = triggerElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const nextIsMobile = viewportWidth <= FILTER_MOBILE_BREAKPOINT;

    setIsMobile(nextIsMobile);

    if (!isTriggerVisibleInViewport(triggerRect, viewportWidth, viewportHeight)) {
      close();
      return;
    }

    if (nextIsMobile) return;

    const panelHeight = panelRef.current?.getBoundingClientRect().height || 0;
    setPosition(
      calculateFilterPopoverPosition({
        triggerRect,
        panelHeight,
        viewportWidth,
        viewportHeight,
      }),
    );
  }, [close]);

  useLayoutEffect(() => {
    if (!isOpen) return undefined;

    updatePosition();
    const frameId = window.requestAnimationFrame(updatePosition);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [children, isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleWindowChange = () => updatePosition();
    const handlePointerDown = (event) => {
      if (
        panelRef.current?.contains(event.target) ||
        triggerRef.current?.contains(event.target)
      ) {
        return;
      }

      close();
    };
    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
      triggerRef.current?.focus?.();
    };

    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen || !isMobile) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobile, isOpen]);

  useEffect(() => {
    if (previousScopeKeyRef.current === scopeKey) return;

    previousScopeKeyRef.current = scopeKey;

    if (isOpen) {
      close();
    }
  }, [close, isOpen, scopeKey]);

  const triggerElement = useMemo(() => {
    const triggerProps = {
      ref: triggerRef,
      "aria-expanded": isOpen,
      "aria-controls": isOpen ? panelId : undefined,
      onClick: () => onOpenChange(!isOpen),
    };

    return typeof trigger === "function"
      ? trigger(triggerProps)
      : cloneElement(trigger, {
          ...triggerProps,
          ref: mergeRefs(trigger.ref, triggerRef),
          onClick: (event) => {
            trigger.props?.onClick?.(event);
            if (!event.defaultPrevented) {
              onOpenChange(!isOpen);
            }
          },
        });
  }, [isOpen, onOpenChange, panelId, trigger]);

  const panel = isOpen ? (
    isMobile ? (
      <div style={mobileBackdropStyle} onClick={close}>
        <div
          id={panelId}
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={mobileTitle || title}
          className={panelClassName}
          style={{ ...mobilePanelStyle, ...panelStyle }}
          onClick={(event) => event.stopPropagation()}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <h3 style={filterSurfaceStyles.title}>{mobileTitle || title}</h3>
            <button type="button" onClick={close} style={closeButtonStyle} aria-label="Close filter">
              x
            </button>
          </div>
          {children}
        </div>
      </div>
    ) : (
      <div
        id={panelId}
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-label={title}
        data-placement={position.placement}
        className={panelClassName}
        style={{
          ...panelBaseStyle,
          top: position.top,
          left: position.left,
          width: position.width,
          maxHeight: position.maxHeight,
          ...panelStyle,
        }}
      >
        {children}
      </div>
    )
  ) : null;

  return (
    <>
      {triggerElement}
      {isOpen && typeof document !== "undefined"
        ? createPortal(panel, document.body)
        : null}
    </>
  );
};

export default ResponsiveFilterPopover;
