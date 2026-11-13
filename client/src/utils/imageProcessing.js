const DEFAULT_MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_DIMENSION = 1600;
const MAX_DECODED_PIXELS = 40_000_000;
const JPEG_QUALITIES = [0.86, 0.78, 0.7, 0.62];

const createAbortError = () => {
  const error = new Error("Image processing was cancelled.");
  error.name = "AbortError";
  return error;
};

const throwIfAborted = (signal) => {
  if (signal?.aborted) {
    throw createAbortError();
  }
};

const readBlobAsDataUrl = (blob, signal) => {
  throwIfAborted(signal);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const cleanup = () => signal?.removeEventListener("abort", abortRead);
    const abortRead = () => reader.abort();

    reader.onload = () => {
      cleanup();
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("The normalized image could not be read."));
      }
    };
    reader.onerror = () => {
      cleanup();
      reject(new Error("The normalized image could not be read."));
    };
    reader.onabort = () => {
      cleanup();
      reject(createAbortError());
    };

    signal?.addEventListener("abort", abortRead, { once: true });
    reader.readAsDataURL(blob);
  });
};

const loadImageElement = (file, signal) => {
  throwIfAborted(signal);

  if (
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function" ||
    typeof Image === "undefined"
  ) {
    throw new Error("This browser cannot open the selected image.");
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      image.onload = null;
      image.onerror = null;
      signal?.removeEventListener("abort", abortLoad);
      URL.revokeObjectURL(objectUrl);
    };
    const abortLoad = () => {
      cleanup();
      image.src = "";
      reject(createAbortError());
    };

    image.onload = () => {
      cleanup();
      resolve({
        drawable: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        release: () => {},
      });
    };
    image.onerror = () => {
      cleanup();
      reject(new Error("The selected file is not a readable image."));
    };

    signal?.addEventListener("abort", abortLoad, { once: true });
    image.src = objectUrl;
  });
};

const decodeImageFile = async (file, signal) => {
  if (typeof createImageBitmap === "function") {
    try {
      let bitmap;
      try {
        bitmap = await createImageBitmap(file, {
          imageOrientation: "from-image",
        });
      } catch {
        bitmap = await createImageBitmap(file);
      }

      if (signal?.aborted) {
        bitmap.close?.();
        throw createAbortError();
      }

      return {
        drawable: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close?.(),
      };
    } catch (error) {
      if (error?.name === "AbortError") {
        throw error;
      }
    }
  }

  return loadImageElement(file, signal);
};

const canvasToJpeg = (canvas, quality) =>
  new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("The image could not be converted."));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        quality,
      );
    } catch {
      reject(new Error("The image could not be converted."));
    }
  });

export const normalizeImageDrawableToDataUrl = async (
  drawable,
  sourceWidth,
  sourceHeight,
  {
    signal,
    maxDimension = DEFAULT_MAX_DIMENSION,
    maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
  } = {},
) => {
  throwIfAborted(signal);

  const width = Math.floor(Number(sourceWidth));
  const height = Math.floor(Number(sourceHeight));
  if (
    !drawable ||
    width < 1 ||
    height < 1 ||
    width * height > MAX_DECODED_PIXELS
  ) {
    throw new Error("The image dimensions are invalid or too large to process.");
  }

  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const outputWidth = Math.max(1, Math.round(width * scale));
  const outputHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    throw new Error("This browser cannot process the selected image.");
  }

  context.drawImage(drawable, 0, 0, outputWidth, outputHeight);

  let normalizedBlob = null;
  for (const quality of JPEG_QUALITIES) {
    throwIfAborted(signal);
    normalizedBlob = await canvasToJpeg(canvas, quality);
    if (normalizedBlob.type !== "image/jpeg") {
      throw new Error("This browser could not create a supported JPEG image.");
    }
    if (normalizedBlob.size <= maxOutputBytes) {
      break;
    }
  }

  if (!normalizedBlob || normalizedBlob.size > maxOutputBytes) {
    throw new Error("The processed image is still too large. Choose a smaller photo.");
  }

  throwIfAborted(signal);
  return readBlobAsDataUrl(normalizedBlob, signal);
};

export const normalizeImageFileToDataUrl = async (
  file,
  {
    signal,
    maxSourceBytes = DEFAULT_MAX_SOURCE_BYTES,
    maxDimension = DEFAULT_MAX_DIMENSION,
    maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
  } = {},
) => {
  if (!file || typeof file.size !== "number") {
    throw new Error("Choose an image file to continue.");
  }

  const mimeType = String(file.type || "").trim().toLowerCase();
  if (
    (mimeType && !mimeType.startsWith("image/")) ||
    mimeType === "image/svg+xml"
  ) {
    throw new Error("Choose a supported photo image file.");
  }

  if (file.size < 1 || file.size > maxSourceBytes) {
    throw new Error("The selected photo must be 8 MB or smaller.");
  }

  throwIfAborted(signal);
  const decodedImage = await decodeImageFile(file, signal);
  try {
    return await normalizeImageDrawableToDataUrl(
      decodedImage.drawable,
      decodedImage.width,
      decodedImage.height,
      { signal, maxDimension, maxOutputBytes },
    );
  } finally {
    decodedImage.release();
  }
};

export const IMAGE_PROCESSING_LIMITS = Object.freeze({
  maxSourceBytes: DEFAULT_MAX_SOURCE_BYTES,
  maxOutputBytes: DEFAULT_MAX_OUTPUT_BYTES,
  maxDimension: DEFAULT_MAX_DIMENSION,
});
