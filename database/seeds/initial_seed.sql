-- =========================================================
-- DISTYNC INITIAL SEED DATA
-- File: database/seeds/initial_seed.sql
-- =========================================================

-- =========================================================
-- 1) ROLES
-- =========================================================

INSERT INTO roles (code, name, description) VALUES
('MSWDO', 'Municipal Social Welfare and Development Office', 'Full access to evacuee information, monitoring, distribution, reporting, and dashboards')
ON CONFLICT (code) DO NOTHING;

INSERT INTO roles (code, name, description) VALUES
('MAYOR', 'Office of the Mayor', 'Full access to inventory management, distribution logs, analytics, and reporting')
ON CONFLICT (code) DO NOTHING;

INSERT INTO roles (code, name, description) VALUES
('BARANGAY', 'Barangay Official', 'Access to encode evacuee information, distribution, and assigned barangay monitoring')
ON CONFLICT (code) DO NOTHING;

INSERT INTO roles (code, name, description) VALUES
('DONOR', 'Donor / NGO', 'View-only access to donation information and public distribution schedules')
ON CONFLICT (code) DO NOTHING;

-- =========================================================
-- 2) PERMISSIONS
-- =========================================================

INSERT INTO permissions (code, name, description) VALUES
('CREATE_DISASTER_EVENT', 'Create disaster event', 'Allows creation of disaster events')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description) VALUES
('VIEW_DISASTER_EVENT', 'View disaster events', 'Allows viewing of disaster events')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description) VALUES
('GENERATE_DISASTER_REPORT', 'Generate disaster event report', 'Allows generation of disaster summary reports')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description) VALUES
('ENCODE_EVACUEE', 'Encode evacuee information', 'Allows encoding of evacuee and household records')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description) VALUES
('VIEW_EVACUEE', 'View evacuee information', 'Allows viewing of evacuee and household records')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description) VALUES
('MONITOR_EVACUEE', 'Monitor evacuees', 'Allows time-in and time-out evacuee monitoring')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description) VALUES
('GENERATE_MASTERLIST', 'Generate evacuee masterlist', 'Allows masterlist and summary report generation')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description) VALUES
('ASSIGN_STUB', 'Assign stub', 'Allows issuing and assigning stub numbers')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description) VALUES
('VERIFY_STUB', 'Verify stub', 'Allows stub verification during relief distribution')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description) VALUES
('MANAGE_DISTRIBUTION', 'Manage relief distribution', 'Allows recording and viewing of relief distributions')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description) VALUES
('GENERATE_DISTRIBUTION_REPORT', 'Generate distribution report', 'Allows distribution report generation')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description) VALUES
('VIEW_INVENTORY', 'View inventory', 'Allows viewing of inventory levels and stock data')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description) VALUES
('MANAGE_INVENTORY', 'Manage inventory', 'Allows encoding inventory inflow, updates, and stock status')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description) VALUES
('SCAN_BARCODE', 'Scan barcode', 'Allows barcode-based inventory intake')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description) VALUES
('CUSTOMIZE_RELIEF_PACK', 'Customize relief packs', 'Allows creation and modification of relief pack templates')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description) VALUES
('GENERATE_INVENTORY_REPORT', 'Generate inventory report', 'Allows inventory report generation')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description) VALUES
('VIEW_DESCRIPTIVE_ANALYTICS', 'View descriptive analytics', 'Allows viewing descriptive dashboards and summaries')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description) VALUES
('VIEW_FORECASTING_ANALYTICS', 'View forecasting analytics', 'Allows viewing forecasting dashboards and estimates')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description) VALUES
('VIEW_DONATION_INFO', 'View donation information', 'Allows viewing public donation needs and schedules')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description) VALUES
('VIEW_NOTIFICATIONS', 'View notifications', 'Allows viewing role-based notifications')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description) VALUES
('MANAGE_SYNC', 'Manage sync operations', 'Allows monitoring sync transactions and conflict resolution')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description) VALUES
('VIEW_AUDIT_LOGS', 'View audit logs', 'Allows viewing audit records')
ON CONFLICT (code) DO NOTHING;

-- =========================================================
-- 3) ROLE-PERMISSION MAPPINGS
-- =========================================================

-- MSWDO
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'CREATE_DISASTER_EVENT',
    'VIEW_DISASTER_EVENT',
    'GENERATE_DISASTER_REPORT',
    'ENCODE_EVACUEE',
    'VIEW_EVACUEE',
    'MONITOR_EVACUEE',
    'GENERATE_MASTERLIST',
    'ASSIGN_STUB',
    'VERIFY_STUB',
    'MANAGE_DISTRIBUTION',
    'GENERATE_DISTRIBUTION_REPORT',
    'VIEW_DESCRIPTIVE_ANALYTICS',
    'VIEW_NOTIFICATIONS'
)
WHERE r.code = 'MSWDO'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- MAYOR
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'VIEW_DISASTER_EVENT',
    'MANAGE_DISTRIBUTION',
    'VIEW_INVENTORY',
    'MANAGE_INVENTORY',
    'SCAN_BARCODE',
    'CUSTOMIZE_RELIEF_PACK',
    'GENERATE_INVENTORY_REPORT',
    'VIEW_FORECASTING_ANALYTICS',
    'VIEW_NOTIFICATIONS'
)
WHERE r.code = 'MAYOR'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- BARANGAY
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'VIEW_DISASTER_EVENT',
    'ENCODE_EVACUEE',
    'VIEW_EVACUEE',
    'MONITOR_EVACUEE',
    'ASSIGN_STUB',
    'VERIFY_STUB',
    'MANAGE_DISTRIBUTION',
    'VIEW_DESCRIPTIVE_ANALYTICS',
    'VIEW_NOTIFICATIONS'
)
WHERE r.code = 'BARANGAY'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- DONOR
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'VIEW_DONATION_INFO'
)
WHERE r.code = 'DONOR'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =========================================================
-- 4) MALVAR BARANGAYS
-- =========================================================

INSERT INTO barangays (code, name) VALUES ('BAGONG_POOK', 'Bagong Pook')
ON CONFLICT (code) DO NOTHING;

INSERT INTO barangays (code, name) VALUES ('BILUCAO', 'Bilucao')
ON CONFLICT (code) DO NOTHING;

INSERT INTO barangays (code, name) VALUES ('BULIHAN', 'Bulihan')
ON CONFLICT (code) DO NOTHING;

INSERT INTO barangays (code, name) VALUES ('LUTA_DEL_NORTE', 'Luta del Norte')
ON CONFLICT (code) DO NOTHING;

INSERT INTO barangays (code, name) VALUES ('LUTA_DEL_SUR', 'Luta del Sur')
ON CONFLICT (code) DO NOTHING;

INSERT INTO barangays (code, name) VALUES ('POBLACION', 'Poblacion')
ON CONFLICT (code) DO NOTHING;

INSERT INTO barangays (code, name) VALUES ('SAN_ANDRES', 'San Andres')
ON CONFLICT (code) DO NOTHING;

INSERT INTO barangays (code, name) VALUES ('SAN_FERNANDO', 'San Fernando')
ON CONFLICT (code) DO NOTHING;

INSERT INTO barangays (code, name) VALUES ('SAN_GREGORIO', 'San Gregorio')
ON CONFLICT (code) DO NOTHING;

INSERT INTO barangays (code, name) VALUES ('SAN_ISIDRO_EAST', 'San Isidro East')
ON CONFLICT (code) DO NOTHING;

INSERT INTO barangays (code, name) VALUES ('SAN_JUAN', 'San Juan')
ON CONFLICT (code) DO NOTHING;

INSERT INTO barangays (code, name) VALUES ('SAN_PEDRO_I', 'San Pedro I')
ON CONFLICT (code) DO NOTHING;

INSERT INTO barangays (code, name) VALUES ('SAN_PEDRO_II', 'San Pedro II')
ON CONFLICT (code) DO NOTHING;

INSERT INTO barangays (code, name) VALUES ('SAN_PIOQUINTO', 'San Pioquinto')
ON CONFLICT (code) DO NOTHING;

INSERT INTO barangays (code, name) VALUES ('SANTIAGO', 'Santiago')
ON CONFLICT (code) DO NOTHING;

-- =========================================================
-- 5) SECTORS (DROMIC-ALIGNED MASTER LIST)
-- =========================================================

-- =========================
-- AGE GROUPS
-- =========================

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('INFANT', 'Infant', 'Infants aged 0 to 6 months', 'AGE_GROUP', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('TODDLER', 'Toddler', 'Children aged 7 months to 2 years', 'AGE_GROUP', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('PRE_SCHOOLER', 'Pre-Schooler', 'Children aged 3 to 5 years', 'AGE_GROUP', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('SCHOOL_AGE', 'School Age', 'Children aged 6 to 12 years', 'AGE_GROUP', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('TEENAGE', 'Teenage', 'Individuals aged 13 to 17 years', 'AGE_GROUP', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('ADULT', 'Adult', 'Individuals aged 18 to 59 years', 'AGE_GROUP', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('SENIOR_CITIZEN', 'Senior Citizen', 'Individuals aged 60 and above', 'AGE_GROUP', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

-- =========================
-- VULNERABLE GROUPS
-- =========================

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('PREGNANT', 'Pregnant Women', 'Pregnant evacuees', 'VULNERABLE', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('LACTATING_MOTHER', 'Lactating Mother', 'Lactating evacuees', 'VULNERABLE', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('PWD', 'Persons with Disabilities', 'Evacuees with disabilities', 'VULNERABLE', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('INDIGENOUS', 'Indigenous', 'Indigenous peoples and communities', 'VULNERABLE', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('FOUR_PS', '4Ps Beneficiaries', 'Pantawid Pamilyang Pilipino Program beneficiaries', 'VULNERABLE', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

-- =========================
-- HOUSEHOLD CONDITIONS
-- =========================

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('CHILD_HEADED', 'Child-Headed Family', 'Households headed by minors', 'HOUSEHOLD', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('SINGLE_HEADED', 'Single-Headed Family', 'Households with a single parent or guardian', 'HOUSEHOLD', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('SOLO_PARENT', 'Solo Parent Household', 'Households identified as solo parent households', 'HOUSEHOLD', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;


-- =========================================================
-- 6) EVACUATION CENTERS
-- =========================================================


INSERT INTO evacuation_centers (barangay_id, name, individual_capacity)
SELECT b.id, 'San Isidro Barangay Hall', 160
FROM barangays b WHERE b.code = 'SAN_ISIDRO_EAST'
ON CONFLICT (barangay_id, name) DO NOTHING;

INSERT INTO evacuation_centers (barangay_id, name, individual_capacity)
SELECT b.id, 'Malvar Cultural Center', 2400
FROM barangays b WHERE b.code = 'POBLACION'
ON CONFLICT (barangay_id, name) DO NOTHING;

INSERT INTO evacuation_centers (barangay_id, name, individual_capacity)
SELECT b.id, 'San Gregorio Evacuation Center', 40
FROM barangays b WHERE b.code = 'SAN_GREGORIO'
ON CONFLICT (barangay_id, name) DO NOTHING;

INSERT INTO evacuation_centers (barangay_id, name, individual_capacity)
SELECT b.id, 'Luta Sur Covered Court', 400
FROM barangays b WHERE b.code = 'LUTA_DEL_SUR'
ON CONFLICT (barangay_id, name) DO NOTHING;

INSERT INTO evacuation_centers (barangay_id, name, individual_capacity)
SELECT b.id, 'Bulihan Evacuation Center', 20
FROM barangays b WHERE b.code = 'BULIHAN'
ON CONFLICT (barangay_id, name) DO NOTHING;

INSERT INTO evacuation_centers (barangay_id, name, individual_capacity)
SELECT b.id, 'Santiago Evacuation Center', 48
FROM barangays b WHERE b.code = 'SANTIAGO'
ON CONFLICT (barangay_id, name) DO NOTHING;

INSERT INTO evacuation_centers (barangay_id, name, individual_capacity)
SELECT b.id, 'San Fernando Covered Court', 60
FROM barangays b WHERE b.code = 'SAN_FERNANDO'
ON CONFLICT (barangay_id, name) DO NOTHING;

INSERT INTO evacuation_centers (barangay_id, name, individual_capacity)
SELECT b.id, 'San Pedro II Elementary School', 72
FROM barangays b WHERE b.code = 'SAN_PEDRO_II'
ON CONFLICT (barangay_id, name) DO NOTHING;

INSERT INTO evacuation_centers (barangay_id, name, individual_capacity)
SELECT b.id, 'Luta Del Norte Evacuation Center', 56
FROM barangays b WHERE b.code = 'LUTA_DEL_NORTE'
ON CONFLICT (barangay_id, name) DO NOTHING;

INSERT INTO evacuation_centers (barangay_id, name, individual_capacity)
SELECT b.id, 'San Juan Covered Court', 120
FROM barangays b WHERE b.code = 'SAN_JUAN'
ON CONFLICT (barangay_id, name) DO NOTHING;

INSERT INTO evacuation_centers (barangay_id, name, individual_capacity)
SELECT b.id, 'San Pioquinto Covered Court', 100
FROM barangays b WHERE b.code = 'SAN_PIOQUINTO'
ON CONFLICT (barangay_id, name) DO NOTHING;

INSERT INTO evacuation_centers (barangay_id, name, individual_capacity)
SELECT b.id, 'Bagong Pook New Barangay Hall', 160
FROM barangays b WHERE b.code = 'BAGONG_POOK'
ON CONFLICT (barangay_id, name) DO NOTHING;

INSERT INTO evacuation_centers (barangay_id, name, individual_capacity)
SELECT b.id, 'Bagong Pook Old Barangay Hall', 40
FROM barangays b WHERE b.code = 'BAGONG_POOK'
ON CONFLICT (barangay_id, name) DO NOTHING;

INSERT INTO evacuation_centers (barangay_id, name, individual_capacity)
SELECT b.id, 'San Pedro I Barangay Hall 3rd Floor', 40
FROM barangays b WHERE b.code = 'SAN_PEDRO_I'
ON CONFLICT (barangay_id, name) DO NOTHING;

INSERT INTO evacuation_centers (barangay_id, name, individual_capacity)
SELECT b.id, 'San Andres Evacuation Center', 80
FROM barangays b WHERE b.code = 'SAN_ANDRES'
ON CONFLICT (barangay_id, name) DO NOTHING;

-- =========================================================
-- 7) NOTIFICATION RULES
-- =========================================================

INSERT INTO notification_rules (code, name, trigger_type, target_role_code, is_active)
VALUES
  ('LOW_STOCK', 'Low Stock Alert', 'INVENTORY_STOCK_THRESHOLD', 'MAYOR', TRUE),
  ('CRITICAL_STOCK', 'Critical Stock Alert', 'INVENTORY_STOCK_THRESHOLD', 'MAYOR', TRUE),
  ('NEAR_EXPIRY_STOCK', 'Near Expiry Stock Alert', 'INVENTORY_EXPIRY', 'MAYOR', TRUE),
  ('EXPIRED_STOCK', 'Expired Stock Alert', 'INVENTORY_EXPIRY', 'MAYOR', TRUE),
  ('INVENTORY_INCIDENT', 'Inventory Incident Alert', 'INVENTORY_INCIDENT', 'MAYOR', TRUE),
  ('DONATION_STOCK_UPDATE', 'Donation Stock Update', 'DONATION_UPDATE', 'MAYOR', TRUE),
  ('DONATION_STOCK_ANOMALY', 'Donation Stock Anomaly', 'DONATION_ANOMALY', 'MAYOR', TRUE),
  ('DISASTER_EVENT_CREATED', 'Newly Created Disaster Event', 'DISASTER_EVENT_CREATED', 'MSWDO', TRUE),
  ('DISASTER_EVENT_UPDATE', 'Disaster Event Update', 'DISASTER_EVENT', 'MSWDO', TRUE),
  ('DISTRIBUTION_UPDATE', 'Distribution Update', 'DISTRIBUTION_UPDATE', 'MSWDO', TRUE),
  ('HOUSEHOLD_REGISTERED', 'Household Registration Update', 'HOUSEHOLD_REGISTRATION', 'BARANGAY', TRUE),
  ('HOUSEHOLD_VERIFICATION', 'Household Verification Update', 'HOUSEHOLD_VERIFICATION', 'BARANGAY', TRUE),
  ('EVACUEE_ATTENDANCE_UPDATE', 'Evacuee Attendance Update', 'EVACUEE_ATTENDANCE_UPDATE', 'BARANGAY', TRUE),
  ('SYNC_CONFLICT', 'Sync Conflict Alert', 'SYNC_CONFLICT', 'BARANGAY', TRUE),
  ('SYSTEM_ANOMALY', 'System Anomaly Alert', 'SYSTEM_ANOMALY', 'BARANGAY', TRUE),
  ('EVACUATION_SUMMARY_REPORT', 'Evacuation Monitoring Summary', 'EVACUATION_SUMMARY', 'MAYOR', TRUE)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  trigger_type = EXCLUDED.trigger_type,
  target_role_code = EXCLUDED.target_role_code,
  is_active = EXCLUDED.is_active;
