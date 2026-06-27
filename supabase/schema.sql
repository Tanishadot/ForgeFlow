-- ============================================================
-- ForgeFlow AI — Full B2B SaaS Database Schema
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New Query
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- COMPANIES
-- Created when company admin signs up
-- ============================================================
CREATE TABLE IF NOT EXISTS companies (
  id           uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name text         NOT NULL,
  industry     text,
  location     text,
  timezone     text         NOT NULL DEFAULT 'UTC',
  factory_size text         NOT NULL DEFAULT 'small'
               CHECK (factory_size IN ('small', 'medium', 'enterprise')),
  num_shifts   text         NOT NULL DEFAULT '1',
  created_at   timestamptz  NOT NULL DEFAULT now()
);

-- ============================================================
-- PROFILES
-- One per Supabase auth user. Company admin + employees who
-- have been provisioned with Supabase auth accounts.
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id                      uuid         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name               text,
  employee_id             text,
  role                    text         NOT NULL DEFAULT 'employee'
                          CHECK (role IN ('employee', 'manager', 'admin')),
  company_id              uuid         REFERENCES companies(id) ON DELETE SET NULL,
  password_reset_required boolean      NOT NULL DEFAULT false,
  created_at              timestamptz  NOT NULL DEFAULT now()
);

-- ============================================================
-- EMPLOYEES
-- HR / scheduling data. Populated via CSV upload during onboarding.
-- auth_user_id is set after a Supabase auth account is created for them.
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
  id                      uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id              uuid         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id             text         NOT NULL,
  name                    text,
  email                   text,
  department              text,
  role                    text         NOT NULL DEFAULT 'employee'
                          CHECK (role IN ('employee', 'manager', 'admin')),
  shift                   text,
  skill_level             text,
  phone                   text,
  password_reset_required boolean      NOT NULL DEFAULT true,
  auth_user_id            uuid,
  created_at              timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (company_id, employee_id)
);

-- ============================================================
-- MACHINES
-- Uploaded by admin via CSV. Replaces the old flat machines table.
-- ============================================================
CREATE TABLE IF NOT EXISTS machines (
  id                       uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id               uuid         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  machine_code             text         NOT NULL,
  name                     text,
  type                     text,
  department               text,
  status                   text         NOT NULL DEFAULT 'idle'
                           CHECK (status IN ('running', 'idle', 'down', 'maintenance')),
  capacity_per_hour        integer      NOT NULL DEFAULT 0,
  maintenance_schedule     text,
  operating_cost_per_hour  float        NOT NULL DEFAULT 0,
  supported_operations     text[]       DEFAULT '{}',
  current_shift_operator   uuid         REFERENCES employees(id),
  utilization              numeric      NOT NULL DEFAULT 0
                           CHECK (utilization >= 0 AND utilization <= 100),
  created_at               timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (company_id, machine_code)
);

-- ============================================================
-- INVENTORY
-- Uploaded by admin via CSV.
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory (
  id               uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id       uuid         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  material_code    text         NOT NULL,
  material_name    text,
  quantity         float        NOT NULL DEFAULT 0,
  unit             text         DEFAULT 'units',
  minimum_stock    float        NOT NULL DEFAULT 0,
  supplier         text,
  lead_time_days   integer      NOT NULL DEFAULT 0,
  cost             float        NOT NULL DEFAULT 0,
  storage_location text,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (company_id, material_code)
);

-- ============================================================
-- ORDERS
-- Production orders. Can be entered manually or via CSV.
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id                    uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id            uuid         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  order_code            text         NOT NULL,
  customer_name         text,
  product_name          text,
  quantity              integer      NOT NULL DEFAULT 1,
  priority              text         NOT NULL DEFAULT 'normal'
                        CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  deadline              timestamptz,
  required_machine_type text,
  estimated_duration    integer      NOT NULL DEFAULT 60,
  status                text         NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  notes                 text,
  updated_by            uuid,
  updated_at            timestamptz  NOT NULL DEFAULT now(),
  created_at            timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (company_id, order_code)
);

-- ============================================================
-- SCHEDULES
-- Persists the most recent generated schedule per company so it
-- survives browser refreshes without requiring a re-run.
-- ============================================================
CREATE TABLE IF NOT EXISTS schedules (
  id             uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id     uuid         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  generated_at   timestamptz  NOT NULL DEFAULT now(),
  summary        jsonb        NOT NULL DEFAULT '{}',
  schedule_items jsonb        NOT NULL DEFAULT '[]',
  machines       jsonb        NOT NULL DEFAULT '[]'
);

-- ============================================================
-- ALERTS
-- System-generated or manually created alerts.
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
  id         uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid         REFERENCES companies(id) ON DELETE CASCADE,
  type       text,
  message    text         NOT NULL,
  severity   text         NOT NULL DEFAULT 'info'
             CHECK (severity IN ('critical', 'warning', 'info')),
  created_at timestamptz  NOT NULL DEFAULT now()
);

-- ============================================================
-- SHIFT LOGS
-- Employees submit shift handover notes here.
-- ============================================================
CREATE TABLE IF NOT EXISTS shift_logs (
  id          uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  uuid         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id uuid         REFERENCES employees(id),
  machine_id  uuid         REFERENCES machines(id),
  order_id    uuid         REFERENCES orders(id),
  shift       text,
  notes       text         NOT NULL DEFAULT '',
  created_at  timestamptz  NOT NULL DEFAULT now()
);

-- ============================================================
-- SHIFT CONTEXT
-- LLM-generated summaries of shift logs. One per shift period.
-- ============================================================
CREATE TABLE IF NOT EXISTS shift_context (
  id           uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   uuid         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  summary      text         NOT NULL,
  generated_at timestamptz  NOT NULL DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE companies    ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees    ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines     ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory    ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_context ENABLE ROW LEVEL SECURITY;

-- ── Profiles ─────────────────────────────────────────────────
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (id = auth.uid());

-- ── Companies ─────────────────────────────────────────────────
CREATE POLICY "companies_select" ON companies FOR SELECT USING (
  id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "companies_insert" ON companies FOR INSERT WITH CHECK (true);
CREATE POLICY "companies_update" ON companies FOR UPDATE USING (
  id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ── Employees ─────────────────────────────────────────────────
CREATE POLICY "employees_select" ON employees FOR SELECT USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "employees_insert" ON employees FOR INSERT WITH CHECK (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);
CREATE POLICY "employees_update" ON employees FOR UPDATE USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);

-- ── Machines ─────────────────────────────────────────────────
CREATE POLICY "machines_select" ON machines FOR SELECT USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "machines_insert" ON machines FOR INSERT WITH CHECK (true);
CREATE POLICY "machines_update" ON machines FOR UPDATE USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);

-- ── Inventory ─────────────────────────────────────────────────
CREATE POLICY "inventory_select" ON inventory FOR SELECT USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "inventory_insert" ON inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "inventory_update" ON inventory FOR UPDATE USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);

-- ── Orders ────────────────────────────────────────────────────
CREATE POLICY "orders_select" ON orders FOR SELECT USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders_update" ON orders FOR UPDATE USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);

-- ── Alerts ────────────────────────────────────────────────────
CREATE POLICY "alerts_select" ON alerts FOR SELECT USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  OR company_id IS NULL
);
CREATE POLICY "alerts_insert" ON alerts FOR INSERT WITH CHECK (true);

-- ── Shift Logs ────────────────────────────────────────────────
CREATE POLICY "shift_logs_select" ON shift_logs FOR SELECT USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "shift_logs_insert" ON shift_logs FOR INSERT WITH CHECK (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);

-- ── Schedules ─────────────────────────────────────────────────
CREATE POLICY "schedules_select" ON schedules FOR SELECT USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "schedules_insert" ON schedules FOR INSERT WITH CHECK (true);
CREATE POLICY "schedules_delete" ON schedules FOR DELETE USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')
  )
);

-- ── Shift Context ─────────────────────────────────────────────
CREATE POLICY "shift_context_select" ON shift_context FOR SELECT USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "shift_context_insert" ON shift_context FOR INSERT WITH CHECK (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Look up the Supabase auth email for an employee_id.
-- SECURITY DEFINER bypasses RLS so unauthenticated callers (login page)
-- can resolve the email without exposing the full employees table.
CREATE OR REPLACE FUNCTION get_employee_auth_email(p_employee_id text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.email
  FROM   employees e
  WHERE  e.employee_id = p_employee_id
  LIMIT  1;
$$;
