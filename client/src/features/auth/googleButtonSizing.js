export const GOOGLE_BUTTON_MIN_WIDTH = 200;
export const GOOGLE_BUTTON_MAX_WIDTH = 400;

export const getGoogleButtonWidth = (availableWidth) => {
  const numericWidth = Number(availableWidth);

  if (!Number.isFinite(numericWidth) || numericWidth <= 0) {
    return 0;
  }

  return Math.min(
    GOOGLE_BUTTON_MAX_WIDTH,
    Math.max(GOOGLE_BUTTON_MIN_WIDTH, Math.floor(numericWidth)),
  );
};

export const measureGoogleButtonWidth = (element) => {
  if (!element) {
    return 0;
  }

  const clientWidth = Number(element.clientWidth);

  if (Number.isFinite(clientWidth) && clientWidth > 0) {
    return getGoogleButtonWidth(clientWidth);
  }

  const rectWidth = Number(element.getBoundingClientRect?.().width);
  return getGoogleButtonWidth(rectWidth);
};
