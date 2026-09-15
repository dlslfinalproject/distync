const INVALID_CONTROL_SELECTOR = [
  'input:not([type="hidden"])[aria-invalid="true"]:not([disabled])',
  'select[aria-invalid="true"]:not([disabled])',
  'textarea[aria-invalid="true"]:not([disabled])',
  'input:not([type="hidden"]):invalid:not([disabled])',
  'select:invalid:not([disabled])',
  'textarea:invalid:not([disabled])',
].join(", ");

const ERROR_ANCHOR_SELECTOR = '[data-error-anchor="true"]';
const ERROR_TARGET_SELECTOR = [
  INVALID_CONTROL_SELECTOR,
  ERROR_ANCHOR_SELECTOR,
].join(", ");

const resolveElement = (targetOrRef) => {
  if (!targetOrRef) {
    return null;
  }

  return targetOrRef.current || targetOrRef;
};

const findFirstErrorTarget = (containerOrRef) => {
  const container = resolveElement(containerOrRef);

  if (!container || typeof container.querySelector !== "function") {
    return null;
  }

  return container.querySelector(ERROR_TARGET_SELECTOR);
};

const scrollAndFocus = (target) => {
  if (!target) {
    return null;
  }

  if (typeof target.scrollIntoView === "function") {
    target.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  }

  if (typeof target.focus === "function") {
    try {
      target.focus({ preventScroll: true });
    } catch {
      target.focus();
    }
  }

  return target;
};

export const scrollToFirstError = (containerOrRef) => {
  return scrollAndFocus(findFirstErrorTarget(containerOrRef));
};

export const scrollToErrorElement = (elementOrRef) => {
  return scrollAndFocus(resolveElement(elementOrRef));
};

export const scheduleScrollToFirstError = (containerOrRef) => {
  if (typeof window === "undefined") {
    return undefined;
  }

  const schedule =
    typeof window.requestAnimationFrame === "function"
      ? window.requestAnimationFrame.bind(window)
      : (callback) => window.setTimeout(callback, 0);
  let secondFrameId;
  let isCancelled = false;

  const firstFrameId = schedule(() => {
    if (isCancelled) {
      return;
    }

    secondFrameId = schedule(() => {
      if (!isCancelled) {
        scrollToFirstError(containerOrRef);
      }
    });
  });

  return () => {
    isCancelled = true;

    if (typeof window.cancelAnimationFrame === "function") {
      window.cancelAnimationFrame(firstFrameId);

      if (secondFrameId !== undefined) {
        window.cancelAnimationFrame(secondFrameId);
      }
    }
  };
};
