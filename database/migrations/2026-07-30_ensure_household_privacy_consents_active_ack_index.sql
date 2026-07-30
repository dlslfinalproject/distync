CREATE UNIQUE INDEX IF NOT EXISTS household_privacy_consents_active_ack_unique
  ON household_privacy_consents (household_id, notice_version)
  WHERE consent_status = 'ACKNOWLEDGED';
