import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { createDonationPortalRefreshCoordinator } from "../src/features/donations/donationPortalRefreshCoordinator.mjs";

const readSource = (...segments) =>
  fs.readFile(path.join(process.cwd(), "src", ...segments), "utf8");

const flushMicrotasks = async () => {
  for (let index = 0; index < 10; index += 1) {
    await Promise.resolve();
  }
};

const createDeferred = () => {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

const createDocumentDouble = () => ({
  visibilityState: "visible",
  hidden: false,
  addEventListener() {},
  removeEventListener() {},
});

test("standalone public donor page opts into server transparency pagination", async () => {
  const [pageSource, serviceSource, internalPageSource, internalTabSource] =
    await Promise.all([
      readSource("pages", "donor", "DonationInformationPage.jsx"),
      readSource("features", "donations", "donationService.js"),
      readSource("pages", "DonationManagementPage.jsx"),
      readSource("components", "donations", "DonorTransparencyTab.jsx"),
    ]);

  assert.match(pageSource, /TablePagination/);
  assert.match(pageSource, /DEFAULT_TABLE_PAGE_SIZE/);
  assert.match(pageSource, /TABLE_PAGE_SIZE_OPTIONS/);
  assert.match(pageSource, /transparency_page: requestScope\.page/);
  assert.match(pageSource, /transparency_page_size: requestScope\.pageSize/);
  assert.match(pageSource, /requestTransparencyScope/);
  assert.match(pageSource, /"pagination-page-size"/);
  assert.match(pageSource, /matchesCurrentTransparencyScope/);
  assert.doesNotMatch(pageSource, /paginateRows\(/);
  assert.match(serviceSource, /\/api\/v1\/donations\/public-portal/);
  assert.match(serviceSource, /appendFilters\(searchParams, queryFilters\)/);

  assert.match(
    internalPageSource,
    /fetchDonationPortalData\(\{\s*disaster_event_id:/,
  );
  assert.doesNotMatch(
    internalPageSource,
    /fetchDonationPortalData\(\{[\s\S]*transparency_page:/,
  );
  assert.match(internalTabSource, /safeRows\.slice\(/);
});

test("standalone paginated responses render canonical suggestions without the legacy alias", async () => {
  const pageSource = await readSource(
    "pages",
    "donor",
    "DonationInformationPage.jsx",
  );
  const paginatedResponse = {
    needed_items: {
      source_type: "FORECAST",
      title: "Forecasted Donation Needs",
      suggestions: [
        {
          public_key: "forecast-rice",
          item_name: "Rice",
          category: "Food",
          unit_of_measure: "packs",
          suggested_quantity: 25,
          priority_level: "HIGH",
          note: "Prioritized shortfall",
          forecasted_at: "2026-08-16T08:00:00.000Z",
        },
      ],
    },
    transparency_summary: {
      received_vs_distributed: [],
      pagination: {
        page: 1,
        pageSize: 25,
        totalItems: 0,
        totalPages: 0,
      },
    },
  };

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      paginatedResponse,
      "forecast_suggestions",
    ),
    false,
  );
  assert.match(
    pageSource,
    /const neededItems = publicPortalData\?\.needed_items\s+\?\s+normalizeNeededItemsPayload\(publicPortalData\.needed_items\)/,
  );
  assert.match(pageSource, /<NeededItemsSection neededItems=\{neededItems\} \/>/);
  assert.match(pageSource, /\.\.\.neededItems\.suggestions\.map\(/);
  assert.match(pageSource, /suggestions: Array\.isArray\(payload\.suggestions\)/);
  assert.equal(
    paginatedResponse.needed_items.suggestions[0].item_name,
    "Rice",
  );
});

test("pagination scope changes share the coordinator and latest page wins", async () => {
  const firstRequest = createDeferred();
  const secondRequest = createDeferred();
  const pendingRequests = [firstRequest, secondRequest];
  const scope = { page: 1, pageSize: 25 };
  const requests = [];
  let activeRequests = 0;
  let maximumActiveRequests = 0;
  let requestNumber = 0;

  const coordinator = createDonationPortalRefreshCoordinator({
    documentObject: createDocumentDouble(),
    setIntervalFn: () => 1,
    clearIntervalFn: () => {},
    load: async (requestMeta) => {
      requestMeta.transparencyPage = scope.page;
      requestMeta.transparencyPageSize = scope.pageSize;
      requests.push({
        page: scope.page,
        pageSize: scope.pageSize,
        reason: requestMeta.reason,
      });
      activeRequests += 1;
      maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
      const response = await pendingRequests[requestNumber].promise;
      requestNumber += 1;
      activeRequests -= 1;
      return response;
    },
  });

  coordinator.start();
  scope.page = 2;
  coordinator.requestRefresh("pagination");
  scope.page = 3;
  coordinator.requestRefresh("pagination");

  assert.equal(requests.length, 1);
  assert.equal(maximumActiveRequests, 1);
  assert.equal(coordinator.getState().trailingRefreshPending, true);

  firstRequest.resolve({ page: 1 });
  await flushMicrotasks();

  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1], {
    page: 3,
    pageSize: 25,
    reason: "trailing",
  });
  assert.equal(maximumActiveRequests, 1);

  secondRequest.resolve({ page: 3 });
  await flushMicrotasks();
  coordinator.stop();
});
