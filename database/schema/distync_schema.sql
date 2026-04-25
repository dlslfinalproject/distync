-- =========================================================
-- DISTYNC INITIAL DATABASE SCHEMA
-- File: database/schema/distync_schema.sql
-- Database: PostgreSQL / Supabase Postgres
-- =========================================================

-- Optional but recommended for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- 1) REFERENCE / ACCESS CONTROL TABLES
-- =========================================================

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_role_permissions UNIQUE (role_id, permission_id)
);

CREATE TABLE barangays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL UNIQUE,
    municipality_name VARCHAR(150) NOT NULL DEFAULT 'Malvar',
    province_name VARCHAR(150) NOT NULL DEFAULT 'Batangas',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE evacuation_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barangay_id UUID NOT NULL REFERENCES barangays(id) ON DELETE RESTRICT,
    name VARCHAR(200) NOT NULL,
    individual_capacity INTEGER CHECK (individual_capacity IS NULL OR individual_capacity >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_evacuation_center UNIQUE (barangay_id, name)
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_sub VARCHAR(255) UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    contact_number VARCHAR(30),
    default_barangay_id UUID REFERENCES barangays(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_role UNIQUE (user_id, role_id)
);

CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_uuid VARCHAR(255) NOT NULL UNIQUE,
    device_name VARCHAR(150),
    platform VARCHAR(100),
    browser VARCHAR(100),
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 2) DISASTER EVENT TABLES
-- =========================================================

CREATE TABLE disaster_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_code VARCHAR(100) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    disaster_type VARCHAR(100) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    ended_at TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'PLANNED',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_disaster_event_status
        CHECK (status IN ('PLANNED', 'ACTIVE', 'CLOSED', 'ARCHIVED')),
    CONSTRAINT chk_disaster_event_dates
        CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE disaster_event_barangays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disaster_event_id UUID NOT NULL REFERENCES disaster_events(id) ON DELETE CASCADE,
    barangay_id UUID NOT NULL REFERENCES barangays(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_disaster_event_barangay UNIQUE (disaster_event_id, barangay_id)
);

CREATE TABLE disaster_event_code_counters (
    event_year INTEGER PRIMARY KEY,
    last_number INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION generate_disaster_event_code_safe(p_start_date DATE)
RETURNS VARCHAR(100)
LANGUAGE plpgsql
AS $$
DECLARE
    v_event_year INTEGER := EXTRACT(YEAR FROM COALESCE(p_start_date, CURRENT_DATE));
    v_next_number INTEGER;
BEGIN
    LOOP
        UPDATE disaster_event_code_counters
        SET
            last_number = last_number + 1,
            updated_at = NOW()
        WHERE event_year = v_event_year
        RETURNING last_number INTO v_next_number;

        IF FOUND THEN
            EXIT;
        END IF;

        BEGIN
            INSERT INTO disaster_event_code_counters (
                event_year,
                last_number,
                updated_at
            )
            VALUES (
                v_event_year,
                1,
                NOW()
            )
            RETURNING last_number INTO v_next_number;

            EXIT;
        EXCEPTION
            WHEN unique_violation THEN
                NULL;
        END;
    END LOOP;

    RETURN FORMAT(
        'DE-%s-%s',
        v_event_year,
        LPAD(v_next_number::TEXT, 4, '0')
    );
END;
$$;

CREATE OR REPLACE FUNCTION trg_set_disaster_event_code_safe()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.event_code IS NULL OR BTRIM(NEW.event_code) = '' THEN
        NEW.event_code := generate_disaster_event_code_safe(NEW.start_date);
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER before_insert_disaster_event_code_safe
BEFORE INSERT ON disaster_events
FOR EACH ROW
EXECUTE FUNCTION trg_set_disaster_event_code_safe();

-- =========================================================
-- 3) BENEFICIARY / EVACUEE TABLES
-- =========================================================

CREATE TABLE sectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    sector_group VARCHAR(50),
    is_barangay_visible BOOLEAN NOT NULL DEFAULT TRUE,
    is_mswdo_visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disaster_event_id UUID NOT NULL REFERENCES disaster_events(id) ON DELETE RESTRICT,
    barangay_id UUID NOT NULL REFERENCES barangays(id) ON DELETE RESTRICT,
    evacuation_center_id UUID REFERENCES evacuation_centers(id) ON DELETE SET NULL,
    residency_status VARCHAR(30) NOT NULL DEFAULT 'RESIDENT',

    family_head_first_name VARCHAR(100) NOT NULL,
    family_head_middle_name VARCHAR(100),
    family_head_last_name VARCHAR(100) NOT NULL,
    family_head_suffix VARCHAR(20),

    sex VARCHAR(20) NOT NULL,
    birth_date DATE,
    contact_number VARCHAR(30),

    current_stay_type VARCHAR(30) NOT NULL DEFAULT 'EVAC_CENTER',
    current_address_details TEXT,

    household_size INTEGER NOT NULL CHECK (household_size >= 1),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    registered_by UUID REFERENCES users(id) ON DELETE SET NULL,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_household_sex
        CHECK (sex IN ('MALE', 'FEMALE')),
    CONSTRAINT chk_household_stay_type
        CHECK (current_stay_type IN ('EVAC_CENTER', 'RELATIVES', 'OTHER_SAFE_PLACE')),
    CONSTRAINT chk_household_residency_status
        CHECK (residency_status IN ('RESIDENT', 'NON_RESIDENT'))
);

CREATE TABLE evacuees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,

    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    suffix VARCHAR(20),

    sex VARCHAR(20) NOT NULL,
    birth_date DATE,
    age INTEGER CHECK (age IS NULL OR age >= 0),

    age_value INTEGER CHECK (age_value IS NULL OR age_value >= 0),
    age_unit VARCHAR(10),

    civil_status VARCHAR(50),
    relationship_to_head VARCHAR(100) NOT NULL,

    is_family_head BOOLEAN NOT NULL DEFAULT FALSE,
    is_pregnant BOOLEAN NOT NULL DEFAULT FALSE,
    is_lactating BOOLEAN NOT NULL DEFAULT FALSE,
    has_disability BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_evacuee_sex
        CHECK (sex IN ('MALE', 'FEMALE')),
    CONSTRAINT chk_evacuee_age_unit
        CHECK (age_unit IS NULL OR age_unit IN ('MONTHS', 'YEARS'))

);

ALTER TABLE households
ADD COLUMN family_head_evacuee_id UUID,
ADD CONSTRAINT fk_households_family_head_evacuee
    FOREIGN KEY (family_head_evacuee_id)
    REFERENCES evacuees(id)
    ON DELETE SET NULL;

CREATE TABLE evacuee_sectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evacuee_id UUID NOT NULL REFERENCES evacuees(id) ON DELETE CASCADE,
    sector_id UUID NOT NULL REFERENCES sectors(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_evacuee_sector UNIQUE (evacuee_id, sector_id)
);

CREATE TABLE household_sectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    sector_id UUID NOT NULL REFERENCES sectors(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_household_sector UNIQUE (household_id, sector_id)
);

CREATE TABLE stubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disaster_event_id UUID NOT NULL REFERENCES disaster_events(id) ON DELETE RESTRICT,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    stub_no VARCHAR(100) NOT NULL UNIQUE,
    serial_no VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
    issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    claimed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_stub_status
        CHECK (status IN ('ISSUED', 'CLAIMED', 'CANCELLED', 'VOID')),
    CONSTRAINT uq_stub_household_event UNIQUE (disaster_event_id, household_id)
);

CREATE TABLE stub_code_counters (
    stub_year INTEGER PRIMARY KEY,
    last_number INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION reserve_next_stub_sequence_safe(p_reference_date DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_stub_year INTEGER := EXTRACT(YEAR FROM COALESCE(p_reference_date, CURRENT_DATE));
    v_next_number INTEGER;
BEGIN
    LOOP
        UPDATE stub_code_counters
        SET
            last_number = last_number + 1,
            updated_at = NOW()
        WHERE stub_year = v_stub_year
        RETURNING last_number INTO v_next_number;

        IF FOUND THEN
            EXIT;
        END IF;

        BEGIN
            INSERT INTO stub_code_counters (
                stub_year,
                last_number,
                updated_at
            )
            VALUES (
                v_stub_year,
                1,
                NOW()
            )
            RETURNING last_number INTO v_next_number;

            EXIT;
        EXCEPTION
            WHEN unique_violation THEN
                NULL;
        END;
    END LOOP;

    RETURN v_next_number;
END;
$$;

CREATE OR REPLACE FUNCTION generate_stub_numbers_safe(p_reference_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
    stub_no VARCHAR(100),
    serial_no VARCHAR(100)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_stub_year INTEGER := EXTRACT(YEAR FROM COALESCE(p_reference_date, CURRENT_DATE));
    v_next_number INTEGER;
BEGIN
    v_next_number := reserve_next_stub_sequence_safe(p_reference_date);

    RETURN QUERY
    SELECT
        FORMAT('STUB-%s-%s', v_stub_year, LPAD(v_next_number::TEXT, 6, '0'))::VARCHAR(100),
        FORMAT('SER-%s-%s', v_stub_year, LPAD(v_next_number::TEXT, 6, '0'))::VARCHAR(100);
END;
$$;

CREATE TABLE evacuation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disaster_event_id UUID NOT NULL REFERENCES disaster_events(id) ON DELETE RESTRICT,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    evacuee_id UUID NOT NULL REFERENCES evacuees(id) ON DELETE CASCADE,
    evacuation_center_id UUID REFERENCES evacuation_centers(id) ON DELETE SET NULL,

    time_in TIMESTAMPTZ NOT NULL,
    time_out TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'PRESENT',
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    remarks TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_evacuation_log_status
        CHECK (status IN ('PRESENT', 'LEFT', 'TRANSFERRED')),
    CONSTRAINT chk_evacuation_log_time
        CHECK (time_out IS NULL OR time_out >= time_in)
);

-- =========================================================
-- 4) INVENTORY TABLES
-- =========================================================

CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL UNIQUE,
    contact_person VARCHAR(150),
    contact_number VARCHAR(30),
    address TEXT,
    has_moa BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_code VARCHAR(100) NOT NULL UNIQUE,
    item_name VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL,
    unit_of_measure VARCHAR(50) NOT NULL,
    unit_of_measure_value NUMERIC(12,2) CHECK (unit_of_measure_value IS NULL OR unit_of_measure_value > 0),
    packaging VARCHAR(50),
    packaging_count INTEGER CHECK (packaging_count IS NULL OR packaging_count > 0),
    quantity INTEGER CHECK (quantity IS NULL OR quantity > 0),
    expiration_date DATE,
    barcode VARCHAR(150),
    is_perishable BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inventory_item_name UNIQUE (item_name)
);

CREATE TABLE inventory_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    batch_no VARCHAR(100) NOT NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,

    source_type VARCHAR(30) NOT NULL DEFAULT 'LGU',
    quantity_received INTEGER NOT NULL CHECK (quantity_received >= 0),
    quantity_available INTEGER NOT NULL CHECK (quantity_available >= 0),
    expiration_date DATE,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    storage_location VARCHAR(200),
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',

    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_inventory_source_type
        CHECK (source_type IN ('PURCHASED', 'DONATED', 'DSWD', 'LGU', 'OTHER')),
    CONSTRAINT chk_inventory_batch_status
        CHECK (status IN ('AVAILABLE', 'LOW_STOCK', 'EXPIRED', 'DEPLETED', 'MISSING', 'DAMAGED')),
    CONSTRAINT uq_inventory_batch UNIQUE (inventory_item_id, batch_no)
);

CREATE TABLE inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disaster_event_id UUID REFERENCES disaster_events(id) ON DELETE SET NULL,
    inventory_batch_id UUID NOT NULL REFERENCES inventory_batches(id) ON DELETE CASCADE,

    transaction_type VARCHAR(30) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    reference_type VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    reference_id UUID,
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    remarks TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_inventory_transaction_type
        CHECK (transaction_type IN ('INFLOW', 'OUTFLOW', 'ADJUSTMENT', 'EXPIRED', 'MISSING', 'DAMAGED', 'RETURN')),
    CONSTRAINT chk_inventory_reference_type
        CHECK (reference_type IN ('MANUAL', 'BARCODE_SCAN', 'DISTRIBUTION', 'SYNC', 'SYSTEM'))
);

CREATE TABLE relief_pack_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL UNIQUE,
    description TEXT,
    based_on_family_size BOOLEAN NOT NULL DEFAULT FALSE,
    based_on_sector BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE relief_pack_template_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES relief_pack_templates(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    quantity_required INTEGER NOT NULL CHECK (quantity_required > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_relief_pack_item UNIQUE (template_id, inventory_item_id)
);

-- =========================================================
-- 5) DISTRIBUTION TABLES
-- =========================================================

CREATE TABLE distribution_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disaster_event_id UUID NOT NULL REFERENCES disaster_events(id) ON DELETE RESTRICT,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE RESTRICT,
    stub_id UUID NOT NULL REFERENCES stubs(id) ON DELETE RESTRICT,

    distribution_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    distribution_status VARCHAR(20) NOT NULL DEFAULT 'CLAIMED',
    claimed_by_name VARCHAR(200),
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,

    is_offline_encoded BOOLEAN NOT NULL DEFAULT FALSE,
    sync_status VARCHAR(20) NOT NULL DEFAULT 'SYNCED',
    remarks TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_distribution_status
        CHECK (distribution_status IN ('CLAIMED', 'CANCELLED', 'REVERSED')),
    CONSTRAINT chk_distribution_sync_status
        CHECK (sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'FAILED')),
    CONSTRAINT uq_distribution_stub UNIQUE (stub_id)
);

CREATE TABLE distribution_transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distribution_transaction_id UUID NOT NULL REFERENCES distribution_transactions(id) ON DELETE CASCADE,
    inventory_batch_id UUID NOT NULL REFERENCES inventory_batches(id) ON DELETE RESTRICT,
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    quantity_released INTEGER NOT NULL CHECK (quantity_released > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 6) DONATION / PUBLIC INFO TABLES
-- =========================================================

CREATE TABLE donation_needs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disaster_event_id UUID NOT NULL REFERENCES disaster_events(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    quantity_needed INTEGER NOT NULL CHECK (quantity_needed >= 0),
    priority_level VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    published_by UUID REFERENCES users(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_donation_priority
        CHECK (priority_level IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    CONSTRAINT uq_donation_need UNIQUE (disaster_event_id, inventory_item_id)
);

-- =========================================================
-- 7) NOTIFICATIONS TABLES
-- =========================================================

CREATE TABLE notification_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    trigger_type VARCHAR(100) NOT NULL,
    target_role_code VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disaster_event_id UUID REFERENCES disaster_events(id) ON DELETE SET NULL,
    type VARCHAR(30) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
    reference_type VARCHAR(100),
    reference_id UUID,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_notification_type
        CHECK (type IN ('EVENT', 'INVENTORY', 'EXPIRY', 'SYNC', 'ANOMALY', 'SYSTEM')),
    CONSTRAINT chk_notification_severity
        CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL'))
);

CREATE TABLE notification_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_notification_recipient UNIQUE (notification_id, user_id)
);

-- =========================================================
-- 8) OFFLINE SYNC TABLES
-- =========================================================

CREATE TABLE sync_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    entity_type VARCHAR(100) NOT NULL,
    entity_local_id VARCHAR(255),
    entity_server_id UUID,
    operation_type VARCHAR(30) NOT NULL,
    payload_json JSONB NOT NULL,

    client_timestamp TIMESTAMPTZ NOT NULL,
    server_timestamp TIMESTAMPTZ,
    sync_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    error_message TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_sync_operation_type
        CHECK (operation_type IN ('CREATE', 'UPDATE', 'DELETE', 'CLAIM', 'TIME_IN', 'TIME_OUT')),
    CONSTRAINT chk_sync_status
        CHECK (sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'FAILED'))
);

CREATE TABLE sync_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_transaction_id UUID NOT NULL REFERENCES sync_transactions(id) ON DELETE CASCADE,
    entity_type VARCHAR(100) NOT NULL,
    entity_server_id UUID,
    conflict_type VARCHAR(100) NOT NULL,

    local_payload_json JSONB NOT NULL,
    server_payload_json JSONB NOT NULL,
    resolution_strategy VARCHAR(30) NOT NULL,
    resolved_payload_json JSONB,

    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_sync_resolution_strategy
        CHECK (resolution_strategy IN ('LATEST_TIMESTAMP', 'MANUAL_REVIEW', 'MERGED')),
    CONSTRAINT chk_sync_conflict_status
        CHECK (status IN ('OPEN', 'RESOLVED'))
);

-- =========================================================
-- 9) AUDIT / ERROR LOGS
-- =========================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    role_code VARCHAR(50),
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,

    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values_json JSONB,
    new_values_json JSONB,
    ip_address INET,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    module_name VARCHAR(100) NOT NULL,
    error_code VARCHAR(100),
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    severity VARCHAR(20) NOT NULL DEFAULT 'ERROR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_error_severity
        CHECK (severity IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL'))
);

-- =========================================================
-- 10) FORECASTING TABLES
-- =========================================================

CREATE TABLE forecast_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disaster_event_id UUID NOT NULL REFERENCES disaster_events(id) ON DELETE CASCADE,
    run_type VARCHAR(30) NOT NULL,
    run_by UUID REFERENCES users(id) ON DELETE SET NULL,
    run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    model_name VARCHAR(100) NOT NULL,
    parameters_json JSONB,
    CONSTRAINT chk_forecast_run_type
        CHECK (run_type IN ('INVENTORY_DEMAND', 'STOCK_DEPLETION', 'REPLENISHMENT'))
);

CREATE TABLE forecast_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    forecast_run_id UUID NOT NULL REFERENCES forecast_runs(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    predicted_quantity_needed NUMERIC(12,2),
    predicted_depletion_date DATE,
    recommended_reorder_quantity NUMERIC(12,2),
    confidence_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 11) INDEXES
-- =========================================================

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_households_disaster_event_id ON households(disaster_event_id);
CREATE INDEX idx_households_barangay_id ON households(barangay_id);
CREATE INDEX idx_evacuees_household_id ON evacuees(household_id);
CREATE INDEX idx_household_sectors_household_id ON household_sectors(household_id);
CREATE INDEX idx_stubs_disaster_event_id ON stubs(disaster_event_id);
CREATE INDEX idx_stubs_household_id ON stubs(household_id);
CREATE INDEX idx_evacuation_logs_disaster_event_id ON evacuation_logs(disaster_event_id);
CREATE INDEX idx_evacuation_logs_evacuee_id ON evacuation_logs(evacuee_id);
CREATE INDEX idx_inventory_batches_inventory_item_id ON inventory_batches(inventory_item_id);
CREATE INDEX idx_inventory_transactions_batch_id ON inventory_transactions(inventory_batch_id);
CREATE INDEX idx_distribution_transactions_disaster_event_id ON distribution_transactions(disaster_event_id);
CREATE INDEX idx_distribution_transactions_household_id ON distribution_transactions(household_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_sync_transactions_status ON sync_transactions(sync_status);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_forecast_results_run_id ON forecast_results(forecast_run_id);
