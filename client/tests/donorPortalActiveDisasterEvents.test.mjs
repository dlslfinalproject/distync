import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const donationInformationPageSourcePath = new URL(
  "../src/pages/donor/DonationInformationPage.jsx",
  import.meta.url,
);

test("donor portal active disaster operations section uses concise public copy", async () => {
  const source = await fs.readFile(donationInformationPageSourcePath, "utf8");

  assert.match(source, /Active Disaster Relief Operations/);
  assert.match(source, /Recent Active Disaster Relief Operations/);
  assert.doesNotMatch(
    source,
    /Public information for up to three current active relief operations\./,
  );
  assert.doesNotMatch(
    source,
    /No public description has been recorded yet\./,
  );
});

test("donor portal shows all current active disaster events before using the three-event fallback", async () => {
  const source = await fs.readFile(donationInformationPageSourcePath, "utf8");

  assert.match(source, /const getActiveDisasterEventsForPortal = \(events\) => \{/);
  assert.match(
    source,
    /const currentActiveEvents = disasterEvents\s+\.filter\(\(event\) => isCurrentActiveDisasterEvent\(event, todayTime\)\)\s+\.sort\(sortDisasterEventsByRecency\);/,
  );
  assert.match(
    source,
    /if \(currentActiveEvents\.length > 0\) \{\s+return \{\s+events: currentActiveEvents,\s+isShowingRecentFallback: false,\s+\};\s+\}/,
  );
  assert.match(
    source,
    /const startTime = getDateOnlyTime\(event\?\.start_date\);\s+return \(\s+isActiveDisasterStatus\(event\?\.status\) &&\s+\(startTime === null \|\| startTime <= todayTime\)\s+\);/,
  );
  assert.match(
    source,
    /\.sort\(sortDisasterEventsByRecency\)\s+\.slice\(0, 3\),\s+isShowingRecentFallback: true,/,
  );
});

test("donor portal active disaster operations heading changes for recent fallback results", async () => {
  const source = await fs.readFile(donationInformationPageSourcePath, "utf8");

  assert.match(
    source,
    /const sectionTitle = isShowingRecentFallback\s+\? "Recent Active Disaster Relief Operations"\s+: "Active Disaster Relief Operations";/,
  );
  assert.match(source, /<ActiveDisastersSection\s+events=\{activeDisasters\}\s+isShowingRecentFallback=\{isShowingRecentActiveDisasters\}/);
});

test("donor portal disaster operation cards display one per row", async () => {
  const source = await fs.readFile(donationInformationPageSourcePath, "utf8");

  assert.match(
    source,
    /eventCardsGrid:\s*\{\s*display: "grid",\s*gridTemplateColumns: "1fr",/,
  );
});

test("donor portal disaster operations use collapsible summary rows", async () => {
  const source = await fs.readFile(donationInformationPageSourcePath, "utf8");

  assert.match(source, /eventDetails:\s*\{/);
  assert.match(source, /eventDetailsSummary:\s*\{/);
  assert.match(source, /eventDetailsBody:\s*\{/);
  assert.match(source, /<details\s+key=\{event\.public_key \|\| event\.event_code \|\| event\.title\}\s+style=\{styles\.eventDetails\}\s+open=\{events\.length === 1\}/);
  assert.match(source, /className="donor-event-details-summary"/);
  assert.match(source, /event\.title \|\| "Active disaster relief operation"/);
  assert.match(source, /event\.disaster_type \|\| "Disaster event"/);
  assert.match(source, /formatDateRange\(event\.start_date, event\.end_date\)/);
  assert.match(source, /className="donor-event-barangay-badge"/);
  assert.match(source, /formatNumber\(barangayCount\)/);
});

test("donor portal opens only high priority donation needs by default", async () => {
  const source = await fs.readFile(donationInformationPageSourcePath, "utf8");

  assert.match(source, /Emergency Donation Needs/);
  assert.match(
    source,
    /<details\s+key=\{priorityGroup\.key\}\s+style=\{styles\.details\}\s+open=\{priorityGroup\.key === "HIGH"\}/,
  );
  assert.doesNotMatch(source, /open=\{priorityGroup\.key !== "LOW"\}/);
});

test("donor portal donation utilization table matches forecast table emphasis", async () => {
  const source = await fs.readFile(donationInformationPageSourcePath, "utf8");

  assert.match(
    source,
    /aria-labelledby="utilization-title"[\s\S]*<details open>\s*<summary\s+className="donor-utilization-summary"/,
  );
  assert.match(
    source,
    /Donation Utilization[\s\S]*<th style=\{\{ \.\.\.styles\.th, \.\.\.styles\.forecastTh \}\}>Item<\/th>/,
  );
  assert.match(
    source,
    /Donation Utilization[\s\S]*<th\s+style=\{\{\s+\.\.\.styles\.th,\s+\.\.\.styles\.numericCell,\s+\.\.\.styles\.forecastTh,/,
  );
  assert.match(
    source,
    /Donation Utilization[\s\S]*<td style=\{\{ \.\.\.styles\.td, \.\.\.styles\.forecastItemCell \}\}>/,
  );
});

test("donor portal disaster operation stat cards use large right-side icon tiles", async () => {
  const source = await fs.readFile(donationInformationPageSourcePath, "utf8");

  assert.match(
    source,
    /eventStat:\s*\{\s*display: "flex",\s*alignItems: "center",\s*justifyContent: "space-between",/,
  );
  assert.match(source, /eventStatIcon:\s*\{/);
  assert.match(source, /background: "#eaf5f4",/);
  assert.doesNotMatch(source, /eventStatIconShade:\s*\{/);
  assert.match(source, /eventStatIconMain:\s*\{/);
  assert.match(source, /<span style=\{styles\.eventStatIcon\} aria-hidden="true">/);
  assert.match(source, /<FaMapMarkedAlt size=\{30\} style=\{styles\.eventStatIconMain\} \/>/);
  assert.match(source, /<FaHomeSolid size=\{30\} style=\{styles\.eventStatIconMain\} \/>/);
  assert.match(source, /<FaUsersSolid size=\{30\} style=\{styles\.eventStatIconMain\} \/>/);
});

test("donor portal disaster operation cards display every affected barangay", async () => {
  const source = await fs.readFile(donationInformationPageSourcePath, "utf8");

  assert.match(source, /barangayPanel:\s*\{/);
  assert.match(source, /borderLeft: `4px solid \$\{COLORS\.primary\}`/);
  assert.match(source, /barangayTitleGroup:\s*\{/);
  assert.match(source, /barangayTitleIcon:\s*\{/);
  assert.match(source, /barangayCount:\s*\{/);
  assert.match(source, /barangayCountValue:\s*\{/);
  assert.match(source, /barangayCountLabel:\s*\{/);
  assert.match(source, /background: "#eaf5f4",/);
  assert.match(source, /formatNumber\(barangays\.length\)/);
  assert.match(source, /<FaMapMarkedAlt size=\{17\} \/>/);
  assert.match(source, /barangays\.map\(\(barangay\) =>/);
  assert.doesNotMatch(source, /barangays\.slice\(0,\s*6\)/);
  assert.doesNotMatch(source, /\+\{barangays\.length - 6\} more/);
});
