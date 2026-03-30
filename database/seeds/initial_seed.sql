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
('INFANT_0_6_MONTHS', 'Infant (0-6 months)', 'Infants aged 0 to 6 months', 'AGE_GROUP', FALSE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('TODDLER_7M_2Y', 'Toddlers (7 months - 2 years)', 'Toddlers aged 7 months to 2 years', 'AGE_GROUP', FALSE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('PRESCHOOL_3_5', 'Preschoolers (3-5 years)', 'Children aged 3 to 5 years', 'AGE_GROUP', FALSE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('CHILD_6_12', 'Children (6-12 years)', 'Children aged 6 to 12 years', 'AGE_GROUP', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('TEEN_13_17', 'Teenagers (13-17 years)', 'Individuals aged 13 to 17 years', 'AGE_GROUP', FALSE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('ADULT_18_59', 'Adults (18-59 years)', 'Individuals aged 18 to 59 years', 'AGE_GROUP', FALSE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('SENIOR_60_ABOVE', 'Senior Citizens (60+)', 'Individuals aged 60 and above', 'AGE_GROUP', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

-- =========================
-- VULNERABLE GROUPS
-- =========================

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('PREGNANT', 'Pregnant Women', 'Pregnant evacuees', 'VULNERABLE', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('LACTATING', 'Lactating Mothers', 'Lactating evacuees', 'VULNERABLE', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('PWD', 'Persons with Disabilities', 'Evacuees with disabilities', 'VULNERABLE', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('SOLO_PARENT', 'Solo Parents', 'Evacuees identified as solo parents', 'VULNERABLE', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('INDIGENOUS', 'Indigenous People', 'Members of indigenous communities', 'VULNERABLE', FALSE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('FOUR_PS', '4Ps Beneficiaries', 'Pantawid Pamilyang Pilipino Program beneficiaries', 'VULNERABLE', FALSE, TRUE)
ON CONFLICT (code) DO NOTHING;

-- =========================
-- HOUSEHOLD CONDITIONS
-- =========================

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('CHILD_HEADED', 'Child-Headed Family', 'Households headed by minors', 'HOUSEHOLD', FALSE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sectors (code, name, description, sector_group, is_barangay_visible, is_mswdo_visible) VALUES
('SINGLE_HEADED', 'Single-Headed Family', 'Households with a single parent or guardian', 'HOUSEHOLD', FALSE, TRUE)
ON CONFLICT (code) DO NOTHING;