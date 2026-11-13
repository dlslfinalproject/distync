BEGIN;

-- Distribution records are final claims in DISTYNC. This migration does not
-- delete distribution history; it prevents future cancellation/reversal rows.
LOCK TABLE public.distribution_transactions IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
  non_claimed_count bigint;
BEGIN
  IF to_regclass('public.distribution_transactions') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'undefined_table',
      MESSAGE = 'Distribution status cleanup failed: public.distribution_transactions does not exist.';
  END IF;

  SELECT COUNT(*)
  INTO non_claimed_count
  FROM public.distribution_transactions
  WHERE distribution_status IS DISTINCT FROM 'CLAIMED';

  IF non_claimed_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution status cleanup refused because non-CLAIMED rows exist.',
      DETAIL = format('non_claimed_distribution_rows=%s', non_claimed_count);
  END IF;
END $$;

ALTER TABLE public.distribution_transactions
  DROP CONSTRAINT IF EXISTS chk_distribution_status;

ALTER TABLE public.distribution_transactions
  DROP CONSTRAINT IF EXISTS distribution_transactions_distribution_status_check;

ALTER TABLE public.distribution_transactions
  ADD CONSTRAINT chk_distribution_status
  CHECK (distribution_status = 'CLAIMED');

COMMIT;
