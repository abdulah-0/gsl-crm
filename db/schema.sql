-- GSL Pakistan CRM - Single SQL schema (PostgreSQL/Supabase compatible)
-- Contains core data model + seed for 3 superadmin users
-- NOTE: In Supabase, auth-managed users are created via the Auth API.
-- This script keeps application users in a local "users" table with bcrypt hashes.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for crypt()/gen_salt() password hashing

-- Utility: auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

-- 1) Access Control
CREATE TABLE IF NOT EXISTS roles (
  id            bigserial PRIMARY KEY,
  name          text NOT NULL UNIQUE,
  description   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id            bigserial PRIMARY KEY,
  name          text,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id   bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id   bigint NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- Optional permission scaffolding (can be extended later)
CREATE TABLE IF NOT EXISTS permissions (
  id          bigserial PRIMARY KEY,
  code        text NOT NULL UNIQUE, -- e.g. 'leads.view', 'leads.edit'
  label       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       bigint NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id bigint NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 2) Study Abroad / Leads
CREATE TABLE IF NOT EXISTS universities (
  id          bigserial PRIMARY KEY,
  name        text NOT NULL,
  country     text,
  ranking     int,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leads (
  id               bigserial PRIMARY KEY,
  first_name       text,
  last_name        text,
  email            text,
  phone            text,
  source           text CHECK (source IN ('facebook','instagram','google_form','walk_in','referral','organic')),
  status           text NOT NULL DEFAULT 'new' CHECK (status IN ('new','documentation','university','visa','enrolled','rejected')),
  assigned_to      bigint REFERENCES users(id) ON DELETE SET NULL,
  university_id    bigint REFERENCES universities(id) ON DELETE SET NULL,
  tags             text[],
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lead_documents (
  id          bigserial PRIMARY KEY,
  lead_id     bigint NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  doc_type    text NOT NULL, -- passport, academic, etc.
  file_url    text NOT NULL,
  uploaded_by bigint REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lead_timeline (
  id          bigserial PRIMARY KEY,
  lead_id     bigint NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  action      text NOT NULL, -- note / email / status_change
  detail      text,
  created_by  bigint REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 3) Coaching
CREATE TABLE IF NOT EXISTS batches (
  id           bigserial PRIMARY KEY,
  name         text NOT NULL,
  course       text,  -- e.g., IELTS, PTE
  start_date   date,
  end_date     date,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS students (
  id            bigserial PRIMARY KEY,
  lead_id       bigint REFERENCES leads(id) ON DELETE SET NULL,
  email         text UNIQUE,
  phone         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enrollments (
  id            bigserial PRIMARY KEY,
  student_id    bigint NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  batch_id      bigint NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  fee_total     numeric(12,2) NOT NULL DEFAULT 0,
  fee_paid      numeric(12,2) NOT NULL DEFAULT 0,
  next_due_on   date,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, batch_id)
);

CREATE TABLE IF NOT EXISTS timetable (
  id           bigserial PRIMARY KEY,
  batch_id     bigint NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  teacher_id   bigint REFERENCES users(id) ON DELETE SET NULL,
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz NOT NULL,
  topic        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance (
  id           bigserial PRIMARY KEY,
  student_id   bigint NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  timetable_id bigint NOT NULL REFERENCES timetable(id) ON DELETE CASCADE,
  status       text NOT NULL CHECK (status IN ('present','absent','late')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS performance (
  id           bigserial PRIMARY KEY,
  student_id   bigint NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  metric       text NOT NULL,  -- e.g., mock_score, quiz
  value        numeric(8,2),
  recorded_at  timestamptz NOT NULL DEFAULT now()
);

-- 4) Employee Management & HR
CREATE TABLE IF NOT EXISTS employees (
  id            bigserial PRIMARY KEY,
  user_id       bigint UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  role_title    text, -- Counselor/Teacher/Accountant etc.
  joined_on     date,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_attendance (
  id           bigserial PRIMARY KEY,
  employee_id  bigint NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  check_in     timestamptz,
  check_out    timestamptz,
  method       text CHECK (method IN ('biometric','manual')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leaves (
  id           bigserial PRIMARY KEY,
  employee_id  bigint NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  start_date   date NOT NULL,
  end_date     date NOT NULL,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reason       text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll (
  id           bigserial PRIMARY KEY,
  employee_id  bigint NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month        date NOT NULL, -- first day of month
  base_salary  numeric(12,2) NOT NULL DEFAULT 0,
  allowances   numeric(12,2) NOT NULL DEFAULT 0,
  deductions   numeric(12,2) NOT NULL DEFAULT 0,
  net_salary   numeric(12,2) GENERATED ALWAYS AS (base_salary + allowances - deductions) STORED,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 5) Accounts
CREATE TABLE IF NOT EXISTS accounts_transactions (
  id           bigserial PRIMARY KEY,
  txn_type     text NOT NULL CHECK (txn_type IN ('cash_in','cash_out','sale','expense')),
  amount       numeric(14,2) NOT NULL,
  category     text,
  currency     text DEFAULT 'PKR',
  txn_date     date NOT NULL DEFAULT CURRENT_DATE,
  notes        text,
  created_by   bigint REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 5b) Vouchers (for Finance tab)
CREATE TABLE IF NOT EXISTS vouchers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text UNIQUE NOT NULL,
  vtype         text NOT NULL CHECK (vtype IN ('cash_in','cash_out','online','bank','transfer')),
  amount        numeric(14,2) NOT NULL,
  branch        text NOT NULL,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  status        text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  description   text,
  student_id    text REFERENCES dashboard_students(id) ON DELETE SET NULL,
  voucher_type  text,
  service_type  text,
  discount      numeric(14,2),
  amount_paid   numeric(14,2),
  amount_unpaid numeric(14,2),
  due_date      date,
  pdf_url       text,
  branch_id     uuid,
  created_by    bigint REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);


-- 6) SaaS B2B
CREATE TABLE IF NOT EXISTS b2b_accounts (
  id          bigserial PRIMARY KEY,
  agency_name text NOT NULL,
  quota_month int DEFAULT 0,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS partner_leads (
  id            bigserial PRIMARY KEY,
  b2b_id        bigint NOT NULL REFERENCES b2b_accounts(id) ON DELETE CASCADE,
  lead_id       bigint NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (b2b_id, lead_id)
);

-- 7) Marketing
CREATE TABLE IF NOT EXISTS campaigns (
  id           bigserial PRIMARY KEY,
  name         text NOT NULL,
  source       text CHECK (source IN ('facebook','instagram','google','other')),
  budget       numeric(14,2) DEFAULT 0,
  start_date   date,
  end_date     date,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketing_leads (
  id           bigserial PRIMARY KEY,
  campaign_id  bigint REFERENCES campaigns(id) ON DELETE SET NULL,
  lead_id      bigint REFERENCES leads(id) ON DELETE SET NULL,
  cpl          numeric(14,2),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 8) Task Management
CREATE TABLE IF NOT EXISTS tasks (
  id            bigserial PRIMARY KEY,
  title         text NOT NULL,
  description   text,
  assigned_to   bigint REFERENCES users(id) ON DELETE SET NULL,
  priority      text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
  deadline      timestamptz,
  created_by    bigint REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_comments (
  id          bigserial PRIMARY KEY,
  task_id     bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id   bigint REFERENCES users(id) ON DELETE SET NULL,
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 9) Support & Ticketing
CREATE TABLE IF NOT EXISTS tickets (
  id           bigserial PRIMARY KEY,
  category     text NOT NULL CHECK (category IN ('technical','visa_delay','fee_issue','other')),
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open','review','resolved')),
  title        text NOT NULL,
  description  text,
  created_by   bigint REFERENCES users(id) ON DELETE SET NULL,
  assigned_to  bigint REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ticket_comments (
  id          bigserial PRIMARY KEY,
  ticket_id   bigint NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id   bigint REFERENCES users(id) ON DELETE SET NULL,
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 10) Activity Log (generic)
CREATE TABLE IF NOT EXISTS activity_log (
  id          bigserial PRIMARY KEY,
  actor_id    bigint REFERENCES users(id) ON DELETE SET NULL,
  entity      text NOT NULL,  -- e.g., 'lead','task','ticket'
  entity_id   bigint,
  action      text NOT NULL,  -- e.g., 'create','update','delete','comment'
  detail      jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Triggers for updated_at
CREATE TRIGGER trg_roles_updated     BEFORE UPDATE ON roles     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated     BEFORE UPDATE ON users     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_permissions_upd   BEFORE UPDATE ON permissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_universities_upd  BEFORE UPDATE ON universities FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_leads_updated     BEFORE UPDATE ON leads     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_batches_updated   BEFORE UPDATE ON batches   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_students_updated  BEFORE UPDATE ON students  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_enrollments_upd   BEFORE UPDATE ON enrollments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_timetable_upd     BEFORE UPDATE ON timetable FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_employees_upd     BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_leaves_upd        BEFORE UPDATE ON leaves    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_campaigns_upd     BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tasks_upd         BEFORE UPDATE ON tasks     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tickets_upd       BEFORE UPDATE ON tickets   FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes (high-value)
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_batch ON enrollments(batch_id);

-- Seed roles
INSERT INTO roles (name, description) VALUES
  ('superadmin','Full system access'),
  ('counselor','Manages student leads and applications'),
  ('hr','HR recruitment and onboarding'),
  ('teacher','Class schedules and performance'),
  ('accountant','Payroll and financial records'),
  ('employee','General employee access'),
  ('support','Manage support tickets'),
  ('partner','B2B partner limited access')
ON CONFLICT (name) DO NOTHING;

-- Seed 3 superadmins (bcrypt-hashed passwords)
INSERT INTO users (name, email, password_hash)
VALUES
  ('Super Admin 1','snakeyes358@gmail.com', crypt('Useless19112004', gen_salt('bf'))),
  ('Super Admin 2','abubaker0818@gmail.com', crypt('bakar9876', gen_salt('bf'))),
  ('Super Admin 3','mubarikali541@gmail.com', crypt('mubarak3456', gen_salt('bf')))
ON CONFLICT (email) DO NOTHING;

-- Attach superadmin role
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u CROSS JOIN roles r
WHERE u.email IN ('snakeyes358@gmail.com','abubaker0818@gmail.com','mubarikali541@gmail.com')
  AND r.name = 'superadmin'
ON CONFLICT DO NOTHING;

-- === Supabase Auth link & RLS helpers ===
-- Link app users to Supabase auth (optional FK if auth.users exists)
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id uuid UNIQUE;

DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_auth_fk'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_auth_fk FOREIGN KEY (auth_id)
      REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Current app user (maps from auth.uid() to local users.id)
CREATE OR REPLACE FUNCTION current_app_user_id()
RETURNS bigint LANGUAGE plpgsql STABLE AS $$
DECLARE rid bigint;
BEGIN
  SELECT u.id INTO rid FROM users u WHERE u.auth_id = auth.uid();
  RETURN rid;
END; $$;

-- Role helpers
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE u.auth_id = auth.uid() AND r.name = 'superadmin'
  );
$$;

CREATE OR REPLACE FUNCTION is_role(role_name text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE u.auth_id = auth.uid() AND r.name = role_name
  );
$$;

-- Superadmin-only local user creation
CREATE OR REPLACE FUNCTION app_create_user_local(
  p_name     text,
  p_email    text,
  p_password text,
  p_role     text DEFAULT 'employee'
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id bigint;
BEGIN
  IF NOT is_superadmin() THEN
    RAISE EXCEPTION 'Only superadmin can create users';
  END IF;
  INSERT INTO users(name, email, password_hash)
  VALUES (p_name, p_email, crypt(p_password, gen_salt('bf')))
  ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO new_id;

  INSERT INTO user_roles(user_id, role_id)
  SELECT new_id, r.id FROM roles r WHERE r.name = p_role
  ON CONFLICT DO NOTHING;

  RETURN new_id;
END; $$;

-- Enable RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE universities ENABLE ROW LEVEL SECURITY;

-- Superadmin policies (restrictive by default)
CREATE POLICY roles_sel_superadmin ON roles FOR SELECT USING (is_superadmin());
CREATE POLICY roles_ins_superadmin ON roles FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY roles_upd_superadmin ON roles FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY roles_del_superadmin ON roles FOR DELETE USING (is_superadmin());

CREATE POLICY users_sel_superadmin ON users FOR SELECT USING (is_superadmin());
CREATE POLICY users_ins_superadmin ON users FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY users_upd_superadmin ON users FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY users_del_superadmin ON users FOR DELETE USING (is_superadmin());

CREATE POLICY user_roles_sel_superadmin ON user_roles FOR SELECT USING (is_superadmin());
CREATE POLICY user_roles_ins_superadmin ON user_roles FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY user_roles_upd_superadmin ON user_roles FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY user_roles_del_superadmin ON user_roles FOR DELETE USING (is_superadmin());

CREATE POLICY permissions_sel_superadmin ON permissions FOR SELECT USING (is_superadmin());
CREATE POLICY permissions_ins_superadmin ON permissions FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY permissions_upd_superadmin ON permissions FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY permissions_del_superadmin ON permissions FOR DELETE USING (is_superadmin());

CREATE POLICY role_permissions_sel_superadmin ON role_permissions FOR SELECT USING (is_superadmin());
CREATE POLICY role_permissions_ins_superadmin ON role_permissions FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY role_permissions_upd_superadmin ON role_permissions FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY role_permissions_del_superadmin ON role_permissions FOR DELETE USING (is_superadmin());

CREATE POLICY universities_sel_superadmin ON universities FOR SELECT USING (is_superadmin());
CREATE POLICY universities_ins_superadmin ON universities FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY universities_upd_superadmin ON universities FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY universities_del_superadmin ON universities FOR DELETE USING (is_superadmin());

-- Enable RLS for remaining domain tables
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;

ALTER TABLE b2b_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Superadmin-only access policies (default deny for others; extend later per role)
-- Leads
CREATE POLICY leads_sel_superadmin ON leads FOR SELECT USING (is_superadmin());
CREATE POLICY leads_ins_superadmin ON leads FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY leads_upd_superadmin ON leads FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY leads_del_superadmin ON leads FOR DELETE USING (is_superadmin());

-- Lead documents
CREATE POLICY lead_docs_sel_superadmin ON lead_documents FOR SELECT USING (is_superadmin());
CREATE POLICY lead_docs_ins_superadmin ON lead_documents FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY lead_docs_upd_superadmin ON lead_documents FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY lead_docs_del_superadmin ON lead_documents FOR DELETE USING (is_superadmin());

-- Lead timeline
CREATE POLICY lead_timeline_sel_superadmin ON lead_timeline FOR SELECT USING (is_superadmin());
CREATE POLICY lead_timeline_ins_superadmin ON lead_timeline FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY lead_timeline_upd_superadmin ON lead_timeline FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY lead_timeline_del_superadmin ON lead_timeline FOR DELETE USING (is_superadmin());

-- Coaching
CREATE POLICY batches_sel_superadmin ON batches FOR SELECT USING (is_superadmin());
CREATE POLICY batches_ins_superadmin ON batches FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY batches_upd_superadmin ON batches FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY batches_del_superadmin ON batches FOR DELETE USING (is_superadmin());

CREATE POLICY students_sel_superadmin ON students FOR SELECT USING (is_superadmin());
CREATE POLICY students_ins_superadmin ON students FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY students_upd_superadmin ON students FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY students_del_superadmin ON students FOR DELETE USING (is_superadmin());

CREATE POLICY enrollments_sel_superadmin ON enrollments FOR SELECT USING (is_superadmin());
CREATE POLICY enrollments_ins_superadmin ON enrollments FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY enrollments_upd_superadmin ON enrollments FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY enrollments_del_superadmin ON enrollments FOR DELETE USING (is_superadmin());

CREATE POLICY timetable_sel_superadmin ON timetable FOR SELECT USING (is_superadmin());
CREATE POLICY timetable_ins_superadmin ON timetable FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY timetable_upd_superadmin ON timetable FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY timetable_del_superadmin ON timetable FOR DELETE USING (is_superadmin());

CREATE POLICY attendance_sel_superadmin ON attendance FOR SELECT USING (is_superadmin());
CREATE POLICY attendance_ins_superadmin ON attendance FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY attendance_upd_superadmin ON attendance FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY attendance_del_superadmin ON attendance FOR DELETE USING (is_superadmin());

CREATE POLICY performance_sel_superadmin ON performance FOR SELECT USING (is_superadmin());
CREATE POLICY performance_ins_superadmin ON performance FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY performance_upd_superadmin ON performance FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY performance_del_superadmin ON performance FOR DELETE USING (is_superadmin());

-- Employees & HR
CREATE POLICY employees_sel_superadmin ON employees FOR SELECT USING (is_superadmin());
CREATE POLICY employees_ins_superadmin ON employees FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY employees_upd_superadmin ON employees FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY employees_del_superadmin ON employees FOR DELETE USING (is_superadmin());

-- Relaxed employees policies for authenticated users (keep superadmin policies too)
CREATE POLICY employees_sel_auth ON employees FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY employees_ins_auth ON employees FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY employees_upd_auth ON employees FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);


CREATE POLICY emp_att_sel_superadmin ON employee_attendance FOR SELECT USING (is_superadmin());
CREATE POLICY emp_att_ins_superadmin ON employee_attendance FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY emp_att_upd_superadmin ON employee_attendance FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY emp_att_del_superadmin ON employee_attendance FOR DELETE USING (is_superadmin());

CREATE POLICY leaves_sel_superadmin ON leaves FOR SELECT USING (is_superadmin());
CREATE POLICY leaves_ins_superadmin ON leaves FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY leaves_upd_superadmin ON leaves FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY leaves_del_superadmin ON leaves FOR DELETE USING (is_superadmin());

CREATE POLICY payroll_sel_superadmin ON payroll FOR SELECT USING (is_superadmin());
CREATE POLICY payroll_ins_superadmin ON payroll FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY payroll_upd_superadmin ON payroll FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY payroll_del_superadmin ON payroll FOR DELETE USING (is_superadmin());

-- Accounts
CREATE POLICY acct_sel_superadmin ON accounts_transactions FOR SELECT USING (is_superadmin());
CREATE POLICY acct_ins_superadmin ON accounts_transactions FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY acct_upd_superadmin ON accounts_transactions FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY acct_del_superadmin ON accounts_transactions FOR DELETE USING (is_superadmin());

-- Vouchers (temporary: allow any authenticated user; avoids recursion on is_superadmin during RLS eval)
DROP POLICY IF EXISTS vch_sel_superadmin ON vouchers;
DROP POLICY IF EXISTS vch_ins_superadmin ON vouchers;
DROP POLICY IF EXISTS vch_upd_superadmin ON vouchers;
DROP POLICY IF EXISTS vch_del_superadmin ON vouchers;
CREATE POLICY vch_sel_auth ON vouchers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY vch_ins_auth ON vouchers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY vch_upd_auth ON vouchers FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY vch_del_auth ON vouchers FOR DELETE USING (auth.uid() IS NOT NULL);

-- Dashboard Cases (for realtime dashboards)
CREATE TABLE IF NOT EXISTS dashboard_cases (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number  text NOT NULL UNIQUE,
  title        text NOT NULL,
  type         text NOT NULL DEFAULT 'Visa' CHECK (type IN ('Visa','Fee','CAS','Completed')),
  status       text NOT NULL DEFAULT 'Initial Stage' CHECK (status IN ('Initial Stage','Offer Applied','Offer Received','Fee Paid','Interview','CAS Applied','CAS Received','Visa Applied','Visa Received','Backout','Visa Rejected')),
  branch       text,
  employee     text,
  all_tasks    int  NOT NULL DEFAULT 0,
  active_tasks int  NOT NULL DEFAULT 0,
  assignees    jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dashboard_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY dash_cases_sel_auth ON dashboard_cases FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY dash_cases_ins_auth ON dashboard_cases FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY dash_cases_upd_auth ON dashboard_cases FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY dash_cases_del_auth ON dashboard_cases FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_dashboard_cases_created_at ON dashboard_cases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_cases_branch ON dashboard_cases(branch);
CREATE INDEX IF NOT EXISTS idx_dashboard_cases_status ON dashboard_cases(status);
CREATE INDEX IF NOT EXISTS idx_dashboard_cases_type ON dashboard_cases(type);



-- B2B
CREATE POLICY b2b_sel_superadmin ON b2b_accounts FOR SELECT USING (is_superadmin());
CREATE POLICY b2b_ins_superadmin ON b2b_accounts FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY b2b_upd_superadmin ON b2b_accounts FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY b2b_del_superadmin ON b2b_accounts FOR DELETE USING (is_superadmin());

CREATE POLICY partner_leads_sel_superadmin ON partner_leads FOR SELECT USING (is_superadmin());
CREATE POLICY partner_leads_ins_superadmin ON partner_leads FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY partner_leads_upd_superadmin ON partner_leads FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY partner_leads_del_superadmin ON partner_leads FOR DELETE USING (is_superadmin());

-- Marketing
CREATE POLICY campaigns_sel_superadmin ON campaigns FOR SELECT USING (is_superadmin());
CREATE POLICY campaigns_ins_superadmin ON campaigns FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY campaigns_upd_superadmin ON campaigns FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY campaigns_del_superadmin ON campaigns FOR DELETE USING (is_superadmin());

CREATE POLICY mkt_leads_sel_superadmin ON marketing_leads FOR SELECT USING (is_superadmin());
CREATE POLICY mkt_leads_ins_superadmin ON marketing_leads FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY mkt_leads_upd_superadmin ON marketing_leads FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY mkt_leads_del_superadmin ON marketing_leads FOR DELETE USING (is_superadmin());

-- Tasks
CREATE POLICY tasks_sel_superadmin ON tasks FOR SELECT USING (is_superadmin());
CREATE POLICY tasks_ins_superadmin ON tasks FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY tasks_upd_superadmin ON tasks FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY tasks_del_superadmin ON tasks FOR DELETE USING (is_superadmin());

CREATE POLICY task_comments_sel_superadmin ON task_comments FOR SELECT USING (is_superadmin());
CREATE POLICY task_comments_ins_superadmin ON task_comments FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY task_comments_upd_superadmin ON task_comments FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY task_comments_del_superadmin ON task_comments FOR DELETE USING (is_superadmin());

-- Tickets
CREATE POLICY tickets_sel_superadmin ON tickets FOR SELECT USING (is_superadmin());
CREATE POLICY tickets_ins_superadmin ON tickets FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY tickets_upd_superadmin ON tickets FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY tickets_del_superadmin ON tickets FOR DELETE USING (is_superadmin());

CREATE POLICY ticket_comments_sel_superadmin ON ticket_comments FOR SELECT USING (is_superadmin());
CREATE POLICY ticket_comments_ins_superadmin ON ticket_comments FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY ticket_comments_upd_superadmin ON ticket_comments FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY ticket_comments_del_superadmin ON ticket_comments FOR DELETE USING (is_superadmin());

-- Allow authenticated users to read/insert employee-related activity logs
CREATE POLICY actlog_sel_auth_employee ON activity_log FOR SELECT USING (auth.uid() IS NOT NULL AND entity = 'employee');
CREATE POLICY actlog_ins_auth_employee ON activity_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND entity = 'employee');


-- Activity log
CREATE POLICY actlog_sel_superadmin ON activity_log FOR SELECT USING (is_superadmin());
CREATE POLICY actlog_ins_superadmin ON activity_log FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY actlog_upd_superadmin ON activity_log FOR UPDATE USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY actlog_del_superadmin ON activity_log FOR DELETE USING (is_superadmin());

-- Helper functions for linking Supabase Auth and assigning roles
CREATE OR REPLACE FUNCTION app_link_auth_by_email(p_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE auid uuid;
BEGIN
  IF NOT is_superadmin() THEN
    RAISE EXCEPTION 'Only superadmin can link auth users';
  END IF;
  SELECT id INTO auid FROM auth.users WHERE email = p_email;
  IF auid IS NULL THEN
    RAISE EXCEPTION 'No auth user found with email: %', p_email;
  END IF;
  UPDATE users SET auth_id = auid WHERE email = p_email;
END; $$;

CREATE OR REPLACE FUNCTION app_assign_role(p_email text, p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid bigint; rid bigint;
BEGIN
  IF NOT is_superadmin() THEN
    RAISE EXCEPTION 'Only superadmin can assign roles';
  END IF;
  SELECT id INTO uid FROM users WHERE email = p_email;
  SELECT id INTO rid FROM roles WHERE name = p_role;
  IF uid IS NULL THEN RAISE EXCEPTION 'User not found: %', p_email; END IF;
  IF rid IS NULL THEN RAISE EXCEPTION 'Role not found: %', p_role; END IF;
  INSERT INTO user_roles(user_id, role_id) VALUES (uid, rid)
  ON CONFLICT DO NOTHING;
END; $$;

COMMIT;

