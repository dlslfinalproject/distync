const pool = require("../config/db");

const getDisasterEventById = async (id) => {
  const query = `
    SELECT
      id,
      event_code,
      title,
      status
    FROM disaster_events
    WHERE id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

const getBarangayById = async (id) => {
  const query = `
    SELECT
      id,
      code,
      name,
      municipality_name,
      province_name,
      is_active
    FROM barangays
    WHERE id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

const getUserBarangayScopeById = async (userId) => {
  const query = `
    SELECT
      u.id,
      u.default_barangay_id,
      r.code AS role_code
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE u.id = $1
    ORDER BY ur.assigned_at ASC NULLS LAST
    LIMIT 1
  `;

  const result = await pool.query(query, [userId]);
  return result.rows[0] || null;
};

const getEvacuationCenterById = async (id) => {
  const query = `
    SELECT
      ec.id,
      ec.barangay_id,
      ec.name,
      ec.individual_capacity,
      ec.is_active,
      b.code AS barangay_code,
      b.name AS barangay_name
    FROM evacuation_centers ec
    INNER JOIN barangays b ON b.id = ec.barangay_id
    WHERE ec.id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

const getActiveEvacuationCentersByBarangayId = async (barangayId) => {
  const query = `
    SELECT
      ec.id,
      ec.barangay_id,
      ec.name,
      ec.individual_capacity,
      ec.is_active
    FROM evacuation_centers ec
    WHERE ec.barangay_id = $1
      AND ec.is_active = TRUE
    ORDER BY ec.name ASC, ec.created_at ASC
  `;

  const result = await pool.query(query, [barangayId]);
  return result.rows;
};

const getDisasterEventBarangayLink = async (disasterEventId, barangayId) => {
  const query = `
    SELECT
      disaster_event_id,
      barangay_id
    FROM disaster_event_barangays
    WHERE disaster_event_id = $1
      AND barangay_id = $2
    LIMIT 1
  `;

  const result = await pool.query(query, [disasterEventId, barangayId]);
  return result.rows[0] || null;
};

const getSectorsByIds = async (sectorIds) => {
  if (sectorIds.length === 0) {
    return [];
  }

  const query = `
    SELECT
      id,
      code,
      name,
      description,
      sector_group,
      is_barangay_visible,
      is_mswdo_visible,
      created_at
    FROM sectors
    WHERE id = ANY($1::uuid[])
    ORDER BY sector_group ASC, name ASC
  `;

  const result = await pool.query(query, [sectorIds]);
  return result.rows;
};

const getSectorsByCodes = async (sectorCodes) => {
  if (sectorCodes.length === 0) {
    return [];
  }

  const query = `
    SELECT
      id,
      code,
      name,
      description,
      sector_group,
      is_barangay_visible,
      is_mswdo_visible,
      created_at
    FROM sectors
    WHERE code = ANY($1::text[])
    ORDER BY sector_group ASC, name ASC
  `;

  const result = await pool.query(query, [sectorCodes]);
  return result.rows;
};

const getAgeGroupSectors = async () => {
  const query = `
    SELECT
      id,
      code,
      name,
      description,
      sector_group,
      is_barangay_visible,
      is_mswdo_visible,
      created_at
    FROM sectors
    WHERE sector_group = $1
    ORDER BY name ASC, code ASC
  `;

  const result = await pool.query(query, ["AGE_GROUP"]);
  return result.rows;
};

const generateStubNumbers = async (dbClient) => {
  const currentYear = new Date().getFullYear();
  const stubPrefix = `STUB-${currentYear}-`;
  const serialPrefix = `SER-${currentYear}-`;
  const advisoryLockNamespace = 4107;

  await dbClient.query(
    "SELECT pg_advisory_xact_lock($1, $2)",
    [advisoryLockNamespace, currentYear],
  );

  const sequenceQuery = `
    SELECT
      COALESCE(
        MAX(CAST(SUBSTRING(stub_no FROM '^STUB-\\d{4}-(\\d{6})$') AS INTEGER)),
        0
      ) + 1 AS next_sequence
    FROM stubs
    WHERE stub_no LIKE $1
  `;

  const sequenceResult = await dbClient.query(sequenceQuery, [`${stubPrefix}%`]);
  const nextSequence = Number(sequenceResult.rows[0]?.next_sequence || 1);
  const paddedSequence = String(nextSequence).padStart(6, "0");

  return {
    stub_no: `${stubPrefix}${paddedSequence}`,
    serial_no: `${serialPrefix}${paddedSequence}`,
  };
};

const insertHousehold = async (householdData, dbClient) => {
  const query = `
    INSERT INTO households (
      disaster_event_id,
      barangay_id,
      evacuation_center_id,
      residency_status,
      family_head_first_name,
      family_head_middle_name,
      family_head_last_name,
      family_head_suffix,
      sex,
      birth_date,
      contact_number,
      current_stay_type,
      current_address_details,
      household_size,
      is_active,
      registered_by,
      family_head_photo_url,
      photo_captured_at,
      photo_captured_by,
      photo_verification_notes,
      registered_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
      COALESCE($21::timestamptz, NOW()), NOW()
    )
    RETURNING
      id,
      disaster_event_id,
      barangay_id,
      evacuation_center_id,
      residency_status,
      family_head_first_name,
      family_head_middle_name,
      family_head_last_name,
      family_head_suffix,
      sex,
      birth_date,
      contact_number,
      current_stay_type,
      current_address_details,
      household_size,
      is_active,
      registered_by,
      family_head_photo_url,
      photo_captured_at,
      photo_captured_by,
      photo_verification_notes,
      registered_at,
      updated_at,
      family_head_evacuee_id
  `;

  const values = [
    householdData.disaster_event_id,
    householdData.barangay_id,
    householdData.evacuation_center_id,
    householdData.residency_status,
    householdData.family_head.first_name,
    householdData.family_head.middle_name,
    householdData.family_head.last_name,
    householdData.family_head.suffix,
    householdData.family_head.sex,
    householdData.family_head.birth_date ?? null,
    householdData.contact_number ?? householdData.family_head.contact_number ?? null,
    householdData.current_stay_type,
    householdData.current_address_details,
    householdData.household_size,
    true,
    householdData.registered_by,
    householdData.family_head_photo_url || null,
    householdData.photo_captured_at || null,
    householdData.photo_captured_by || null,
    householdData.photo_verification_notes || null,
    householdData.registered_at || null,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0];
};

const insertHouseholdPrivacyConsent = async (consentData, dbClient) => {
  const query = `
    INSERT INTO household_privacy_consents (
      household_id,
      disaster_event_id,
      consent_status,
      notice_version,
      acknowledged_at,
      acknowledged_by_name,
      representative_relationship,
      recorded_by,
      recorded_at,
      device_id,
      is_offline_encoded,
      sync_status,
      created_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      NOW(), $9, $10, $11, NOW(), NOW()
    )
    RETURNING
      id,
      household_id,
      disaster_event_id,
      consent_status,
      notice_version,
      acknowledged_at,
      acknowledged_by_name,
      representative_relationship,
      recorded_by,
      recorded_at,
      device_id,
      is_offline_encoded,
      sync_status,
      created_at,
      updated_at
  `;

  const values = [
    consentData.household_id,
    consentData.disaster_event_id,
    consentData.consent_status,
    consentData.notice_version,
    consentData.acknowledged_at,
    consentData.acknowledged_by_name,
    consentData.representative_relationship || null,
    consentData.recorded_by,
    consentData.device_id || null,
    consentData.is_offline_encoded === true,
    consentData.sync_status,
  ];

  try {
    const result = await dbClient.query(query, values);
    return result.rows[0] || null;
  } catch (error) {
    if (error?.code !== "23505") {
      throw error;
    }

    const existingConsent =
      await getLatestHouseholdPrivacyConsentByHouseholdId(
        consentData.household_id,
        dbClient,
      );

    if (
      existingConsent &&
      existingConsent.notice_version === consentData.notice_version &&
      existingConsent.consent_status === consentData.consent_status
    ) {
      return existingConsent;
    }

    throw error;
  }
};

const findDuplicateHouseholdRegistration = async (
  { disasterEventId, barangayId, familyHead },
  dbClient = pool,
) => {
  const query = `
    SELECT
      id,
      disaster_event_id,
      barangay_id,
      family_head_first_name,
      family_head_middle_name,
      family_head_last_name,
      family_head_suffix,
      registered_at,
      updated_at
    FROM households
    WHERE disaster_event_id = $1
      AND barangay_id = $2
      AND LOWER(REGEXP_REPLACE(BTRIM(COALESCE(family_head_first_name, '')), '\\s+', ' ', 'g')) =
          LOWER(REGEXP_REPLACE(BTRIM(COALESCE($3, '')), '\\s+', ' ', 'g'))
      AND LOWER(REGEXP_REPLACE(BTRIM(COALESCE(family_head_middle_name, '')), '\\s+', ' ', 'g')) =
          LOWER(REGEXP_REPLACE(BTRIM(COALESCE($4, '')), '\\s+', ' ', 'g'))
      AND LOWER(REGEXP_REPLACE(BTRIM(COALESCE(family_head_last_name, '')), '\\s+', ' ', 'g')) =
          LOWER(REGEXP_REPLACE(BTRIM(COALESCE($5, '')), '\\s+', ' ', 'g'))
      AND LOWER(REGEXP_REPLACE(BTRIM(COALESCE(family_head_suffix, '')), '\\s+', ' ', 'g')) =
          LOWER(REGEXP_REPLACE(BTRIM(COALESCE($6, '')), '\\s+', ' ', 'g'))
    ORDER BY registered_at ASC, id ASC
    LIMIT 1
  `;

  const result = await dbClient.query(query, [
    disasterEventId,
    barangayId,
    familyHead.first_name || null,
    familyHead.middle_name || null,
    familyHead.last_name || null,
    familyHead.suffix || null,
  ]);
  return result.rows[0] || null;
};

const findPotentialDuplicatePersonMatches = async (
  { disasterEventId, householdIdToExclude = null, people = [] },
  dbClient = pool,
) => {
  if (!disasterEventId || !Array.isArray(people) || people.length === 0) {
    return [];
  }

  const normalizedPeople = people
    .filter(
      (person) =>
        person &&
        String(person.first_name || "").trim() &&
        String(person.last_name || "").trim(),
    )
    .map((person) => ({
      person_key: String(person.person_key || "").trim(),
      source_role: String(person.source_role || "MEMBER").trim().toUpperCase(),
      first_name: String(person.first_name || "").trim(),
      middle_name: String(person.middle_name || "").trim(),
      last_name: String(person.last_name || "").trim(),
      suffix: String(person.suffix || "").trim(),
      sex: person.sex || null,
      age_value: Number.isInteger(person.age_value) ? person.age_value : null,
      age_unit: person.age_unit || null,
      relationship_to_head: person.relationship_to_head || null,
      contact_number: person.contact_number || null,
    }))
    .filter((person) => person.person_key);

  if (normalizedPeople.length === 0) {
    return [];
  }

  const valuePlaceholders = [];
  const values = [];

  normalizedPeople.forEach((person, index) => {
    const baseOffset = index * 10;
    valuePlaceholders.push(
      `($${baseOffset + 1}::text, $${baseOffset + 2}::text, $${baseOffset + 3}::text, $${baseOffset + 4}::text, $${baseOffset + 5}::text, $${baseOffset + 6}::text, $${baseOffset + 7}::text, $${baseOffset + 8}::integer, $${baseOffset + 9}::text, $${baseOffset + 10}::text)`,
    );
    values.push(
      person.person_key,
      person.source_role,
      person.first_name,
      person.middle_name || null,
      person.last_name,
      person.suffix || null,
      person.sex,
      person.age_value,
      person.age_unit,
      person.contact_number || null,
    );
  });

  const disasterEventParamIndex = values.length + 1;
  const householdExcludeParamIndex = values.length + 2;

  values.push(disasterEventId, householdIdToExclude);

  const query = `
    WITH input_people (
      person_key,
      source_role,
      first_name,
      middle_name,
      last_name,
      suffix,
      sex,
      age_value,
      age_unit,
      contact_number
    ) AS (
      VALUES
        ${valuePlaceholders.join(",\n        ")}
    ),
    family_head_matches AS (
      SELECT
        ip.person_key,
        ip.source_role,
        'FAMILY_HEAD'::text AS matched_role,
        h.id AS household_id,
        h.barangay_id,
        b.name AS barangay_name,
        h.family_head_first_name AS household_family_head_first_name,
        h.family_head_middle_name AS household_family_head_middle_name,
        h.family_head_last_name AS household_family_head_last_name,
        h.family_head_suffix AS household_family_head_suffix,
        h.family_head_first_name AS matched_first_name,
        h.family_head_middle_name AS matched_middle_name,
        h.family_head_last_name AS matched_last_name,
        h.family_head_suffix AS matched_suffix,
        h.sex AS matched_sex,
        fh.age_value AS matched_age_value,
        fh.age_unit AS matched_age_unit,
        NULL::text AS matched_relationship_to_head,
        h.contact_number AS matched_contact_number,
        h.is_active,
        h.registered_at,
        h.current_stay_type,
        h.household_size
      FROM input_people ip
      INNER JOIN households h
        ON h.disaster_event_id = $${disasterEventParamIndex}
      INNER JOIN barangays b ON b.id = h.barangay_id
      LEFT JOIN evacuees fh ON fh.id = h.family_head_evacuee_id
      WHERE ($${householdExcludeParamIndex}::uuid IS NULL OR h.id <> $${householdExcludeParamIndex}::uuid)
        AND LOWER(REGEXP_REPLACE(BTRIM(COALESCE(h.family_head_first_name, '')), '\\s+', ' ', 'g')) =
            LOWER(REGEXP_REPLACE(BTRIM(COALESCE(ip.first_name, '')), '\\s+', ' ', 'g'))
        AND LOWER(REGEXP_REPLACE(BTRIM(COALESCE(h.family_head_last_name, '')), '\\s+', ' ', 'g')) =
            LOWER(REGEXP_REPLACE(BTRIM(COALESCE(ip.last_name, '')), '\\s+', ' ', 'g'))
    ),
    member_matches AS (
      SELECT
        ip.person_key,
        ip.source_role,
        'MEMBER'::text AS matched_role,
        h.id AS household_id,
        h.barangay_id,
        b.name AS barangay_name,
        h.family_head_first_name AS household_family_head_first_name,
        h.family_head_middle_name AS household_family_head_middle_name,
        h.family_head_last_name AS household_family_head_last_name,
        h.family_head_suffix AS household_family_head_suffix,
        e.first_name AS matched_first_name,
        e.middle_name AS matched_middle_name,
        e.last_name AS matched_last_name,
        e.suffix AS matched_suffix,
        e.sex AS matched_sex,
        e.age_value AS matched_age_value,
        e.age_unit AS matched_age_unit,
        e.relationship_to_head AS matched_relationship_to_head,
        h.contact_number AS matched_contact_number,
        h.is_active,
        h.registered_at,
        h.current_stay_type,
        h.household_size
      FROM input_people ip
      INNER JOIN evacuees e
        ON LOWER(REGEXP_REPLACE(BTRIM(COALESCE(e.first_name, '')), '\\s+', ' ', 'g')) =
            LOWER(REGEXP_REPLACE(BTRIM(COALESCE(ip.first_name, '')), '\\s+', ' ', 'g'))
        AND LOWER(REGEXP_REPLACE(BTRIM(COALESCE(e.last_name, '')), '\\s+', ' ', 'g')) =
            LOWER(REGEXP_REPLACE(BTRIM(COALESCE(ip.last_name, '')), '\\s+', ' ', 'g'))
      INNER JOIN households h
        ON h.id = e.household_id
        AND h.disaster_event_id = $${disasterEventParamIndex}
      INNER JOIN barangays b ON b.id = h.barangay_id
      WHERE ($${householdExcludeParamIndex}::uuid IS NULL OR h.id <> $${householdExcludeParamIndex}::uuid)
    )
    SELECT
      matched.person_key,
      matched.source_role,
      matched.matched_role,
      matched.household_id,
      matched.barangay_id,
      matched.barangay_name,
      matched.household_family_head_first_name,
      matched.household_family_head_middle_name,
      matched.household_family_head_last_name,
      matched.household_family_head_suffix,
      matched.matched_first_name,
      matched.matched_middle_name,
      matched.matched_last_name,
      matched.matched_suffix,
      matched.matched_sex,
      matched.matched_age_value,
      matched.matched_age_unit,
      matched.matched_relationship_to_head,
      matched.matched_contact_number,
      matched.is_active,
      matched.registered_at,
      matched.current_stay_type,
      matched.household_size
    FROM (
      SELECT * FROM family_head_matches
      UNION ALL
      SELECT * FROM member_matches
    ) AS matched
    ORDER BY
      matched.person_key ASC,
      matched.registered_at DESC,
      matched.household_id ASC,
      matched.matched_role ASC
  `;

  const result = await dbClient.query(query, values);
  return result.rows;
};

const updateHouseholdRegistrationTimestamp = async (
  householdId,
  registeredAt,
  dbClient = pool,
) => {
  const query = `
    WITH updated_household AS (
      UPDATE households
      SET registered_at = LEAST(registered_at, $2::timestamptz),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    ),
    updated_logs AS (
      UPDATE evacuation_logs
      SET time_in = LEAST(time_in, $2::timestamptz),
          updated_at = NOW()
      WHERE household_id = $1
        AND time_in IS NOT NULL
      RETURNING id
    )
    SELECT *
    FROM updated_household
  `;

  const result = await dbClient.query(query, [householdId, registeredAt]);
  return result.rows[0] || null;
};

const updateHousehold = async (householdId, householdData, dbClient) => {
  const query = `
    UPDATE households
    SET
      evacuation_center_id = $2,
      residency_status = $3,
      contact_number = $4,
      current_stay_type = $5,
      current_address_details = $6,
      household_size = $7,
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      disaster_event_id,
      barangay_id,
      evacuation_center_id,
      residency_status,
      family_head_first_name,
      family_head_middle_name,
      family_head_last_name,
      family_head_suffix,
      sex,
      birth_date,
      contact_number,
      current_stay_type,
      current_address_details,
      household_size,
      is_active,
      registered_by,
      family_head_photo_url,
      photo_captured_at,
      photo_captured_by,
      photo_verification_notes,
      registered_at,
      updated_at,
      family_head_evacuee_id
  `;

  const values = [
    householdId,
    householdData.evacuation_center_id,
    householdData.residency_status,
    householdData.contact_number ?? null,
    householdData.current_stay_type,
    householdData.current_address_details ?? null,
    householdData.household_size,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0] || null;
};

const insertEvacuee = async (householdId, member, dbClient) => {
  const query = `
    INSERT INTO evacuees (
      household_id,
      first_name,
      middle_name,
      last_name,
      suffix,
      sex,
      birth_date,
      age,
      age_value,
      age_unit,
      civil_status,
      relationship_to_head,
      is_family_head,
      is_pregnant,
      is_lactating,
      has_disability,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW()
    )
    RETURNING
      id,
      household_id,
      first_name,
      middle_name,
      last_name,
      suffix,
      sex,
      birth_date,
      age,
      age_value,
      age_unit,
      civil_status,
      relationship_to_head,
      is_family_head,
      is_pregnant,
      is_lactating,
      has_disability,
      is_active,
      created_at,
      updated_at
  `;

  const values = [
    householdId,
    member.first_name,
    member.middle_name,
    member.last_name,
    member.suffix,
    member.sex,
    member.birth_date ?? null,
    member.age ?? null,
    member.age_value,
    member.age_unit,
    member.civil_status ?? null,
    member.relationship_to_head,
    member.is_family_head,
    member.is_pregnant,
    member.is_lactating,
    member.has_disability,
    true,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0];
};

const updateEvacuee = async (evacueeId, member, dbClient) => {
  const query = `
    UPDATE evacuees
    SET
      first_name = $2,
      middle_name = $3,
      last_name = $4,
      suffix = $5,
      sex = $6,
      birth_date = $7,
      age = $8,
      age_value = $9,
      age_unit = $10,
      civil_status = $11,
      relationship_to_head = $12,
      is_family_head = $13,
      is_pregnant = $14,
      is_lactating = $15,
      has_disability = $16,
      is_active = $17,
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      household_id,
      first_name,
      middle_name,
      last_name,
      suffix,
      sex,
      birth_date,
      age,
      age_value,
      age_unit,
      civil_status,
      relationship_to_head,
      is_family_head,
      is_pregnant,
      is_lactating,
      has_disability,
      is_active,
      created_at,
      updated_at
  `;

  const values = [
    evacueeId,
    member.first_name,
    member.middle_name,
    member.last_name,
    member.suffix,
    member.sex,
    member.birth_date ?? null,
    member.age ?? null,
    member.age_value,
    member.age_unit,
    member.civil_status ?? null,
    member.relationship_to_head,
    member.is_family_head,
    member.is_pregnant,
    member.is_lactating,
    member.has_disability,
    member.is_active ?? true,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0] || null;
};

const updateHouseholdFamilyHeadEvacueeId = async (
  householdId,
  familyHeadEvacueeId,
  dbClient,
) => {
  const query = `
    UPDATE households
    SET family_head_evacuee_id = $2,
        updated_at = NOW()
    WHERE id = $1
    RETURNING family_head_evacuee_id
  `;

  const result = await dbClient.query(query, [householdId, familyHeadEvacueeId]);
  return result.rows[0] || null;
};

const insertEvacueeSectors = async (evacueeId, sectorIds, dbClient) => {
  const insertedRows = [];

  for (const sectorId of sectorIds) {
    const query = `
      INSERT INTO evacuee_sectors (
        evacuee_id,
        sector_id,
        created_at
      )
      VALUES ($1, $2, NOW())
      RETURNING
        id,
        evacuee_id,
        sector_id,
        created_at
    `;

    const result = await dbClient.query(query, [evacueeId, sectorId]);
    insertedRows.push(result.rows[0]);
  }

  return insertedRows;
};

const deleteEvacueeSectorsByEvacueeId = async (evacueeId, dbClient) => {
  await dbClient.query(
    `
      DELETE FROM evacuee_sectors
      WHERE evacuee_id = $1
    `,
    [evacueeId],
  );
};

const deleteHouseholdSectorsByHouseholdId = async (householdId, dbClient) => {
  await dbClient.query(
    `
      DELETE FROM household_sectors
      WHERE household_id = $1
    `,
    [householdId],
  );
};

const deactivateEvacuee = async (evacueeId, dbClient) => {
  const result = await dbClient.query(
    `
      UPDATE evacuees
      SET is_active = FALSE,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `,
    [evacueeId],
  );

  return result.rows[0] || null;
};

const insertHouseholdSectors = async (householdId, sectorIds, dbClient) => {
  const insertedRows = [];

  for (const sectorId of sectorIds) {
    const query = `
      INSERT INTO household_sectors (
        household_id,
        sector_id,
        created_at
      )
      VALUES ($1, $2, NOW())
      RETURNING
        id,
        household_id,
        sector_id,
        created_at
    `;

    const result = await dbClient.query(query, [householdId, sectorId]);
    insertedRows.push(result.rows[0]);
  }

  return insertedRows;
};

const insertStub = async (stubData, dbClient) => {
  const query = `
    INSERT INTO stubs (
      disaster_event_id,
      household_id,
      stub_no,
      serial_no,
      status,
      issued_by,
      qr_code_value,
      qr_generated_at,
      qr_generated_by,
      qr_status,
      qr_notes,
      issued_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10, NOW(), NOW())
    RETURNING
      id,
      disaster_event_id,
      household_id,
      stub_no,
      serial_no,
      status,
      issued_by,
      qr_code_value,
      qr_generated_at,
      qr_generated_by,
      qr_status,
      qr_notes,
      issued_at,
      claimed_at,
      updated_at
  `;

  const values = [
    stubData.disaster_event_id,
    stubData.household_id,
    stubData.stub_no,
    stubData.serial_no,
    stubData.status,
    stubData.issued_by,
    stubData.qr_code_value,
    stubData.qr_generated_by,
    stubData.qr_status,
    stubData.qr_notes ?? null,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0];
};

const insertEvacuationLog = async (logData, dbClient) => {
  const query = `
    INSERT INTO evacuation_logs (
      disaster_event_id,
      household_id,
      evacuee_id,
      evacuation_center_id,
      time_in,
      time_out,
      status,
      recorded_by,
      remarks,
      created_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, COALESCE($8::timestamptz, NOW()), NULL,
      $5, $6, $7, NOW(), NOW()
    )
    RETURNING
      id,
      disaster_event_id,
      household_id,
      evacuee_id,
      evacuation_center_id,
      time_in,
      time_out,
      status,
      recorded_by,
      remarks,
      created_at,
      updated_at
  `;

  const values = [
    logData.disaster_event_id,
    logData.household_id,
    logData.evacuee_id,
    logData.evacuation_center_id,
    logData.status,
    logData.recorded_by,
    logData.remarks,
    logData.time_in || null,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0];
};

const getActiveEvacuationLogsByHouseholdId = async (householdId, dbClient = pool) => {
  const query = `
    SELECT
      id,
      disaster_event_id,
      household_id,
      evacuee_id,
      evacuation_center_id,
      time_in,
      time_out,
      status,
      recorded_by,
      remarks,
      created_at,
      updated_at
    FROM evacuation_logs
    WHERE household_id = $1
      AND status = 'PRESENT'
      AND time_out IS NULL
    ORDER BY time_in DESC, created_at DESC
  `;

  const result = await dbClient.query(query, [householdId]);
  return result.rows;
};

const markHouseholdDeparture = async (
  householdId,
  departureDetails,
  dbClient = pool,
) => {
  const query = `
    UPDATE evacuation_logs
    SET
      time_out = GREATEST(COALESCE($3::timestamptz, NOW()), time_in),
      status = 'LEFT',
      remarks = COALESCE($2, remarks),
      updated_at = NOW()
    WHERE household_id = $1
      AND status = 'PRESENT'
      AND time_out IS NULL
    RETURNING
      id,
      disaster_event_id,
      household_id,
      evacuee_id,
      evacuation_center_id,
      time_in,
      time_out,
      status,
      recorded_by,
      remarks,
      created_at,
      updated_at
  `;

  const result = await dbClient.query(query, [
    householdId,
    departureDetails.remarks ?? null,
    departureDetails.departure_time || null,
  ]);

  return result.rows;
};

const updateHouseholdDepartureTimestamp = async (
  householdId,
  departureTimestamp,
  dbClient = pool,
) => {
  const query = `
    UPDATE evacuation_logs
    SET time_out = LEAST(time_out, GREATEST($2::timestamptz, time_in)),
        updated_at = NOW()
    WHERE household_id = $1
      AND time_out IS NOT NULL
      AND $2::timestamptz < time_out
    RETURNING
      id,
      disaster_event_id,
      household_id,
      evacuee_id,
      evacuation_center_id,
      time_in,
      time_out,
      status,
      recorded_by,
      remarks,
      created_at,
      updated_at
  `;

  const result = await dbClient.query(query, [householdId, departureTimestamp]);
  return result.rows;
};

const markDisasterEventHouseholdDepartures = async (
  disasterEventId,
  departureTimestamp,
  remarks = null,
  dbClient = pool,
) => {
  const query = `
    UPDATE evacuation_logs
    SET
      time_out = GREATEST($2::timestamptz, time_in),
      status = 'LEFT',
      remarks = COALESCE($3, remarks),
      updated_at = NOW()
    WHERE disaster_event_id = $1
      AND status = 'PRESENT'
      AND time_out IS NULL
    RETURNING
      id,
      disaster_event_id,
      household_id,
      evacuee_id,
      evacuation_center_id,
      time_in,
      time_out,
      status,
      recorded_by,
      remarks,
      created_at,
      updated_at
  `;

  const result = await dbClient.query(query, [
    disasterEventId,
    departureTimestamp,
    remarks,
  ]);

  return result.rows;
};

const getHouseholdSummaryById = async (id) => {
  const query = `
    SELECT
      h.id,
      h.disaster_event_id,
      h.barangay_id,
      h.evacuation_center_id,
      h.residency_status,
      h.family_head_first_name,
      h.family_head_middle_name,
      h.family_head_last_name,
      h.family_head_suffix,
      h.sex,
      h.birth_date,
      h.contact_number,
      h.current_stay_type,
      h.current_address_details,
      h.household_size,
      h.is_active,
      h.registered_by,
      h.family_head_photo_url,
      h.photo_captured_at,
      h.photo_captured_by,
      h.photo_verification_notes,
      h.registered_at,
      h.updated_at,
      h.family_head_evacuee_id,
      b.code AS barangay_code,
      b.name AS barangay_name,
      de.event_code,
      de.title AS disaster_event_title
    FROM households h
    LEFT JOIN barangays b ON b.id = h.barangay_id
    INNER JOIN disaster_events de ON de.id = h.disaster_event_id
    WHERE h.id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

const getEvacueesByHouseholdId = async (
  householdId,
  { includeInactive = false } = {},
) => {
  const activeFilterClause = includeInactive ? "" : "AND is_active = TRUE";
  const query = `
    SELECT
      id,
      household_id,
      first_name,
      middle_name,
      last_name,
      suffix,
      sex,
      birth_date,
      age,
      age_value,
      age_unit,
      civil_status,
      relationship_to_head,
      is_family_head,
      is_pregnant,
      is_lactating,
      has_disability,
      is_active,
      created_at,
      updated_at
    FROM evacuees
    WHERE household_id = $1
      ${activeFilterClause}
    ORDER BY created_at ASC, first_name ASC, last_name ASC
  `;

  const result = await pool.query(query, [householdId]);
  return result.rows;
};

const getEvacueeSectorAssignmentsByHouseholdId = async (
  householdId,
  { includeInactive = false } = {},
) => {
  const activeFilterClause = includeInactive ? "" : "AND e.is_active = TRUE";
  const query = `
    SELECT
      es.evacuee_id,
      s.id AS sector_id,
      s.code,
      s.name,
      s.description,
      s.sector_group
    FROM evacuee_sectors es
    INNER JOIN evacuees e ON e.id = es.evacuee_id
    INNER JOIN sectors s ON s.id = es.sector_id
    WHERE e.household_id = $1
      ${activeFilterClause}
    ORDER BY e.created_at ASC, s.name ASC
  `;

  const result = await pool.query(query, [householdId]);
  return result.rows;
};

const getHouseholdSectorAssignmentsByHouseholdId = async (householdId) => {
  const query = `
    SELECT
      s.id,
      s.code,
      s.name,
      s.description,
      s.sector_group
    FROM household_sectors hs
    INNER JOIN sectors s ON s.id = hs.sector_id
    WHERE hs.household_id = $1
    ORDER BY s.name ASC
  `;

  const result = await pool.query(query, [householdId]);
  return result.rows;
};

const getLatestHouseholdPrivacyConsentByHouseholdId = async (
  householdId,
  dbClient = pool,
) => {
  const query = `
    SELECT
      hpc.id,
      hpc.household_id,
      hpc.disaster_event_id,
      hpc.consent_status,
      hpc.notice_version,
      hpc.acknowledged_at,
      hpc.acknowledged_by_name,
      hpc.representative_relationship,
      hpc.recorded_by,
      hpc.recorded_at,
      hpc.device_id,
      hpc.is_offline_encoded,
      hpc.sync_status,
      hpc.created_at,
      hpc.updated_at,
      CONCAT_WS(' ', u.first_name, u.last_name) AS recorded_by_name
    FROM household_privacy_consents hpc
    LEFT JOIN users u ON u.id = hpc.recorded_by
    WHERE household_id = $1
    ORDER BY hpc.acknowledged_at DESC, hpc.recorded_at DESC, hpc.created_at DESC
    LIMIT 1
  `;

  const result = await dbClient.query(query, [householdId]);
  return result.rows[0] || null;
};

const getStubByHouseholdId = async (householdId) => {
  const query = `
    SELECT
      id,
      disaster_event_id,
      household_id,
      stub_no,
      serial_no,
      status,
      issued_by,
      qr_code_value,
      qr_generated_at,
      qr_generated_by,
      qr_status,
      qr_notes,
      issued_at,
      claimed_at,
      updated_at
    FROM stubs
    WHERE household_id = $1
    ORDER BY issued_at DESC
    LIMIT 1
  `;

  const result = await pool.query(query, [householdId]);
  return result.rows[0] || null;
};

const getLatestAttendanceByHouseholdId = async (householdId) => {
  const query = `
    SELECT
      id,
      disaster_event_id,
      household_id,
      evacuee_id,
      evacuation_center_id,
      time_in,
      time_out,
      status,
      recorded_by,
      remarks,
      created_at,
      updated_at
    FROM evacuation_logs
    WHERE household_id = $1
    ORDER BY
      COALESCE(time_out, time_in) DESC,
      updated_at DESC,
      created_at DESC
    LIMIT 1
  `;

  const result = await pool.query(query, [householdId]);
  return result.rows[0] || null;
};

const getLatestDistributionTransactionByStubId = async (stubId) => {
  if (!stubId) {
    return null;
  }

  const query = `
    SELECT
      id,
      disaster_event_id,
      household_id,
      stub_id,
      distribution_date,
      distribution_status,
      claimed_by_name,
      receipt_no,
      receipt_status,
      received_at,
      qr_reference_value,
      qr_scanned_at,
      created_at,
      updated_at
    FROM distribution_transactions
    WHERE stub_id = $1
    ORDER BY distribution_date DESC, created_at DESC
    LIMIT 1
  `;

  const result = await pool.query(query, [stubId]);
  return result.rows[0] || null;
};

const getEvacuationLogByIdForHousehold = async (
  householdId,
  evacuationLogId,
  dbClient = pool,
) => {
  const query = `
    SELECT
      id,
      disaster_event_id,
      household_id,
      evacuee_id,
      evacuation_center_id,
      time_in,
      time_out,
      status,
      recorded_by,
      remarks,
      created_at,
      updated_at
    FROM evacuation_logs
    WHERE household_id = $1
      AND id = $2
    LIMIT 1
  `;

  const result = await dbClient.query(query, [householdId, evacuationLogId]);
  return result.rows[0] || null;
};

const updateEvacuationLogCorrection = async (
  evacuationLogId,
  correctionData,
  dbClient = pool,
) => {
  const query = `
    UPDATE evacuation_logs
    SET
      evacuation_center_id = $2,
      status = $3,
      time_out = CASE
        WHEN $3 = 'PRESENT' THEN NULL
        WHEN $3 = 'LEFT' AND time_out IS NULL THEN NOW()
        ELSE time_out
      END,
      remarks = $4,
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      disaster_event_id,
      household_id,
      evacuee_id,
      evacuation_center_id,
      time_in,
      time_out,
      status,
      recorded_by,
      remarks,
      created_at,
      updated_at
  `;

  const result = await dbClient.query(query, [
    evacuationLogId,
    correctionData.evacuation_center_id,
    correctionData.status,
    correctionData.remarks,
  ]);

  return result.rows[0] || null;
};

const archiveHousehold = async (householdId, dbClient = pool) => {
  const query = `
    UPDATE households
    SET
      is_active = FALSE,
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      disaster_event_id,
      barangay_id,
      evacuation_center_id,
      residency_status,
      family_head_first_name,
      family_head_middle_name,
      family_head_last_name,
      family_head_suffix,
      sex,
      birth_date,
      contact_number,
      current_stay_type,
      current_address_details,
      household_size,
      is_active,
      registered_by,
      family_head_photo_url,
      photo_captured_at,
      photo_captured_by,
      photo_verification_notes,
      registered_at,
      updated_at,
      family_head_evacuee_id
  `;

  const result = await dbClient.query(query, [householdId]);
  return result.rows[0] || null;
};

const archiveHouseholdsByIds = async (householdIds, dbClient = pool) => {
  if (!Array.isArray(householdIds) || householdIds.length === 0) {
    return [];
  }

  const query = `
    UPDATE households
    SET
      is_active = FALSE,
      updated_at = NOW()
    WHERE id = ANY($1::uuid[])
    RETURNING
      id,
      disaster_event_id,
      barangay_id,
      evacuation_center_id,
      residency_status,
      family_head_first_name,
      family_head_middle_name,
      family_head_last_name,
      family_head_suffix,
      sex,
      birth_date,
      contact_number,
      current_stay_type,
      current_address_details,
      household_size,
      is_active,
      registered_by,
      family_head_photo_url,
      photo_captured_at,
      photo_captured_by,
      photo_verification_notes,
      registered_at,
      updated_at,
      family_head_evacuee_id
  `;

  const result = await dbClient.query(query, [householdIds]);
  return result.rows;
};

const deactivateEvacueesByHouseholdId = async (householdId, dbClient = pool) => {
  const query = `
    UPDATE evacuees
    SET
      is_active = FALSE,
      updated_at = NOW()
    WHERE household_id = $1
      AND is_active = TRUE
    RETURNING
      id,
      household_id,
      first_name,
      middle_name,
      last_name,
      suffix,
      sex,
      birth_date,
      age,
      age_value,
      age_unit,
      civil_status,
      relationship_to_head,
      is_family_head,
      is_pregnant,
      is_lactating,
      has_disability,
      is_active,
      created_at,
      updated_at
  `;

  const result = await dbClient.query(query, [householdId]);
  return result.rows;
};

const deactivateEvacueesByHouseholdIds = async (
  householdIds,
  dbClient = pool,
) => {
  if (!Array.isArray(householdIds) || householdIds.length === 0) {
    return [];
  }

  const query = `
    UPDATE evacuees
    SET
      is_active = FALSE,
      updated_at = NOW()
    WHERE household_id = ANY($1::uuid[])
      AND is_active = TRUE
    RETURNING
      id,
      household_id,
      first_name,
      middle_name,
      last_name,
      suffix,
      sex,
      birth_date,
      age,
      age_value,
      age_unit,
      civil_status,
      relationship_to_head,
      is_family_head,
      is_pregnant,
      is_lactating,
      has_disability,
      is_active,
      created_at,
      updated_at
  `;

  const result = await dbClient.query(query, [householdIds]);
  return result.rows;
};

const restoreHousehold = async (householdId, dbClient = pool) => {
  const query = `
    UPDATE households
    SET
      is_active = TRUE,
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      disaster_event_id,
      barangay_id,
      evacuation_center_id,
      residency_status,
      family_head_first_name,
      family_head_middle_name,
      family_head_last_name,
      family_head_suffix,
      sex,
      birth_date,
      contact_number,
      current_stay_type,
      current_address_details,
      household_size,
      is_active,
      registered_by,
      family_head_photo_url,
      photo_captured_at,
      photo_captured_by,
      photo_verification_notes,
      registered_at,
      updated_at,
      family_head_evacuee_id
  `;

  const result = await dbClient.query(query, [householdId]);
  return result.rows[0] || null;
};

const reactivateEvacueesByHouseholdId = async (householdId, dbClient = pool) => {
  const query = `
    UPDATE evacuees
    SET
      is_active = TRUE,
      updated_at = NOW()
    WHERE household_id = $1
      AND is_active = FALSE
    RETURNING
      id,
      household_id,
      first_name,
      middle_name,
      last_name,
      suffix,
      sex,
      birth_date,
      age,
      age_value,
      age_unit,
      civil_status,
      relationship_to_head,
      is_family_head,
      is_pregnant,
      is_lactating,
      has_disability,
      is_active,
      created_at,
      updated_at
  `;

  const result = await dbClient.query(query, [householdId]);
  return result.rows;
};

module.exports = {
  getDisasterEventById,
  getBarangayById,
  getUserBarangayScopeById,
  getEvacuationCenterById,
  getActiveEvacuationCentersByBarangayId,
  getDisasterEventBarangayLink,
  getSectorsByIds,
  getSectorsByCodes,
  getAgeGroupSectors,
  generateStubNumbers,
  insertHousehold,
  insertHouseholdPrivacyConsent,
  findDuplicateHouseholdRegistration,
  findPotentialDuplicatePersonMatches,
  updateHouseholdRegistrationTimestamp,
  updateHousehold,
  insertEvacuee,
  updateEvacuee,
  updateHouseholdFamilyHeadEvacueeId,
  insertEvacueeSectors,
  deleteEvacueeSectorsByEvacueeId,
  insertHouseholdSectors,
  deleteHouseholdSectorsByHouseholdId,
  deactivateEvacuee,
  insertStub,
  insertEvacuationLog,
  getActiveEvacuationLogsByHouseholdId,
  markHouseholdDeparture,
  updateHouseholdDepartureTimestamp,
  markDisasterEventHouseholdDepartures,
  getHouseholdSummaryById,
  getEvacueesByHouseholdId,
  getEvacueeSectorAssignmentsByHouseholdId,
  getHouseholdSectorAssignmentsByHouseholdId,
  getLatestHouseholdPrivacyConsentByHouseholdId,
  getStubByHouseholdId,
  getLatestAttendanceByHouseholdId,
  getLatestDistributionTransactionByStubId,
  getEvacuationLogByIdForHousehold,
  updateEvacuationLogCorrection,
  archiveHousehold,
  archiveHouseholdsByIds,
  deactivateEvacueesByHouseholdId,
  deactivateEvacueesByHouseholdIds,
  restoreHousehold,
  reactivateEvacueesByHouseholdId,
};
