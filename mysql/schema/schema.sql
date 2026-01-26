-- ============================================================================
-- GSL CRM - MySQL Database Schema
-- Converted from Supabase PostgreSQL schema
-- ============================================================================

-- Create database (run separately if needed)
-- CREATE DATABASE IF NOT EXISTS gsl_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE gsl_crm;

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- 1. CORE TABLES - Users, Authentication, RBAC
-- ============================================================================

-- Dashboard Users (RBAC)
CREATE TABLE IF NOT EXISTS dashboard_users (
  id VARCHAR(255) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Active',
  permissions JSON NOT NULL DEFAULT ('[]'),
  branch VARCHAR(255) NULL,
  employee_id BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dashboard_users_email (email),
  INDEX idx_dashboard_users_role (role),
  INDEX idx_dashboard_users_status (status),
  INDEX idx_dashboard_users_branch (branch)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Permissions (granular module-level permissions)
CREATE TABLE IF NOT EXISTS user_permissions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL,
  module VARCHAR(100) NOT NULL,
  access BOOLEAN NOT NULL DEFAULT TRUE,
  can_add BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_module (user_email, module),
  INDEX idx_user_permissions_email (user_email),
  INDEX idx_user_permissions_module (module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Reporting Hierarchy
CREATE TABLE IF NOT EXISTS user_reporting_hierarchy (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL,
  reports_to_email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_hierarchy_user (user_email),
  INDEX idx_hierarchy_reports_to (reports_to_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. BRANCHES
-- ============================================================================

CREATE TABLE IF NOT EXISTS branches (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  location VARCHAR(255),
  manager_email VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'Active',
  created_by_email VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_branches_name (name),
  INDEX idx_branches_manager (manager_email),
  INDEX idx_branches_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. LEADS & UNIVERSITIES
-- ============================================================================

-- Universities
CREATE TABLE IF NOT EXISTS universities (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(500) NOT NULL,
  country VARCHAR(100),
  ranking INT,
  notes TEXT,
  affiliation_type VARCHAR(100),
  website VARCHAR(500),
  address TEXT,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_universities_name (name),
  INDEX idx_universities_country (country),
  INDEX idx_universities_affiliation (affiliation_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Leads
CREATE TABLE IF NOT EXISTS leads (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  source VARCHAR(50) CHECK (source IN ('facebook','instagram','google_form','walk_in','referral','organic')),
  status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN ('new','documentation','university','visa','enrolled','rejected')),
  stage VARCHAR(100),
  assigned_to_email VARCHAR(255),
  university_id BIGINT,
  tags JSON,
  remarks TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE SET NULL,
  INDEX idx_leads_status (status),
  INDEX idx_leads_stage (stage),
  INDEX idx_leads_assigned_to (assigned_to_email),
  INDEX idx_leads_email_phone (email, phone),
  INDEX idx_leads_university (university_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lead Documents
CREATE TABLE IF NOT EXISTS lead_documents (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  lead_id BIGINT NOT NULL,
  doc_type VARCHAR(100) NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by_email VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  INDEX idx_lead_documents_lead (lead_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lead Timeline
CREATE TABLE IF NOT EXISTS lead_timeline (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  lead_id BIGINT NOT NULL,
  action VARCHAR(255) NOT NULL,
  detail TEXT,
  created_by_email VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  INDEX idx_lead_timeline_lead (lead_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Public Lead Form Submissions
CREATE TABLE IF NOT EXISTS public_lead_submissions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  country_of_interest VARCHAR(100),
  program_of_interest VARCHAR(255),
  message TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'new',
  converted_to_lead_id BIGINT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (converted_to_lead_id) REFERENCES leads(id) ON DELETE SET NULL,
  INDEX idx_public_leads_status (status),
  INDEX idx_public_leads_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. STUDENTS & CASES
-- ============================================================================

-- Dashboard Services/Programs
CREATE TABLE IF NOT EXISTS dashboard_services (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  description TEXT,
  price DECIMAL(12,2),
  duration_weeks INT CHECK (duration_weeks >= 0),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_dashboard_services_name (name),
  INDEX idx_dashboard_services_type (type),
  INDEX idx_dashboard_services_price (price)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dashboard Students
CREATE TABLE IF NOT EXISTS dashboard_students (
  id VARCHAR(255) PRIMARY KEY,
  program_title VARCHAR(255),
  batch_no VARCHAR(100),
  full_name VARCHAR(255) NOT NULL,
  father_name VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  cnic VARCHAR(50),
  dob VARCHAR(50),
  city VARCHAR(100),
  reference VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Completed','Withdrawn')),
  photo_url TEXT,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  enrollment_type VARCHAR(50),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dashboard_students_program (program_title),
  INDEX idx_dashboard_students_batch (batch_no),
  INDEX idx_dashboard_students_status (status),
  INDEX idx_dashboard_students_archived (archived)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Student Academics
CREATE TABLE IF NOT EXISTS dashboard_student_academics (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(255) NOT NULL,
  serial INT NOT NULL,
  degree_name VARCHAR(255),
  grade VARCHAR(50),
  year VARCHAR(50),
  institute VARCHAR(255),
  FOREIGN KEY (student_id) REFERENCES dashboard_students(id) ON DELETE CASCADE,
  INDEX idx_student_academics_student (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Student Experiences
CREATE TABLE IF NOT EXISTS dashboard_student_experiences (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(255) NOT NULL,
  serial INT NOT NULL,
  org VARCHAR(255),
  designation VARCHAR(255),
  period VARCHAR(100),
  FOREIGN KEY (student_id) REFERENCES dashboard_students(id) ON DELETE CASCADE,
  INDEX idx_student_experiences_student (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Student Mock Tests
CREATE TABLE IF NOT EXISTS student_mock_tests (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(255) NOT NULL,
  test_type VARCHAR(50) NOT NULL,
  test_date DATE,
  score VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES dashboard_students(id) ON DELETE CASCADE,
  INDEX idx_mock_tests_student (student_id),
  INDEX idx_mock_tests_type (test_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dashboard Cases
CREATE TABLE IF NOT EXISTS dashboard_cases (
  id CHAR(36) PRIMARY KEY,
  case_number VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(500) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'Visa' CHECK (type IN ('Visa','Fee','CAS','Completed')),
  status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','In Progress','Completed')),
  stage VARCHAR(100),
  branch VARCHAR(255),
  employee VARCHAR(255),
  all_tasks INT NOT NULL DEFAULT 0,
  active_tasks INT NOT NULL DEFAULT 0,
  assignees JSON,
  student_info JSON NOT NULL DEFAULT ('{}'),
  university_id BIGINT,
  enrollment_status VARCHAR(50),
  google_drive_folder_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE SET NULL,
  INDEX idx_cases_status (status),
  INDEX idx_cases_stage (stage),
  INDEX idx_cases_branch (branch),
  INDEX idx_cases_university (university_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Application History
CREATE TABLE IF NOT EXISTS application_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  case_id CHAR(36) NOT NULL,
  university_id BIGINT,
  university_name VARCHAR(500),
  program VARCHAR(255),
  intake VARCHAR(50),
  application_status VARCHAR(50),
  notes TEXT,
  created_by_email VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES dashboard_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE SET NULL,
  INDEX idx_app_history_case (case_id),
  INDEX idx_app_history_university (university_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. TEACHERS & ATTENDANCE
-- ============================================================================

-- Dashboard Teachers
CREATE TABLE IF NOT EXISTS dashboard_teachers (
  id VARCHAR(255) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50),
  cnic VARCHAR(50),
  status VARCHAR(50) NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_teachers_email (email),
  INDEX idx_teachers_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Teacher Assignments
CREATE TABLE IF NOT EXISTS dashboard_teacher_assignments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  teacher_id VARCHAR(255) NOT NULL,
  service_id VARCHAR(255),
  service_name VARCHAR(255),
  batch_no VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES dashboard_teachers(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES dashboard_services(id) ON DELETE SET NULL,
  INDEX idx_teacher_assignments_teacher (teacher_id),
  INDEX idx_teacher_assignments_service (service_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Teacher-Student Assignments
CREATE TABLE IF NOT EXISTS teacher_student_assignments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  teacher_id VARCHAR(255) NOT NULL,
  student_id VARCHAR(255) NOT NULL,
  service_id VARCHAR(255),
  batch_no VARCHAR(100),
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES dashboard_teachers(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES dashboard_students(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES dashboard_services(id) ON DELETE SET NULL,
  UNIQUE KEY unique_teacher_student (teacher_id, student_id),
  INDEX idx_tsa_teacher (teacher_id),
  INDEX idx_tsa_student (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dashboard Attendance
CREATE TABLE IF NOT EXISTS dashboard_attendance (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  teacher_id VARCHAR(255) NOT NULL,
  student_id VARCHAR(255) NOT NULL,
  attendance_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('Present','Absent','Late')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_attendance (teacher_id, student_id, attendance_date),
  FOREIGN KEY (teacher_id) REFERENCES dashboard_teachers(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES dashboard_students(id) ON DELETE CASCADE,
  INDEX idx_attendance_teacher_date (teacher_id, attendance_date),
  INDEX idx_attendance_student_date (student_id, attendance_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Teachers Timetable
CREATE TABLE IF NOT EXISTS teachers_timetable (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  teacher_id VARCHAR(255) NOT NULL,
  day_of_week VARCHAR(20) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  service_id VARCHAR(255),
  batch_no VARCHAR(100),
  room VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES dashboard_teachers(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES dashboard_services(id) ON DELETE SET NULL,
  INDEX idx_timetable_teacher (teacher_id),
  INDEX idx_timetable_day (day_of_week)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Student Remarks
CREATE TABLE IF NOT EXISTS dashboard_student_remarks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  teacher_id VARCHAR(255) NOT NULL,
  student_id VARCHAR(255) NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES dashboard_teachers(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES dashboard_students(id) ON DELETE CASCADE,
  INDEX idx_remarks_teacher (teacher_id),
  INDEX idx_remarks_student (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Study Materials
CREATE TABLE IF NOT EXISTS dashboard_study_materials (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  teacher_id VARCHAR(255) NOT NULL,
  service_id VARCHAR(255),
  batch_no VARCHAR(100),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  file_url TEXT,
  link_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES dashboard_teachers(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES dashboard_services(id) ON DELETE SET NULL,
  INDEX idx_materials_teacher (teacher_id),
  INDEX idx_materials_service (service_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. TASKS & NOTIFICATIONS
-- ============================================================================

-- Dashboard Tasks
CREATE TABLE IF NOT EXISTS dashboard_tasks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  case_id CHAR(36),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  priority VARCHAR(50),
  status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  deadline TIMESTAMP,
  assigned_to_email VARCHAR(255),
  assignee_id VARCHAR(255),
  created_by_email VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES dashboard_cases(id) ON DELETE CASCADE,
  INDEX idx_tasks_case (case_id),
  INDEX idx_tasks_status (status),
  INDEX idx_tasks_assigned_to (assigned_to_email),
  INDEX idx_tasks_assignee (assignee_id),
  INDEX idx_tasks_deadline (deadline)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'info',
  related_entity VARCHAR(100),
  related_id VARCHAR(255),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_user (user_email),
  INDEX idx_notifications_read (is_read),
  INDEX idx_notifications_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Messenger (internal messaging)
CREATE TABLE IF NOT EXISTS messenger (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  from_email VARCHAR(255) NOT NULL,
  to_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_messenger_from (from_email),
  INDEX idx_messenger_to (to_email),
  INDEX idx_messenger_read (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. HRM - EMPLOYEES, ATTENDANCE, PAYROLL, LEAVES
-- ============================================================================

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNIQUE,
  dashboard_user_id VARCHAR(255),
  full_name VARCHAR(255),
  email VARCHAR(255),
  role_title VARCHAR(255),
  department VARCHAR(100),
  joined_on DATE,
  salary DECIMAL(12,2),
  status VARCHAR(50) NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_employees_email (email),
  INDEX idx_employees_department (department),
  INDEX idx_employees_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Employee Time Records
CREATE TABLE IF NOT EXISTS employee_time_records (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  employee_id BIGINT NOT NULL,
  record_date DATE NOT NULL,
  clock_in TIMESTAMP,
  clock_out TIMESTAMP,
  total_hours DECIMAL(5,2),
  status VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  INDEX idx_time_records_employee (employee_id),
  INDEX idx_time_records_date (record_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payroll
CREATE TABLE IF NOT EXISTS payroll (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  employee_id BIGINT NOT NULL,
  pay_period_start DATE NOT NULL,
  pay_period_end DATE NOT NULL,
  base_salary DECIMAL(12,2) NOT NULL,
  bonuses DECIMAL(12,2) DEFAULT 0,
  deductions DECIMAL(12,2) DEFAULT 0,
  net_pay DECIMAL(12,2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  paid_on DATE,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  INDEX idx_payroll_employee (employee_id),
  INDEX idx_payroll_period (pay_period_start, pay_period_end),
  INDEX idx_payroll_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Leaves
CREATE TABLE IF NOT EXISTS leaves (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  employee_email VARCHAR(255) NOT NULL,
  leave_type VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  approved_by_email VARCHAR(255),
  created_by_email VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_leaves_employee (employee_email),
  INDEX idx_leaves_status (status),
  INDEX idx_leaves_dates (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Employee Onboarding
CREATE TABLE IF NOT EXISTS employee_onboarding (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  employee_id BIGINT NOT NULL,
  onboarding_status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  documents_submitted BOOLEAN DEFAULT FALSE,
  training_completed BOOLEAN DEFAULT FALSE,
  equipment_assigned BOOLEAN DEFAULT FALSE,
  notes TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  INDEX idx_onboarding_employee (employee_id),
  INDEX idx_onboarding_status (onboarding_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Employee Assets
CREATE TABLE IF NOT EXISTS employee_assets (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  employee_id BIGINT NOT NULL,
  asset_type VARCHAR(100) NOT NULL,
  asset_name VARCHAR(255) NOT NULL,
  asset_id VARCHAR(100),
  assigned_date DATE NOT NULL,
  returned_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'Assigned',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  INDEX idx_assets_employee (employee_id),
  INDEX idx_assets_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 8. FINANCE - ACCOUNTS, VOUCHERS, INVOICES, PAYMENTS
-- ============================================================================

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  account_code VARCHAR(50) NOT NULL UNIQUE,
  account_name VARCHAR(255) NOT NULL,
  account_type VARCHAR(50) NOT NULL,
  parent_account_id BIGINT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_account_id) REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  INDEX idx_accounts_type (account_type),
  INDEX idx_accounts_code (account_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vouchers
CREATE TABLE IF NOT EXISTS vouchers (
  id CHAR(36) PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  vtype VARCHAR(50) NOT NULL CHECK (vtype IN ('cash_in','cash_out','online','bank','transfer')),
  amount DECIMAL(14,2) NOT NULL,
  branch VARCHAR(255) NOT NULL,
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  description TEXT,
  pdf_url TEXT,
  created_by_email VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vouchers_branch (branch),
  INDEX idx_vouchers_status (status),
  INDEX idx_vouchers_type (vtype)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(100) NOT NULL UNIQUE,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255),
  total_amount DECIMAL(14,2) NOT NULL,
  paid_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  due_date DATE,
  branch VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_invoices_customer (customer_email),
  INDEX idx_invoices_status (status),
  INDEX idx_invoices_branch (branch)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Invoice Items
CREATE TABLE IF NOT EXISTS invoice_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  invoice_id BIGINT NOT NULL,
  description VARCHAR(500) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  total_price DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  INDEX idx_invoice_items_invoice (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  invoice_id BIGINT,
  payment_method VARCHAR(50) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  payment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reference_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  INDEX idx_payments_invoice (invoice_id),
  INDEX idx_payments_date (payment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 9. REPORTS & INFO
-- ============================================================================

-- Dashboard Reports
CREATE TABLE IF NOT EXISTS dashboard_reports (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  report_name VARCHAR(255) NOT NULL,
  report_type VARCHAR(100) NOT NULL,
  generated_by_email VARCHAR(255),
  file_url TEXT,
  parameters JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reports_type (report_type),
  INDEX idx_reports_generated_by (generated_by_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Info Posts (announcements, news)
CREATE TABLE IF NOT EXISTS info_posts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  author_email VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_info_posts_author (author_email),
  INDEX idx_info_posts_category (category),
  INDEX idx_info_posts_published (is_published)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 10. ACTIVITY LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS activity_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_email VARCHAR(255),
  entity VARCHAR(100) NOT NULL,
  entity_id VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  detail JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_activity_actor (actor_email),
  INDEX idx_activity_entity (entity, entity_id),
  INDEX idx_activity_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 11. AUTHENTICATION (if not using Supabase Auth)
-- ============================================================================

-- User Authentication (only if doing full migration)
CREATE TABLE IF NOT EXISTS user_auth (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  salt VARCHAR(255) NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_token VARCHAR(255),
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMP,
  last_login TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_auth_email (email),
  INDEX idx_user_auth_verification (verification_token),
  INDEX idx_user_auth_reset (reset_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Sessions (JWT tokens)
CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sessions_user (user_email),
  INDEX idx_sessions_token (token_hash),
  INDEX idx_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
