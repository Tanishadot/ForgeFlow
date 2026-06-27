-- ForgeFlow AI — Schedule Persistence
-- Run in Supabase SQL Editor after schema.sql
-- Stores the most recent generated schedule per company so it survives
-- browser refreshes without requiring a re-run.

CREATE TABLE IF NOT EXISTS public.schedules (
  id             uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id     uuid         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  generated_at   timestamptz  NOT NULL DEFAULT now(),
  summary        jsonb        NOT NULL DEFAULT '{}',
  schedule_items jsonb        NOT NULL DEFAULT '[]',
  machines       jsonb        NOT NULL DEFAULT '[]'
);

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- Company members can read their own schedules
CREATE POLICY "schedules_select" ON public.schedules
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- Backend uses service role key for insert/delete — no anon insert needed
CREATE POLICY "schedules_insert" ON public.schedules
  FOR INSERT WITH CHECK (true);

CREATE POLICY "schedules_delete" ON public.schedules
  FOR DELETE USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );
