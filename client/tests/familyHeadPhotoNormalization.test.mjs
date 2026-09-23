import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  normalizeImageDrawableToDataUrl,
  normalizeImageFileToDataUrl,
} from "../src/utils/imageProcessing.js";

const clientSourceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
);
const readSource = (...segments) =>
  readFile(path.join(clientSourceRoot, ...segments), "utf8");

const withImageProcessingGlobals = async (
  run,
  {
    dimensions = [4000, 3000],
    blobSizes = [],
  } = {},
) => {
  const originals = {
    createImageBitmap: globalThis.createImageBitmap,
    document: globalThis.document,
    FileReader: globalThis.FileReader,
  };
  const canvases = [];
  const readerInstances = [];
  const qualities = [];

  globalThis.createImageBitmap = async () => ({
    width: dimensions[0],
    height: dimensions[1],
    close() {},
  });
  globalThis.document = {
    createElement: (tagName) => {
      assert.equal(tagName, "canvas");
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage() {} }),
        toBlob(callback, mimeType, quality) {
          qualities.push(quality);
          const nextSize = blobSizes.shift() ?? 4;
          callback(new Blob([new Uint8Array(nextSize)], { type: mimeType }));
        },
      };
      canvases.push(canvas);
      return canvas;
    },
  };
  globalThis.FileReader = class MockFileReader {
    result = null;
    onload = null;
    onerror = null;
    onabort = null;

    constructor() {
      readerInstances.push(this);
    }

    async readAsDataURL(blob) {
      const bytes = Buffer.from(await blob.arrayBuffer());
      this.result = `data:${blob.type};base64,${bytes.toString("base64")}`;
      this.onload?.();
    }

    abort() {
      this.onabort?.();
    }
  };

  try {
    return await run({ canvases, qualities, readerInstances });
  } finally {
    globalThis.createImageBitmap = originals.createImageBitmap;
    globalThis.document = originals.document;
    globalThis.FileReader = originals.FileReader;
  }
};

test("normalizes camera and uploaded images to a bounded JPEG canvas", async () => {
  await withImageProcessingGlobals(async ({ canvases, qualities }) => {
    const photo = await normalizeImageFileToDataUrl(
      new Blob(["source"], { type: "image/png" }),
    );

    assert.match(photo, /^data:image\/jpeg;base64,/);
    assert.deepEqual([canvases[0].width, canvases[0].height], [1600, 1200]);
    assert.deepEqual(qualities, [0.86]);
  });
});

test("reduces JPEG quality until the normalized photo fits its byte limit", async () => {
  await withImageProcessingGlobals(
    async ({ qualities }) => {
      const photo = await normalizeImageDrawableToDataUrl(
        { frame: true },
        640,
        480,
        { maxOutputBytes: 4 },
      );

      assert.match(photo, /^data:image\/jpeg;base64,/);
      assert.deepEqual(qualities, [0.86, 0.78]);
    },
    { dimensions: [640, 480], blobSizes: [8, 4] },
  );
});

test("rejects non-image, SVG, and oversized source files before decoding", async () => {
  await withImageProcessingGlobals(async () => {
    await assert.rejects(
      normalizeImageFileToDataUrl(new Blob(["text"], { type: "text/plain" })),
      /supported photo image file/i,
    );
    await assert.rejects(
      normalizeImageFileToDataUrl(
        new Blob(["svg"], { type: "image/svg+xml" }),
      ),
      /supported photo image file/i,
    );
    await assert.rejects(
      normalizeImageFileToDataUrl(
        new Blob([new Uint8Array(9)], { type: "image/jpeg" }),
        { maxSourceBytes: 8 },
      ),
      /8 MB or smaller/i,
    );
  });
});

test("rejects decoded images above the pixel safety limit", async () => {
  await withImageProcessingGlobals(
    async () => {
      await assert.rejects(
        normalizeImageDrawableToDataUrl({ frame: true }, 8000, 6000),
        /dimensions are invalid or too large/i,
      );
    },
    { dimensions: [8000, 6000] },
  );
});

test("camera capture shares normalization and guards canceled or stale camera requests", async () => {
  const [cameraSource, formSource] = await Promise.all([
    readSource("components", "household-registration", "FamilyHeadSection.jsx"),
    readSource("features", "household-registration", "useHouseholdRegistrationForm.js"),
  ]);

  assert.match(cameraSource, /videoElement\.videoWidth/);
  assert.match(cameraSource, /form\.setFamilyHeadPhotoFromCameraFrame\(/);
  assert.doesNotMatch(cameraSource, /canvas\.toBlob\(/);
  assert.match(cameraSource, /cameraRequestRef\.current !== requestId/);
  assert.match(cameraSource, /stopMediaStream\(stream\)/);
  assert.match(formSource, /normalizeImageDrawableToDataUrl\(/);
  assert.match(formSource, /currentOperation\.controller\?\.abort\(\)/);
  assert.match(formSource, /familyHeadPhotoOperationRef\.current\.generation !== generation/);
});

test("offline registration keeps the photo in its durable queue entry until synced", async () => {
  const [registrationSource, queueSource] = await Promise.all([
    readSource("features", "household-registration", "householdRegistrationService.js"),
    readSource("offline", "syncQueue.js"),
  ]);
  const cleanupSource = queueSource.slice(
    queueSource.indexOf("export const clearSyncedEntries"),
  );

  assert.match(registrationSource, /return await performSyncableMutation\(\{[\s\S]*?payload,/);
  assert.match(queueSource, /await db\.syncQueue\.put\(\{\s*\.\.\.storedEntry/);
  assert.match(cleanupSource, /entry\.status === LOCAL_SYNC_STATUS\.SYNCED/);
});
