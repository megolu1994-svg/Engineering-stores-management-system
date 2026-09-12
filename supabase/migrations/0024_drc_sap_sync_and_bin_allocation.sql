-- Migration 0024: DRC SAP MB51 Sync and Direct Bin Allocation
-- Adds columns to track SAP 103 GR Blocked Stock and 105 GR Release documents,
-- as well as structured SAP line items on the DRC register.

BEGIN;

ALTER TABLE public.receipt_header
  ADD COLUMN IF NOT EXISTS sap_103_doc TEXT,
  ADD COLUMN IF NOT EXISTS sap_103_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sap_105_doc TEXT,
  ADD COLUMN IF NOT EXISTS sap_105_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sap_items JSONB;

-- Grant permissions if necessary
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'receipt_header'
  ) THEN
    GRANT ALL ON public.receipt_header TO authenticated;
    GRANT ALL ON public.receipt_header TO anon;
  END IF;
END $$;

COMMIT;
