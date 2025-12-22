-- Vouchers PDF URL, branch_id, and pending_students view (2025-11-15)
-- Idempotent: additive ALTERs and CREATE OR REPLACE VIEW only

begin;

-- 1) Vouchers table: enrich with student/fees metadata and PDF storage
alter table if exists public.vouchers
  add column if not exists student_id text references public.dashboard_students(id) on delete set null,
  add column if not exists voucher_type text,
  add column if not exists service_type text,
  -- amount column already exists; reuse it as the main voucher amount
  add column if not exists discount numeric(14,2),
  add column if not exists amount_paid numeric(14,2),
  add column if not exists amount_unpaid numeric(14,2),
  add column if not exists due_date date,
  add column if not exists pdf_url text,
  add column if not exists branch_id uuid;

create index if not exists idx_vouchers_student on public.vouchers(student_id);
create index if not exists idx_vouchers_branch_id on public.vouchers(branch_id);
create index if not exists idx_vouchers_due_date on public.vouchers(due_date);

-- 2) Optional: fee tracking columns on core students table (coaching module)
--   These are kept separate from dashboard_students, which already uses invoices
alter table if exists public.students
  add column if not exists total_fee numeric,
  add column if not exists amount_paid numeric,
  add column if not exists amount_unpaid numeric,
  add column if not exists next_due_date date;

-- 3) Pending students view (dashboard_students + invoices)
--   Exposes students who still have remaining_amount > 0 on any invoice
--   and aggregates their total/paid/remaining + nearest due date.
create or replace view public.pending_students as
select
  s.id                          as student_id,
  s.id                          as registration_no,
  s.full_name,
  s.batch_no,
  s.program_title,
  s.phone,
  sum(i.total_amount)           as total_fee,
  sum(i.amount_paid)           as amount_paid,
  sum(i.remaining_amount)      as remaining_amount,
  sum(i.discount)              as total_discount,
  min(i.due_date) filter (where i.remaining_amount > 0 and i.due_date is not null) as next_due_date
from public.dashboard_students s
join public.invoices i
  on i.student_id = s.id
where i.payment_status in ('Unpaid','Partially Paid')
group by s.id, s.full_name, s.batch_no, s.program_title, s.phone
having sum(i.remaining_amount) > 0;

commit;

