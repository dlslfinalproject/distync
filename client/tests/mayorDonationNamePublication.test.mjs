import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourcePath = (...segments) => path.join(process.cwd(), "src", ...segments);

test("donation name publication follows the relief-pack status action pattern", async () => {
  const [pageSource, donationsSource, modalSource, serviceSource] =
    await Promise.all([
      fs.readFile(sourcePath("pages", "DonationManagementPage.jsx"), "utf8"),
      fs.readFile(sourcePath("components", "donations", "DonationsTab.jsx"), "utf8"),
      fs.readFile(
        sourcePath(
          "components",
          "donations",
          "DonationDonorNameVisibilityModal.jsx",
        ),
        "utf8",
      ),
      fs.readFile(sourcePath("features", "donations", "donationService.js"), "utf8"),
    ]);

  assert.match(donationsSource, /FiPower/);
  assert.match(donationsSource, /Publish Donor Name/);
  assert.match(donationsSource, /Unpublish Donor Name/);
  assert.doesNotMatch(donationsSource, /FiRepeat|reassign-leftover/);
  assert.match(pageSource, /DonationDonorNameVisibilityModal/);
  assert.match(modalSource, /Anonymous/);
  assert.match(modalSource, /donation\.donor_name/);
  assert.doesNotMatch(
    modalSource,
    /public_donor_name|publicDonorName|donor_display_name|publicDisplayName/,
  );
  assert.match(modalSource, /Only the donor name will be revealed/);
  assert.match(serviceSource, /\/public-name/);
  assert.match(serviceSource, /donor_name_public: donorNamePublic/);
});

test("new donation records default donor names to anonymous", async () => {
  const migrationSource = await fs.readFile(
    path.join(
      process.cwd(),
      "..",
      "database",
      "migrations",
      "2026-09-03_add_donation_public_name_visibility.sql",
    ),
    "utf8",
  );

  assert.match(
    migrationSource,
    /donor_name_public BOOLEAN NOT NULL DEFAULT FALSE/i,
  );
});
