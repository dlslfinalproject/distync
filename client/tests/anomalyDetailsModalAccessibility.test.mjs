import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const pageSourcePath = new URL(
  "../src/pages/mswdo/AnomalyTrackingPage.jsx",
  import.meta.url,
);
const modalShellSourcePath = new URL(
  "../src/components/shared/FormModalShell.jsx",
  import.meta.url,
);
const barangayWrapperSourcePath = new URL(
  "../src/pages/barangay/BarangayAnomalyTrackingPage.jsx",
  import.meta.url,
);

test("A11Y-01 through A11Y-03 anomaly details modal uses the shared dialog semantics and named close control", async () => {
  const [pageSource, modalShellSource] = await Promise.all([
    fs.readFile(pageSourcePath, "utf8"),
    fs.readFile(modalShellSourcePath, "utf8"),
  ]);

  assert.match(pageSource, /import FormModalShell from "\.\.\/\.\.\/components\/shared\/FormModalShell"/);
  assert.match(pageSource, /<FormModalShell[\s\S]*title="Anomaly Details"/);
  assert.match(pageSource, /closeButtonLabel="Close anomaly details"/);
  assert.match(pageSource, /<button type="button" onClick=\{onClose\}[\s\S]*>\s*Close\s*<\/button>/);
  assert.match(modalShellSource, /role="dialog"/);
  assert.match(modalShellSource, /aria-modal="true"/);
  assert.match(modalShellSource, /aria-labelledby=\{title \? titleId : undefined\}/);
  assert.match(modalShellSource, /<h3 id=\{titleId\}/);
  assert.match(modalShellSource, /aria-describedby=\{description \? descriptionId : undefined\}/);
});

test("A11Y-04 through A11Y-13 anomaly details modal wires focus trap, Escape, close, and fallback focus return", async () => {
  const [pageSource, modalShellSource] = await Promise.all([
    fs.readFile(pageSourcePath, "utf8"),
    fs.readFile(modalShellSourcePath, "utf8"),
  ]);

  assert.match(pageSource, /const anomalyDetailsTriggerRef = useRef\(null\)/);
  assert.match(pageSource, /anomalyDetailsTriggerRef\.current = event\.currentTarget/);
  assert.match(pageSource, /const anomalyRecordsHeadingRef = useRef\(null\)/);
  assert.match(pageSource, /const anomalyDetailsFinalFocusRef = useMemo\(/);
  assert.match(pageSource, /triggerElement\?\.isConnected && typeof triggerElement\.focus === "function"/);
  assert.match(pageSource, /fallbackElement\?\.isConnected && typeof fallbackElement\.focus === "function"/);
  assert.match(pageSource, /finalFocusRef=\{anomalyDetailsFinalFocusRef\}/);
  assert.match(pageSource, /tabIndex=\{-1\}[\s\S]*Anomaly Records/);
  assert.match(pageSource, /aria-label=\{`View details for \$\{formatAnomalyType\(row\.anomaly_type, presentationScope\)\}`\}/);
  assert.match(modalShellSource, /fallbackFocusTarget[\s\S]*initialFocusRef\?\.current[\s\S]*querySelector/);
  assert.ok(modalShellSource.includes("fallbackFocusTarget?.focus?.();"));
  assert.match(modalShellSource, /event\.key === "Escape"/);
  assert.match(modalShellSource, /event\.key !== "Tab"/);
  assert.match(modalShellSource, /focusableElements\.length === 0[\s\S]*panelElement\.focus\(\)/);
  assert.match(modalShellSource, /event\.shiftKey && document\.activeElement === firstElement/);
  assert.match(modalShellSource, /!event\.shiftKey && document\.activeElement === lastElement/);
  assert.match(modalShellSource, /document\.addEventListener\("keydown", handleKeyDown\)/);
  assert.match(modalShellSource, /document\.removeEventListener\("keydown", handleKeyDown\)/);
});

test("A11Y-10 and A11Y-15 anomaly details modal preserves backdrop policy and uses existing scroll cleanup", async () => {
  const [pageSource, modalShellSource] = await Promise.all([
    fs.readFile(pageSourcePath, "utf8"),
    fs.readFile(modalShellSourcePath, "utf8"),
  ]);

  assert.match(pageSource, /closeOnBackdrop=\{false\}/);
  assert.match(modalShellSource, /event\.target === overlayRef\.current/);
  assert.match(modalShellSource, /const previousBodyOverflow = document\.body\.style\.overflow/);
  assert.match(modalShellSource, /document\.body\.style\.overflow = "hidden"/);
  assert.match(modalShellSource, /document\.body\.style\.overflow = previousBodyOverflow/);
});

test("A11Y-14 through A11Y-18 anomaly details modal preserves page state, API contract, and shared Barangay route", async () => {
  const [pageSource, barangayWrapperSource] = await Promise.all([
    fs.readFile(pageSourcePath, "utf8"),
    fs.readFile(barangayWrapperSourcePath, "utf8"),
  ]);

  assert.match(pageSource, /const openAnomalyDetails = useCallback\(\(row, event\) => \{[\s\S]*setSelectedAnomaly\(row\);[\s\S]*\}, \[\]\);/);
  assert.match(pageSource, /const closeAnomalyDetails = useCallback\(\(\) => \{[\s\S]*setSelectedAnomaly\(null\);[\s\S]*\}, \[\]\);/);
  assert.match(pageSource, /onClose=\{closeAnomalyDetails\}/);
  assert.match(pageSource, /fetchMswdoAnomalies\(\{[\s\S]*page,[\s\S]*pageSize,[\s\S]*\}\)/);
  assert.doesNotMatch(pageSource, /setPage\(1\);[\s\S]{0,160}setSelectedAnomaly/);
  assert.doesNotMatch(pageSource, /setFilters\([\s\S]{0,160}setSelectedAnomaly/);
  assert.doesNotMatch(pageSource, /setViewState\([\s\S]{0,160}setSelectedAnomaly/);
  assert.match(barangayWrapperSource, /import AnomalyTrackingPage from "\.\.\/mswdo\/AnomalyTrackingPage"/);
  assert.match(barangayWrapperSource, /<AnomalyTrackingPage[\s\S]*scope="barangay"/);
});

test("A11Y-19 through A11Y-24 anomaly details modal has responsive sizing and long-text wrapping safeguards", async () => {
  const [pageSource, modalShellSource] = await Promise.all([
    fs.readFile(pageSourcePath, "utf8"),
    fs.readFile(modalShellSourcePath, "utf8"),
  ]);

  assert.match(pageSource, /gridTemplateColumns: "repeat\(auto-fit, minmax\(min\(220px, 100%\), 1fr\)\)"/);
  assert.match(pageSource, /wordBreak: "break-word"/);
  assert.match(pageSource, /maxHeight: "calc\(100vh - 32px\)"/);
  assert.match(pageSource, /overflowY: "hidden"/);
  assert.match(pageSource, /const modalBodyStyles = \{[\s\S]*overflowY: "auto"/);
  assert.match(pageSource, /footerStyle=\{modalFooterStyles\}/);
  assert.match(modalShellSource, /footerStyle/);
  assert.match(pageSource, /overflowX: "hidden"/);
  assert.match(pageSource, /maxWidth="min\(760px, 100vw\)"/);
  assert.match(pageSource, /overlayStyle=\{\{ padding: "16px" \}\}/);
});
