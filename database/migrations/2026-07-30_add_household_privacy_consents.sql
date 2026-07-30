CREATE TABLE IF NOT EXISTS household_privacy_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id),
  disaster_event_id uuid NOT NULL REFERENCES disaster_events(id),
  consent_status character varying NOT NULL
    CHECK (
      consent_status::text = ANY (
        ARRAY[
          'ACKNOWLEDGED'::character varying,
          'DECLINED'::character varying,
          'WITHDRAWN'::character varying
        ]::text[]
      )
    ),
  notice_version character varying NOT NULL,
  acknowledged_at timestamp with time zone NOT NULL,
  acknowledged_by_name character varying NOT NULL,
  representative_relationship character varying,
  recorded_by uuid NOT NULL REFERENCES users(id),
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  device_id uuid REFERENCES devices(id),
  is_offline_encoded boolean NOT NULL DEFAULT false,
  sync_status character varying NOT NULL DEFAULT 'SYNCED'
    CHECK (
      sync_status::text = ANY (
        ARRAY[
          'PENDING'::character varying,
          'SYNCED'::character varying,
          'FAILED'::character varying,
          'CONFLICT'::character varying
        ]::text[]
      )
    ),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS household_privacy_consents_active_ack_unique
  ON household_privacy_consents (household_id, notice_version)
  WHERE consent_status = 'ACKNOWLEDGED';

CREATE INDEX IF NOT EXISTS household_privacy_consents_household_idx
  ON household_privacy_consents (household_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS household_privacy_consents_disaster_event_idx
  ON household_privacy_consents (disaster_event_id, recorded_at DESC);
