-- =========================================================
-- DISTYNC DATABASE SCHEMA REFERENCE
-- File: database/schema/distync_schema.sql
-- Database: PostgreSQL / Supabase Postgres
-- =========================================================

-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

-- =========================================================
-- 1) REFERENCE / ACCESS CONTROL TABLES
-- =========================================================

-- NOTE:
-- The permissions and role_permissions tables are currently retained as
-- reference/documentation structures and for possible future migration to a
-- richer policy model.
-- Live runtime authorization in the current app is still enforced primarily by
-- role-code checks in the backend (for example BARANGAY, MSWDO, MAYOR), not by
-- dynamic permission-table lookups.

CREATE TABLE public.roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code character varying NOT NULL UNIQUE,
  name character varying NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT roles_pkey PRIMARY KEY (id)
);

CREATE TABLE public.permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code character varying NOT NULL UNIQUE,
  name character varying NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT permissions_pkey PRIMARY KEY (id)
);

CREATE TABLE public.role_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL,
  permission_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT role_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id),
  CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id)
);

CREATE TABLE public.barangays (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code character varying NOT NULL UNIQUE,
  name character varying NOT NULL UNIQUE,
  municipality_name character varying NOT NULL DEFAULT 'Malvar'::character varying,
  province_name character varying NOT NULL DEFAULT 'Batangas'::character varying,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT barangays_pkey PRIMARY KEY (id)
);

CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  google_sub character varying UNIQUE,
  email character varying NOT NULL UNIQUE,
  first_name character varying NOT NULL,
  middle_name character varying,
  last_name character varying NOT NULL,
  contact_number character varying,
  default_barangay_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  auth_provider character varying NOT NULL DEFAULT 'GOOGLE'::character varying,
  last_login_at timestamp with time zone,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_default_barangay_id_fkey FOREIGN KEY (default_barangay_id) REFERENCES public.barangays(id)
);

CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_id uuid NOT NULL,
  assigned_by uuid,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id),
  CONSTRAINT user_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id)
);

CREATE TABLE public.user_role_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_code character varying NOT NULL,
  profile_picture_data_url text,
  profile_picture_file_name character varying,
  enabled_notification_rule_codes_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  notification_channels_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  preferred_export_format character varying NOT NULL DEFAULT 'excel'::character varying CHECK (preferred_export_format::text = ANY (ARRAY['csv'::character varying, 'excel'::character varying, 'pdf'::character varying]::text[])),
  last_profile_update_at timestamp with time zone,
  last_preference_save_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_role_settings_pkey PRIMARY KEY (id),
  CONSTRAINT user_role_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_role_settings_role_code_fkey FOREIGN KEY (role_code) REFERENCES public.roles(code),
  CONSTRAINT user_role_settings_user_role_unique UNIQUE (user_id, role_code)
);

CREATE TABLE public.devices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  device_uuid character varying NOT NULL UNIQUE,
  device_name character varying,
  platform character varying,
  browser character varying,
  last_seen_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT devices_pkey PRIMARY KEY (id)
);

-- =========================================================
-- 2) DISASTER EVENT MANAGEMENT
-- =========================================================

CREATE TABLE public.disaster_event_code_counters (
  event_year integer NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT disaster_event_code_counters_pkey PRIMARY KEY (event_year)
);

CREATE TABLE public.disaster_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_code character varying NOT NULL UNIQUE,
  title character varying NOT NULL,
  disaster_type character varying NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date,
  status character varying NOT NULL DEFAULT 'PLANNED'::character varying CHECK (status::text = ANY (ARRAY['PLANNED'::character varying, 'ACTIVE'::character varying, 'CLOSED'::character varying, 'ARCHIVED'::character varying]::text[])),
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  CONSTRAINT disaster_events_pkey PRIMARY KEY (id),
  CONSTRAINT disaster_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);

CREATE TABLE public.disaster_event_barangays (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  disaster_event_id uuid NOT NULL,
  barangay_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT disaster_event_barangays_pkey PRIMARY KEY (id),
  CONSTRAINT disaster_event_barangays_disaster_event_id_fkey FOREIGN KEY (disaster_event_id) REFERENCES public.disaster_events(id),
  CONSTRAINT disaster_event_barangays_barangay_id_fkey FOREIGN KEY (barangay_id) REFERENCES public.barangays(id)
);

CREATE TABLE public.evacuation_centers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  barangay_id uuid NOT NULL,
  name character varying NOT NULL,
  individual_capacity integer CHECK (individual_capacity IS NULL OR individual_capacity >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT evacuation_centers_pkey PRIMARY KEY (id),
  CONSTRAINT evacuation_centers_barangay_id_fkey FOREIGN KEY (barangay_id) REFERENCES public.barangays(id)
);

-- =========================================================
-- 3) HOUSEHOLD & EVACUEE MANAGEMENT
-- =========================================================

CREATE TABLE public.sectors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code character varying NOT NULL UNIQUE,
  name character varying NOT NULL UNIQUE,
  description text,
  sector_group character varying,
  is_barangay_visible boolean NOT NULL DEFAULT true,
  is_mswdo_visible boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sectors_pkey PRIMARY KEY (id)
);

CREATE TABLE public.households (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  disaster_event_id uuid NOT NULL,
  barangay_id uuid NOT NULL,
  evacuation_center_id uuid,
  family_head_first_name character varying NOT NULL,
  family_head_middle_name character varying,
  family_head_last_name character varying NOT NULL,
  family_head_suffix character varying,
  sex character varying NOT NULL CHECK (sex::text = ANY (ARRAY['MALE'::character varying, 'FEMALE'::character varying]::text[])),
  birth_date date,
  contact_number character varying,
  current_stay_type character varying NOT NULL DEFAULT 'EVAC_CENTER'::character varying CHECK (current_stay_type::text = ANY (ARRAY['EVAC_CENTER'::character varying, 'RELATIVES'::character varying, 'OTHER_SAFE_PLACE'::character varying]::text[])),
  current_address_details text,
  household_size integer NOT NULL CHECK (household_size >= 1),
  is_active boolean NOT NULL DEFAULT true,
  registered_by uuid,
  registered_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  family_head_evacuee_id uuid,
  residency_status text NOT NULL DEFAULT 'RESIDENT'::text CHECK (residency_status = ANY (ARRAY['RESIDENT'::text, 'NON_RESIDENT'::text])),
  family_head_photo_url text,
  photo_captured_at timestamp with time zone,
  photo_captured_by uuid,
  photo_verification_notes text,
  CONSTRAINT households_pkey PRIMARY KEY (id),
  CONSTRAINT households_disaster_event_id_fkey FOREIGN KEY (disaster_event_id) REFERENCES public.disaster_events(id),
  CONSTRAINT households_barangay_id_fkey FOREIGN KEY (barangay_id) REFERENCES public.barangays(id),
  CONSTRAINT households_evacuation_center_id_fkey FOREIGN KEY (evacuation_center_id) REFERENCES public.evacuation_centers(id),
  CONSTRAINT households_registered_by_fkey FOREIGN KEY (registered_by) REFERENCES public.users(id),
  CONSTRAINT fk_households_family_head_evacuee FOREIGN KEY (family_head_evacuee_id) REFERENCES public.evacuees(id),
  CONSTRAINT households_photo_captured_by_fkey FOREIGN KEY (photo_captured_by) REFERENCES public.users(id)
);

CREATE TABLE public.household_privacy_consents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  disaster_event_id uuid NOT NULL,
  consent_status character varying NOT NULL CHECK (consent_status::text = ANY (ARRAY['ACKNOWLEDGED'::character varying, 'DECLINED'::character varying, 'WITHDRAWN'::character varying]::text[])),
  notice_version character varying NOT NULL,
  acknowledged_at timestamp with time zone NOT NULL,
  acknowledged_by_name character varying NOT NULL,
  representative_relationship character varying,
  recorded_by uuid NOT NULL,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  device_id uuid,
  is_offline_encoded boolean NOT NULL DEFAULT false,
  sync_status character varying NOT NULL DEFAULT 'SYNCED'::character varying CHECK (sync_status::text = ANY (ARRAY['PENDING'::character varying, 'SYNCED'::character varying, 'FAILED'::character varying, 'CONFLICT'::character varying]::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT household_privacy_consents_pkey PRIMARY KEY (id),
  CONSTRAINT household_privacy_consents_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
  CONSTRAINT household_privacy_consents_disaster_event_id_fkey FOREIGN KEY (disaster_event_id) REFERENCES public.disaster_events(id),
  CONSTRAINT household_privacy_consents_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id),
  CONSTRAINT household_privacy_consents_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id)
);

CREATE TABLE public.evacuees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  first_name character varying NOT NULL,
  middle_name character varying,
  last_name character varying NOT NULL,
  suffix character varying,
  sex character varying NOT NULL CHECK (sex::text = ANY (ARRAY['MALE'::character varying, 'FEMALE'::character varying]::text[])),
  birth_date date,
  age integer CHECK (age IS NULL OR age >= 0),
  civil_status character varying,
  relationship_to_head character varying NOT NULL,
  is_family_head boolean NOT NULL DEFAULT false,
  is_pregnant boolean NOT NULL DEFAULT false,
  is_lactating boolean NOT NULL DEFAULT false,
  has_disability boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  age_value integer CHECK (age_value IS NULL OR age_value >= 0),
  age_unit character varying CHECK (age_unit IS NULL OR (age_unit::text = ANY (ARRAY['MONTHS'::character varying, 'YEARS'::character varying]::text[]))),
  CONSTRAINT evacuees_pkey PRIMARY KEY (id),
  CONSTRAINT evacuees_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id)
);

CREATE TABLE public.household_sectors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  sector_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT household_sectors_pkey PRIMARY KEY (id),
  CONSTRAINT household_sectors_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
  CONSTRAINT household_sectors_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES public.sectors(id)
);

CREATE TABLE public.evacuee_sectors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  evacuee_id uuid NOT NULL,
  sector_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT evacuee_sectors_pkey PRIMARY KEY (id),
  CONSTRAINT evacuee_sectors_evacuee_id_fkey FOREIGN KEY (evacuee_id) REFERENCES public.evacuees(id),
  CONSTRAINT evacuee_sectors_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES public.sectors(id)
);

CREATE TABLE public.evacuation_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  disaster_event_id uuid NOT NULL,
  household_id uuid NOT NULL,
  evacuee_id uuid NOT NULL,
  evacuation_center_id uuid,
  time_in timestamp with time zone NOT NULL,
  time_out timestamp with time zone,
  status character varying NOT NULL DEFAULT 'PRESENT'::character varying CHECK (status::text = ANY (ARRAY['PRESENT'::character varying, 'LEFT'::character varying, 'TRANSFERRED'::character varying]::text[])),
  recorded_by uuid,
  remarks text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT evacuation_logs_pkey PRIMARY KEY (id),
  CONSTRAINT evacuation_logs_disaster_event_id_fkey FOREIGN KEY (disaster_event_id) REFERENCES public.disaster_events(id),
  CONSTRAINT evacuation_logs_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
  CONSTRAINT evacuation_logs_evacuee_id_fkey FOREIGN KEY (evacuee_id) REFERENCES public.evacuees(id),
  CONSTRAINT evacuation_logs_evacuation_center_id_fkey FOREIGN KEY (evacuation_center_id) REFERENCES public.evacuation_centers(id),
  CONSTRAINT evacuation_logs_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id)
);

-- =========================================================
-- 4) STUBS & DISTRIBUTION
-- =========================================================

CREATE TABLE public.stubs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  disaster_event_id uuid NOT NULL,
  household_id uuid NOT NULL,
  stub_no character varying NOT NULL UNIQUE,
  serial_no character varying NOT NULL UNIQUE,
  status character varying NOT NULL DEFAULT 'ISSUED'::character varying CHECK (status::text = ANY (ARRAY['ISSUED'::character varying, 'CLAIMED'::character varying, 'CANCELLED'::character varying, 'VOID'::character varying]::text[])),
  issued_by uuid,
  issued_at timestamp with time zone NOT NULL DEFAULT now(),
  claimed_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  qr_code_value text,
  qr_generated_at timestamp with time zone,
  qr_generated_by uuid,
  qr_status character varying NOT NULL DEFAULT 'ACTIVE'::character varying CHECK (qr_status::text = ANY (ARRAY['ACTIVE'::character varying, 'VOIDED'::character varying, 'REGENERATED'::character varying]::text[])),
  qr_notes text,
  CONSTRAINT stubs_pkey PRIMARY KEY (id),
  CONSTRAINT stubs_disaster_event_id_fkey FOREIGN KEY (disaster_event_id) REFERENCES public.disaster_events(id),
  CONSTRAINT stubs_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
  CONSTRAINT stubs_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.users(id),
  CONSTRAINT stubs_qr_generated_by_fkey FOREIGN KEY (qr_generated_by) REFERENCES public.users(id)
);

CREATE TABLE public.distribution_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  disaster_event_id uuid NOT NULL,
  household_id uuid NOT NULL,
  stub_id uuid NOT NULL UNIQUE,
  distribution_date timestamp with time zone NOT NULL DEFAULT now(),
  distribution_status character varying NOT NULL DEFAULT 'CLAIMED'::character varying CHECK (distribution_status::text = ANY (ARRAY['CLAIMED'::character varying, 'CANCELLED'::character varying, 'REVERSED'::character varying]::text[])),
  claimed_by_name character varying,
  verified_by uuid,
  device_id uuid,
  is_offline_encoded boolean NOT NULL DEFAULT false,
  sync_status character varying NOT NULL DEFAULT 'SYNCED'::character varying CHECK (sync_status::text = ANY (ARRAY['PENDING'::character varying, 'SYNCED'::character varying, 'CONFLICT'::character varying, 'FAILED'::character varying]::text[])),
  remarks text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  receipt_no character varying,
  receipt_status character varying NOT NULL DEFAULT 'GENERATED'::character varying CHECK (receipt_status::text = ANY (ARRAY['GENERATED'::character varying, 'VOIDED'::character varying, 'REISSUED'::character varying, 'CANCELLED'::character varying]::text[])),
  received_at timestamp with time zone,
  qr_reference_value text,
  qr_scanned_at timestamp with time zone,
  qr_scanned_by uuid,
  relief_pack_template_id uuid,
  CONSTRAINT distribution_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT distribution_transactions_disaster_event_id_fkey FOREIGN KEY (disaster_event_id) REFERENCES public.disaster_events(id),
  CONSTRAINT distribution_transactions_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
  CONSTRAINT distribution_transactions_stub_id_fkey FOREIGN KEY (stub_id) REFERENCES public.stubs(id),
  CONSTRAINT distribution_transactions_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id),
  CONSTRAINT distribution_transactions_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id),
  CONSTRAINT distribution_transactions_relief_pack_template_id_fkey FOREIGN KEY (relief_pack_template_id) REFERENCES public.relief_pack_templates(id),
  CONSTRAINT distribution_transactions_qr_scanned_by_fkey FOREIGN KEY (qr_scanned_by) REFERENCES public.users(id)
);

CREATE TABLE public.distribution_transaction_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  distribution_transaction_id uuid NOT NULL,
  inventory_batch_id uuid NOT NULL,
  inventory_item_id uuid NOT NULL,
  quantity_released integer NOT NULL CHECK (quantity_released > 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT distribution_transaction_items_pkey PRIMARY KEY (id),
  CONSTRAINT distribution_transaction_items_distribution_transaction_id_fkey FOREIGN KEY (distribution_transaction_id) REFERENCES public.distribution_transactions(id),
  CONSTRAINT distribution_transaction_items_inventory_batch_id_fkey FOREIGN KEY (inventory_batch_id) REFERENCES public.inventory_batches(id),
  CONSTRAINT distribution_transaction_items_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id)
);

-- =========================================================
-- 5) INVENTORY MANAGEMENT
-- =========================================================

CREATE TABLE public.suppliers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL UNIQUE,
  contact_person character varying,
  contact_number character varying,
  address text,
  has_moa boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT suppliers_pkey PRIMARY KEY (id)
);

CREATE TABLE public.inventory_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_code character varying NOT NULL UNIQUE,
  item_name character varying NOT NULL UNIQUE,
  category character varying NOT NULL,
  unit_of_measure character varying NOT NULL,
  barcode character varying,
  is_perishable boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  packaging character varying,
  quantity integer CHECK (quantity IS NULL OR quantity > 0),
  packaging_count integer CHECK (packaging_count IS NULL OR packaging_count > 0),
  unit_of_measure_value numeric CHECK (unit_of_measure_value IS NULL OR unit_of_measure_value > 0::numeric),
  reorder_level integer CHECK (reorder_level IS NULL OR reorder_level > 0),
  expiration_date date,
  CONSTRAINT inventory_items_pkey PRIMARY KEY (id)
);

CREATE TABLE public.inventory_item_stock_forms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  inventory_item_id uuid NOT NULL,
  barcode character varying,
  packaging character varying NOT NULL,
  units_per_packaging integer NOT NULL CHECK (units_per_packaging > 0),
  unit_of_measure character varying NOT NULL,
  unit_of_measure_value numeric CHECK (unit_of_measure_value IS NULL OR unit_of_measure_value > 0::numeric),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT inventory_item_stock_forms_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_item_stock_forms_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id),
  CONSTRAINT inventory_item_stock_forms_barcode_key UNIQUE (barcode),
  CONSTRAINT inventory_item_stock_forms_unique_packaging UNIQUE (inventory_item_id, packaging, units_per_packaging, unit_of_measure, unit_of_measure_value)
);

CREATE TABLE public.inventory_batches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  inventory_item_id uuid NOT NULL,
  inventory_item_stock_form_id uuid,
  batch_no character varying NOT NULL,
  supplier_id uuid,
  source_type character varying NOT NULL DEFAULT 'LGU'::character varying CHECK (source_type::text = ANY (ARRAY['PURCHASED'::character varying, 'DONATED'::character varying, 'DSWD'::character varying, 'LGU'::character varying, 'OTHER'::character varying]::text[])),
  quantity_received integer NOT NULL CHECK (quantity_received >= 0),
  quantity_available integer NOT NULL CHECK (quantity_available >= 0),
  expiration_date date,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  storage_location character varying,
  status character varying NOT NULL DEFAULT 'AVAILABLE'::character varying CHECK (status::text = ANY (ARRAY['AVAILABLE'::character varying, 'LOW_STOCK'::character varying, 'EXPIRED'::character varying, 'DEPLETED'::character varying, 'MISSING'::character varying, 'DAMAGED'::character varying]::text[])),
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT inventory_batches_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_batches_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id),
  CONSTRAINT inventory_batches_inventory_item_stock_form_id_fkey FOREIGN KEY (inventory_item_stock_form_id) REFERENCES public.inventory_item_stock_forms(id),
  CONSTRAINT inventory_batches_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id),
  CONSTRAINT inventory_batches_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);

CREATE TABLE public.inventory_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  disaster_event_id uuid,
  inventory_batch_id uuid NOT NULL,
  transaction_type character varying NOT NULL CHECK (transaction_type::text = ANY (ARRAY['INFLOW'::character varying, 'OUTFLOW'::character varying, 'ADJUSTMENT'::character varying, 'EXPIRED'::character varying, 'MISSING'::character varying, 'DAMAGED'::character varying, 'SPOILED'::character varying, 'STOLEN'::character varying, 'RETURN'::character varying]::text[])),
  quantity integer NOT NULL CHECK (quantity >= 0),
  reference_type character varying NOT NULL DEFAULT 'MANUAL'::character varying CHECK (reference_type::text = ANY (ARRAY['MANUAL'::character varying, 'BARCODE_SCAN'::character varying, 'QR_SCAN'::character varying, 'DISTRIBUTION'::character varying, 'DONATION'::character varying, 'PROOF_OF_RECEIPT'::character varying, 'SYNC'::character varying, 'SYSTEM'::character varying]::text[])),
  reference_id uuid,
  performed_by uuid,
  performed_at timestamp with time zone NOT NULL DEFAULT now(),
  remarks text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT inventory_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_transactions_disaster_event_id_fkey FOREIGN KEY (disaster_event_id) REFERENCES public.disaster_events(id),
  CONSTRAINT inventory_transactions_inventory_batch_id_fkey FOREIGN KEY (inventory_batch_id) REFERENCES public.inventory_batches(id),
  CONSTRAINT inventory_transactions_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id)
);

CREATE TABLE public.relief_pack_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL UNIQUE,
  description text,
  based_on_family_size boolean NOT NULL DEFAULT false,
  based_on_sector boolean NOT NULL DEFAULT false,
  is_additional_pack boolean NOT NULL DEFAULT false,
  sector_id uuid,
  created_by uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT relief_pack_templates_pkey PRIMARY KEY (id),
  CONSTRAINT relief_pack_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id),
  CONSTRAINT relief_pack_templates_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES public.sectors(id)
);

CREATE TABLE public.relief_pack_template_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL,
  inventory_item_id uuid NOT NULL,
  quantity_required integer NOT NULL CHECK (quantity_required > 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT relief_pack_template_items_pkey PRIMARY KEY (id),
  CONSTRAINT relief_pack_template_items_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.relief_pack_templates(id),
  CONSTRAINT relief_pack_template_items_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id)
);

-- =========================================================
-- 6) DONATIONS & DONOR MANAGEMENT
-- =========================================================

CREATE TABLE public.donations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  disaster_event_id uuid NOT NULL,
  donor_name character varying NOT NULL,
  donor_type character varying NOT NULL DEFAULT 'INDIVIDUAL'::character varying CHECK (donor_type::text = ANY (ARRAY['INDIVIDUAL'::character varying, 'NGO'::character varying, 'PRIVATE_ORGANIZATION'::character varying, 'GOVERNMENT_PARTNER'::character varying, 'OTHER'::character varying]::text[])),
  contact_information character varying,
  received_by uuid,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  status character varying NOT NULL DEFAULT 'RECEIVED'::character varying CHECK (status::text = ANY (ARRAY['RECEIVED'::character varying, 'PARTIALLY_DISTRIBUTED'::character varying, 'DISTRIBUTED'::character varying, 'CANCELLED'::character varying]::text[])),
  remarks text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT donations_pkey PRIMARY KEY (id),
  CONSTRAINT donations_disaster_event_id_fkey FOREIGN KEY (disaster_event_id) REFERENCES public.disaster_events(id),
  CONSTRAINT donations_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.users(id)
);

CREATE TABLE public.donation_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  donation_id uuid NOT NULL,
  inventory_item_id uuid NOT NULL,
  inventory_batch_id uuid,
  quantity_received integer NOT NULL CHECK (quantity_received > 0),
  remarks text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT donation_items_pkey PRIMARY KEY (id),
  CONSTRAINT donation_items_donation_id_fkey FOREIGN KEY (donation_id) REFERENCES public.donations(id),
  CONSTRAINT donation_items_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id),
  CONSTRAINT donation_items_inventory_batch_id_fkey FOREIGN KEY (inventory_batch_id) REFERENCES public.inventory_batches(id)
);

CREATE TABLE public.donation_needs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  disaster_event_id uuid NOT NULL,
  inventory_item_id uuid NOT NULL,
  quantity_needed integer NOT NULL CHECK (quantity_needed >= 0),
  priority_level character varying NOT NULL DEFAULT 'MEDIUM'::character varying CHECK (priority_level::text = ANY (ARRAY['LOW'::character varying, 'MEDIUM'::character varying, 'HIGH'::character varying, 'URGENT'::character varying]::text[])),
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  published_by uuid,
  published_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT donation_needs_pkey PRIMARY KEY (id),
  CONSTRAINT donation_needs_disaster_event_id_fkey FOREIGN KEY (disaster_event_id) REFERENCES public.disaster_events(id),
  CONSTRAINT donation_needs_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id),
  CONSTRAINT donation_needs_published_by_fkey FOREIGN KEY (published_by) REFERENCES public.users(id)
);

CREATE TABLE public.default_emergency_donation_needs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  inventory_item_id uuid,
  item_name character varying NOT NULL,
  category character varying,
  unit_of_measure character varying NOT NULL DEFAULT 'items'::character varying,
  suggested_quantity integer CHECK (suggested_quantity IS NULL OR suggested_quantity >= 0),
  priority_level character varying NOT NULL DEFAULT 'MEDIUM'::character varying CHECK (priority_level::text = ANY (ARRAY['LOW'::character varying, 'MEDIUM'::character varying, 'HIGH'::character varying, 'URGENT'::character varying]::text[])),
  notes text,
  disaster_type character varying,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT default_emergency_donation_needs_pkey PRIMARY KEY (id),
  CONSTRAINT default_emergency_donation_needs_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id)
);

-- =========================================================
-- 7) NOTIFICATIONS
-- =========================================================

CREATE TABLE public.notification_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code character varying NOT NULL UNIQUE,
  name character varying NOT NULL,
  trigger_type character varying NOT NULL,
  target_role_code character varying NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notification_rules_pkey PRIMARY KEY (id)
);

CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  disaster_event_id uuid,
  type character varying NOT NULL CHECK (type::text = ANY (ARRAY['EVENT'::character varying, 'INVENTORY'::character varying, 'EXPIRY'::character varying, 'SYNC'::character varying, 'ANOMALY'::character varying, 'SYSTEM'::character varying]::text[])),
  title character varying NOT NULL,
  message text NOT NULL,
  severity character varying NOT NULL DEFAULT 'INFO'::character varying CHECK (severity::text = ANY (ARRAY['INFO'::character varying, 'WARNING'::character varying, 'CRITICAL'::character varying]::text[])),
  reference_type character varying,
  reference_id uuid,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_disaster_event_id_fkey FOREIGN KEY (disaster_event_id) REFERENCES public.disaster_events(id)
);

CREATE TABLE public.notification_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL,
  user_id uuid NOT NULL,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notification_recipients_pkey PRIMARY KEY (id),
  CONSTRAINT notification_recipients_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notifications(id),
  CONSTRAINT notification_recipients_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- =========================================================
-- 8) SYNC & OFFLINE SUPPORT
-- =========================================================

CREATE TABLE public.sync_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  device_id uuid,
  user_id uuid,
  entity_type character varying NOT NULL,
  entity_local_id character varying,
  entity_server_id uuid,
  operation_type character varying NOT NULL CHECK (operation_type::text = ANY (ARRAY['CREATE'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying, 'CLAIM'::character varying, 'TIME_IN'::character varying, 'TIME_OUT'::character varying, 'PHOTO_CAPTURE'::character varying, 'QR_SCAN'::character varying, 'PROOF_RECEIPT'::character varying, 'DONATION_RECEIVE'::character varying, 'DONATION_UPDATE'::character varying, 'INVENTORY_ADJUSTMENT'::character varying]::text[])),
  payload_json jsonb NOT NULL,
  client_timestamp timestamp with time zone NOT NULL,
  server_timestamp timestamp with time zone,
  sync_status character varying NOT NULL DEFAULT 'PENDING'::character varying CHECK (sync_status::text = ANY (ARRAY['PENDING'::character varying, 'SYNCED'::character varying, 'CONFLICT'::character varying, 'FAILED'::character varying]::text[])),
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sync_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT sync_transactions_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id),
  CONSTRAINT sync_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

CREATE TABLE public.sync_conflicts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sync_transaction_id uuid NOT NULL,
  entity_type character varying NOT NULL,
  entity_server_id uuid,
  conflict_type character varying NOT NULL,
  local_payload_json jsonb NOT NULL,
  server_payload_json jsonb NOT NULL,
  resolution_strategy character varying NOT NULL CHECK (resolution_strategy::text = ANY (ARRAY['LATEST_TIMESTAMP'::character varying, 'MANUAL_REVIEW'::character varying, 'MERGED'::character varying]::text[])),
  resolved_payload_json jsonb,
  resolved_by uuid,
  resolved_at timestamp with time zone,
  status character varying NOT NULL DEFAULT 'OPEN'::character varying CHECK (status::text = ANY (ARRAY['OPEN'::character varying, 'RESOLVED'::character varying]::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sync_conflicts_pkey PRIMARY KEY (id),
  CONSTRAINT sync_conflicts_sync_transaction_id_fkey FOREIGN KEY (sync_transaction_id) REFERENCES public.sync_transactions(id),
  CONSTRAINT sync_conflicts_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id)
);

-- =========================================================
-- 9) FORECASTING & ANALYTICS
-- =========================================================

CREATE TABLE public.forecast_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  disaster_event_id uuid NOT NULL,
  run_type character varying NOT NULL CHECK (run_type::text = ANY (ARRAY['INVENTORY_DEMAND'::character varying, 'STOCK_DEPLETION'::character varying, 'REPLENISHMENT'::character varying]::text[])),
  run_by uuid,
  run_at timestamp with time zone NOT NULL DEFAULT now(),
  model_name character varying NOT NULL,
  parameters_json jsonb,
  CONSTRAINT forecast_runs_pkey PRIMARY KEY (id),
  CONSTRAINT forecast_runs_disaster_event_id_fkey FOREIGN KEY (disaster_event_id) REFERENCES public.disaster_events(id),
  CONSTRAINT forecast_runs_run_by_fkey FOREIGN KEY (run_by) REFERENCES public.users(id)
);

CREATE TABLE public.forecast_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  forecast_run_id uuid NOT NULL,
  inventory_item_id uuid NOT NULL,
  predicted_quantity_needed numeric,
  predicted_depletion_date date,
  recommended_reorder_quantity numeric,
  confidence_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT forecast_results_pkey PRIMARY KEY (id),
  CONSTRAINT forecast_results_forecast_run_id_fkey FOREIGN KEY (forecast_run_id) REFERENCES public.forecast_runs(id),
  CONSTRAINT forecast_results_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id)
);

-- =========================================================
-- 10) LOGGING & AUDIT
-- =========================================================

CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  role_code character varying,
  device_id uuid,
  action character varying NOT NULL,
  entity_type character varying NOT NULL,
  entity_id uuid,
  old_values_json jsonb,
  new_values_json jsonb,
  ip_address inet,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT audit_logs_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id)
);

CREATE TABLE public.error_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  device_id uuid,
  module_name character varying NOT NULL,
  error_code character varying,
  error_message text NOT NULL,
  stack_trace text,
  severity character varying NOT NULL DEFAULT 'ERROR'::character varying CHECK (severity::text = ANY (ARRAY['INFO'::character varying, 'WARNING'::character varying, 'ERROR'::character varying, 'CRITICAL'::character varying]::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT error_logs_pkey PRIMARY KEY (id),
  CONSTRAINT error_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT error_logs_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id)
);
