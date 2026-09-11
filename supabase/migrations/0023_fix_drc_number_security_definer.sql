-- Migration 0023: Fix generate_next_drc_number RPC with SECURITY DEFINER
--
-- Problem:
-- When generate_next_drc_number was executed by non-admin or unauthenticated
-- clients, Row Level Security (RLS) on receipt_header restricted visibility of
-- existing rows, causing the function to find an older maximum DRC number and
-- return a number that already exists (e.g. DRC/26-27/95 when DRC/26-27/108 exists),
-- triggering a 23505 unique constraint violation on idx_receipt_header_drc_number.
--
-- Solution:
-- Mark generate_next_drc_number as SECURITY DEFINER with search_path = public
-- so it can reliably scan all receipt_header rows across accounts to identify the
-- true global maximum DRC number for the active financial year.

BEGIN;

CREATE OR REPLACE FUNCTION public.generate_next_drc_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_month  int := EXTRACT(MONTH FROM now());
  current_year   int := EXTRACT(YEAR  FROM now());
  fy_start       int;
  fy_end         int;
  fy_prefix      text;
  last_number    text;
  numeric_part   text;
  next_num       int;
  result         text;
BEGIN
  -- Serialize with advisory lock to prevent concurrent races
  PERFORM pg_advisory_xact_lock(999999);

  -- Determine financial year (1 Apr - 31 Mar)
  IF current_month >= 4 THEN
    fy_start := current_year;
    fy_end   := current_year + 1;
  ELSE
    fy_start := current_year - 1;
    fy_end   := current_year;
  END IF;

  fy_prefix := 'DRC/' || substring(fy_start::text, 3, 2) || '-' || substring(fy_end::text, 3, 2) || '/';

  -- Find the highest existing DRC number for this FY across all records
  SELECT drc_number INTO last_number
  FROM public.receipt_header
  WHERE drc_number LIKE fy_prefix || '%'
  ORDER BY
    NULLIF(regexp_replace(drc_number, '^' || fy_prefix || '([0-9]+).*$', '\1', 'i'), '')::bigint DESC NULLS LAST,
    drc_number DESC
  LIMIT 1;

  IF last_number IS NULL THEN
    result := fy_prefix || '1';
  ELSE
    numeric_part := regexp_replace(last_number, '^' || fy_prefix || '([0-9]+).*$', '\1', 'i');

    IF numeric_part = '' OR numeric_part IS NULL OR numeric_part = last_number THEN
      result := fy_prefix || '1';
    ELSE
      next_num := numeric_part::int + 1;
      result := fy_prefix || next_num;
    END IF;
  END IF;

  RETURN result;
END;
$$;

-- Ensure execute permissions
GRANT EXECUTE ON FUNCTION public.generate_next_drc_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_next_drc_number() TO anon;

COMMIT;
