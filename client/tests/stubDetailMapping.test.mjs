import assert from "node:assert/strict";
import test from "node:test";

import {
  getCanonicalStubRecord,
  getDisplayStubNumber,
  mapDistributionHistoryDetailForModal,
} from "../src/features/stubs/stubDetailMapping.mjs";

const photoHistoryDetail = {
  stub: {
    id: "stub-8",
    stub_no: "STUB-2026-000008",
    serial_no: "SER-2026-000008",
    status: "CLAIMED",
    qr_code_value: "DISTYNC-STUB|event|household|stub-8|STUB-2026-000008",
    qr_status: "ACTIVE",
    issued_at: "2026-09-25T01:00:00.000Z",
    claimed_at: "2026-09-26T03:00:00.000Z",
  },
  household: { id: "household-8", family_head_name: "Kyla Avila" },
  distribution_transaction: {
    id: "transaction-8",
    stub_id: "stub-8",
    receipt_no: "RCPT-2026-000010",
    proof_type: "PHOTO",
    has_proof_photo: true,
    proof_photo_captured_at: "2026-09-26T02:59:00.000Z",
    relief_pack_template_name: "Family Pack",
    verified_by_name: "Relief Officer",
  },
};

test("history detail maps nested canonical Stub fields for the shared Household Details modal", () => {
  const mapped = mapDistributionHistoryDetailForModal(photoHistoryDetail, {
    stub_id: "stub-8",
    stub_sequence_no: 8,
  });
  const stubRecord = getCanonicalStubRecord(mapped);

  assert.equal(stubRecord.id, "stub-8");
  assert.equal(stubRecord.display_stub_no, "STUB#8");
  assert.equal(getDisplayStubNumber(stubRecord), "STUB#8");
  assert.equal(stubRecord.status, "CLAIMED");
  assert.equal(stubRecord.qr_code_value, photoHistoryDetail.stub.qr_code_value);
  assert.equal(stubRecord.qr_status, "ACTIVE");
  assert.equal(stubRecord.issued_at, "2026-09-25T01:00:00.000Z");
  assert.equal(stubRecord.claimed_at, "2026-09-26T03:00:00.000Z");
  assert.equal(mapped.distribution_transaction.stub_id, "stub-8");
  assert.equal(mapped.distribution_transaction.receipt_no, "RCPT-2026-000010");
  assert.equal(mapped.distribution_transaction.proof_type, "PHOTO");
  assert.equal(mapped.distribution_transaction.has_proof_photo, true);
});

test("flat Relief Goods Distribution details remain the canonical record shape", () => {
  const flatDetails = {
    id: "stub-1",
    display_stub_no: "STUB#1",
    status: "CLAIMED",
    qr_code_value: "QR-1",
    issued_at: "2026-09-20T01:00:00.000Z",
    claimed_at: "2026-09-21T01:00:00.000Z",
  };

  assert.equal(getCanonicalStubRecord(flatDetails), flatDetails);
  assert.equal(
    mapDistributionHistoryDetailForModal(flatDetails, { stub_sequence_no: 1 }),
    flatDetails,
  );
  assert.equal(getDisplayStubNumber(flatDetails), "STUB#1");
});

test("canonical Stub number takes precedence over the history row sequence", () => {
  const detail = {
    stub: {
      id: "stub-4",
      stub_no: "STUB-2026-000004",
      display_stub_no: "STUB#4",
      stub_sequence_no: 4,
    },
  };

  const mapped = mapDistributionHistoryDetailForModal(detail, {
    stub_id: "stub-4",
    stub_sequence_no: 8,
  });

  assert.equal(getCanonicalStubRecord(mapped).stub_sequence_no, 4);
  assert.equal(getCanonicalStubRecord(mapped).display_stub_no, "STUB#4");
  assert.equal(getDisplayStubNumber(getCanonicalStubRecord(mapped)), "STUB#4");
});

test("a true no-QR Stub remains without a generated QR value", () => {
  const detail = {
    stub: {
      id: "stub-no-qr",
      stub_no: "STUB-2026-000009",
      status: "CLAIMED",
      qr_code_value: null,
      issued_at: "2026-09-25T01:00:00.000Z",
      claimed_at: "2026-09-26T03:00:00.000Z",
    },
  };

  const mapped = mapDistributionHistoryDetailForModal(detail, {
    stub_id: "stub-no-qr",
    stub_sequence_no: 9,
  });

  assert.equal(getCanonicalStubRecord(mapped).qr_code_value, null);
  assert.equal(getDisplayStubNumber(getCanonicalStubRecord(mapped)), "STUB#9");
});
