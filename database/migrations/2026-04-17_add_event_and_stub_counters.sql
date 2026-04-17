CREATE TABLE IF NOT EXISTS disaster_event_code_counters (
    event_year INTEGER PRIMARY KEY,
    last_number INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO disaster_event_code_counters (event_year, last_number, updated_at)
SELECT
    CAST(SUBSTRING(de.event_code FROM '^DE-(\d{4})-\d{4}$') AS INTEGER) AS event_year,
    MAX(CAST(SUBSTRING(de.event_code FROM '^DE-\d{4}-(\d{4})$') AS INTEGER)) AS last_number,
    NOW() AS updated_at
FROM disaster_events de
WHERE de.event_code ~ '^DE-\d{4}-\d{4}$'
GROUP BY CAST(SUBSTRING(de.event_code FROM '^DE-(\d{4})-\d{4}$') AS INTEGER)
ON CONFLICT (event_year)
DO UPDATE SET
    last_number = EXCLUDED.last_number,
    updated_at = NOW();

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

DROP TRIGGER IF EXISTS before_insert_disaster_event_code_safe ON disaster_events;

CREATE TRIGGER before_insert_disaster_event_code_safe
BEFORE INSERT ON disaster_events
FOR EACH ROW
EXECUTE FUNCTION trg_set_disaster_event_code_safe();

CREATE TABLE IF NOT EXISTS stub_code_counters (
    stub_year INTEGER PRIMARY KEY,
    last_number INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO stub_code_counters (stub_year, last_number, updated_at)
SELECT
    CAST(SUBSTRING(s.stub_no FROM '^STUB-(\d{4})-\d{6}$') AS INTEGER) AS stub_year,
    MAX(CAST(SUBSTRING(s.stub_no FROM '^STUB-\d{4}-(\d{6})$') AS INTEGER)) AS last_number,
    NOW() AS updated_at
FROM stubs s
WHERE s.stub_no ~ '^STUB-\d{4}-\d{6}$'
GROUP BY CAST(SUBSTRING(s.stub_no FROM '^STUB-(\d{4})-\d{6}$') AS INTEGER)
ON CONFLICT (stub_year)
DO UPDATE SET
    last_number = EXCLUDED.last_number,
    updated_at = NOW();

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
