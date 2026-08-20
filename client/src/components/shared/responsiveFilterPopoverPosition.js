export const FILTER_VIEWPORT_MARGIN = 16;
export const FILTER_PANEL_GAP = 12;
export const FILTER_PANEL_WIDTH = 360;
export const FILTER_MIN_PANEL_HEIGHT = 220;
export const FILTER_MOBILE_BREAKPOINT = 640;

export const calculateFilterPopoverPosition = ({
  triggerRect,
  panelHeight = 0,
  viewportWidth,
  viewportHeight,
}) => {
  const constrainedPanelWidth = Math.max(
    0,
    Math.min(FILTER_PANEL_WIDTH, viewportWidth - FILTER_VIEWPORT_MARGIN * 2),
  );
  const measuredPanelHeight = Math.max(panelHeight || 0, FILTER_MIN_PANEL_HEIGHT);
  const spaceBelow = viewportHeight - triggerRect.bottom - FILTER_VIEWPORT_MARGIN;
  const spaceAbove = triggerRect.top - FILTER_VIEWPORT_MARGIN;
  const shouldOpenBelow =
    spaceBelow >= FILTER_MIN_PANEL_HEIGHT || spaceBelow >= spaceAbove;

  let left = triggerRect.right - constrainedPanelWidth;
  left = Math.min(
    Math.max(left, FILTER_VIEWPORT_MARGIN),
    viewportWidth - constrainedPanelWidth - FILTER_VIEWPORT_MARGIN,
  );

  if (shouldOpenBelow) {
    const top = Math.max(FILTER_VIEWPORT_MARGIN, triggerRect.bottom + FILTER_PANEL_GAP);
    return {
      top,
      left,
      width: constrainedPanelWidth,
      maxHeight: Math.max(viewportHeight - top - FILTER_VIEWPORT_MARGIN, 0),
      placement: "bottom",
    };
  }

  const maxHeight = Math.max(
    triggerRect.top - FILTER_PANEL_GAP - FILTER_VIEWPORT_MARGIN,
    0,
  );
  const top = Math.max(
    FILTER_VIEWPORT_MARGIN,
    triggerRect.top - FILTER_PANEL_GAP - Math.min(measuredPanelHeight, maxHeight),
  );

  return {
    top,
    left,
    width: constrainedPanelWidth,
    maxHeight,
    placement: "top",
  };
};

export const isTriggerVisibleInViewport = (
  triggerRect,
  viewportWidth,
  viewportHeight,
) =>
  triggerRect.bottom > 0 &&
  triggerRect.top < viewportHeight &&
  triggerRect.right > 0 &&
  triggerRect.left < viewportWidth;
