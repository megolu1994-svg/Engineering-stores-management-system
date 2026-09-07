-- Migration 0022: Ensure inspection columns and inspection history table exist
-- Run this in your Supabase SQL Editor if you encounter errors updating inspections/DRC register.

BEGIN;

-- 1. Ensure all inspection fields exist on receipt_header
ALTER TABLE public.receipt_header
  ADD COLUMN IF NOT EXISTS inspection_status TEXT,
  ADD COLUMN IF NOT EXISTS inspection_remarks TEXT,
  ADD COLUMN IF NOT EXISTS inspection_by TEXT,
  ADD COLUMN IF NOT EXISTS inspection_date TIMESTAMPTZ;

-- 2. Create receipt_inspection_history table if it does not exist
CREATE TABLE IF NOT EXISTS public.receipt_inspection_history (
  id BIGSERIAL PRIMARY KEY,
  receipt_id BIGINT NOT NULL REFERENCES public.receipt_header(id) ON DELETE CASCADE,
  inspection_status TEXT NOT NULL,
  inspection_remarks TEXT,
  inspection_by TEXT,
  inspection_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_receipt_inspection_history_receipt_id
  ON public.receipt_inspection_history (receipt_id);

CREATE INDEX IF NOT EXISTS idx_receipt_inspection_history_user_id
  ON public.receipt_inspection_history (user_id);

-- 4. Enable Row Level Security and configure accessible policies
ALTER TABLE public.receipt_inspection_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON public.receipt_inspection_history;
CREATE POLICY tenant_isolation ON public.receipt_inspection_history
  FOR ALL
  USING (auth.uid() = user_id OR user_id IS NULL OR auth.uid() IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL OR auth.uid() IS NULL);

-- 5. Fix RLS on receipt_header so users can update existing rows where user_id might be NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'receipt_header'
      AND policyname = 'tenant_isolation'
  ) THEN
    DROP POLICY IF EXISTS tenant_isolation ON public.receipt_header;
    CREATE POLICY tenant_isolation ON public.receipt_header
      FOR ALL
      USING (auth.uid() = user_id OR user_id IS NULL)
      WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
  END IF;
END $$;

COMMIT;
