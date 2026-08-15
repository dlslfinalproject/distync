import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { chromium } from "@playwright/test";
import {
  assertApprovedTargets,
  buildMasterlistUrl,
  FRONTEND_URL,
  STORAGE_STATE_PATH,
} from "./config.mjs";
import { readSafeSessionSummary } from "./uiHelpers.mjs";

assertApprovedTargets();

const rl = readline.createInterface({ input, output });
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

console.log(`Opening deployed DISTYNC frontend: ${FRONTEND_URL}`);
console.log("Authenticate manually with the authorized Barangay Google account.");
console.log("No credentials or tokens are accepted as CLI arguments or printed.");

await page.goto(buildMasterlistUrl(), { waitUntil: "domcontentloaded" });
await rl.question(
  "After the Barangay Evacuee Masterlist is visible, press Enter to save local storage state...",
);

const sessionSummary = await readSafeSessionSummary(page);

if (!sessionSummary) {
  await browser.close();
  rl.close();
  throw new Error("No DISTYNC authenticated session was found in browser storage.");
}

if (sessionSummary.role !== "BARANGAY") {
  await browser.close();
  rl.close();
  throw new Error(
    `Authenticated session role is ${sessionSummary.role || "UNKNOWN"}, not BARANGAY.`,
  );
}

await fs.mkdir(path.dirname(STORAGE_STATE_PATH), { recursive: true });
await context.storageState({ path: STORAGE_STATE_PATH });
await browser.close();
rl.close();

console.log(`Saved authorized Barangay storage state to ${STORAGE_STATE_PATH}`);
console.log("The .performance-auth directory is ignored by Git.");

