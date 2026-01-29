-- ============================================================================
-- GSL CRM - MySQL Database Schema
-- Converted from Supabase PostgreSQL to MySQL
-- ============================================================================

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS gsl_crm
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE gsl_crm;

-- ============================================================================
-- 1. RBAC & User Management
-- ============================================================================

-- Dashboard Users (Application-level users for RBAC)
CREATE TABLE IF NOT EXISTS dashboard_users (
  id VARCHAR(255) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(50) NOT NULL COMMENT 'Super Admin, Admin, Counsellor, Staff, etc.',
  status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  permissions JSON NOT NULL DEFAULT ('[]') COMMENT 'Array of allowed tab IDs',
  
  -- Employee fields
  employee_id VARCHAR(50),
  department VARCHAR(100),
  designation VARCHAR(100),
  joining_date DATE,
  salary DECIMAL(12,2),
  phone VARCHAR(20),
  address TEXT,
  emergency_contact VARCHAR(20),
  blood_group VARCHAR(10),
  profile_photo_url TEXT,
  
  -- Branch assignment
  branch_id BIGINT,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_status (status),
  INDEX idx_branch_id (branch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='RBAC user registry with permissions and employee data';

-- ============================================================================
-- 2. Branch Management
-- ============================================================================

CREATE TABLE IF NOT EXISTS branches (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE,
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(255),
  manager_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_by VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_name (name),
  INDEX idx_code (code),
  INDEX idx_status (status),
  INDEX idx_manager_id (manager_id),
  FOREIGN KEY (manager_id) REFERENCES dashboard_users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES dashboard_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign key for branch_id in dashboard_users
ALTER TABLE dashboard_users
  ADD CONSTRAINT fk_user_branch
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;

-- ============================================================================
-- 3. Services & Products
-- ============================================================================

CREATE TABLE IF NOT EXISTS dashboard_services (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  description TEXT,
  price DECIMAL(12,2),
  duration_weeks INT CHECK (duration_weeks >= 0),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE INDEX uq_name (name),
  INDEX idx_type (type),
  INDEX idx_price (price)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. Students Management
-- ============================================================================

CREATE TABLE IF NOT EXISTS dashboard_students (
  id VARCHAR(255) PRIMARY KEY COMMENT 'e.g., STxxxxxxxx',
  program_title VARCHAR(255),
  batch_no VARCHAR(50),
  full_name VARCHAR(255) NOT NULL,
  father_name VARCHAR(255),
  phone VARCHAR(20),
  email VARCHAR(255),
  cnic VARCHAR(20),
  dob VARCHAR(20),
  city VARCHAR(100),
  reference VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Completed','Withdrawn')),
  photo_url TEXT,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Additional fields
  enrollment_type VARCHAR(50),
  enrollment_date DATE,
  expected_completion_date DATE,
  
  branch_id BIGINT,
  created_by VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_full_name (full_name),
  INDEX idx_email (email),
  INDEX idx_phone (phone),
  INDEX idx_status (status),
  INDEX idx_branch_id (branch_id),
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES dashboard_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. Universities & Leads
-- ============================================================================

CREATE TABLE IF NOT EXISTS universities (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(500) NOT NULL,
  country VARCHAR(100),
  ranking INT,
  notes TEXT,
  
  -- Extended fields
  city VARCHAR(100),
  website VARCHAR(500),
  type VARCHAR(50) COMMENT 'Public, Private, etc.',
  established_year INT,
  acceptance_rate DECIMAL(5,2),
  tuition_fee_range VARCHAR(100),
  popular_programs TEXT,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_name (name(255)),
  INDEX idx_country (country)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leads (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20) NOT NULL,
  country VARCHAR(100),
  city VARCHAR(100),
  source VARCHAR(100) COMMENT 'Website, Referral, Social Media, etc.',
  status VARCHAR(50) DEFAULT 'New' COMMENT 'New, Contacted, Qualified, Lost, Converted',
  stage VARCHAR(50) COMMENT 'Lead stage in pipeline',
  notes TEXT,
  remarks TEXT,
  
  assigned_to VARCHAR(255),
  branch_id BIGINT,
  created_by VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_full_name (full_name),
  INDEX idx_email (email),
  INDEX idx_phone (phone),
  INDEX idx_status (status),
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_branch_id (branch_id),
  FOREIGN KEY (assigned_to) REFERENCES dashboard_users(id) ON DELETE SET NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES dashboard_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. Cases & Applications
-- ============================================================================

CREATE TABLE IF NOT EXISTS dashboard_cases (
  id VARCHAR(255) PRIMARY KEY,
  student_id VARCHAR(255),
  student_name VARCHAR(255),
  student_email VARCHAR(255),
  student_phone VARCHAR(20),
  
  service_id VARCHAR(255),
  service_name VARCHAR(255),
  
  status VARCHAR(50) NOT NULL DEFAULT 'Open',
  stage VARCHAR(50) COMMENT 'Application stage',
  priority VARCHAR(20) DEFAULT 'Medium' CHECK (priority IN ('Low','Medium','High','Urgent')),
  
  description TEXT,
  notes TEXT,
  
  -- University application
  university_id BIGINT,
  program VARCHAR(255),
  enrollment_status VARCHAR(50),
  google_drive_folder_url TEXT,
  
  assigned_to VARCHAR(255),
  branch_id BIGINT,
  created_by VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_student_id (student_id),
  INDEX idx_status (status),
  INDEX idx_stage (stage),
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_branch_id (branch_id),
  INDEX idx_university_id (university_id),
  FOREIGN KEY (student_id) REFERENCES dashboard_students(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES dashboard_services(id) ON DELETE SET NULL,
  FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to) REFERENCES dashboard_users(id) ON DELETE SET NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES dashboard_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Application History
CREATE TABLE IF NOT EXISTS application_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  case_id VARCHAR(255) NOT NULL,
  old_stage VARCHAR(50),
  new_stage VARCHAR(50) NOT NULL,
  changed_by VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_case_id (case_id),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (case_id) REFERENCES dashboard_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES dashboard_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- University Application Tracking
CREATE TABLE IF NOT EXISTS university_applications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  case_id VARCHAR(255) NOT NULL,
  university_id BIGINT NOT NULL,
  program VARCHAR(255) NOT NULL,
  intake VARCHAR(50),
  application_date DATE,
  decision_date DATE,
  status VARCHAR(50) DEFAULT 'Pending',
  notes TEXT,
  
  created_by VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_case_id (case_id),
  INDEX idx_university_id (university_id),
  INDEX idx_status (status),
  FOREIGN KEY (case_id) REFERENCES dashboard_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES dashboard_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. Tasks & Notifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS dashboard_tasks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending','In Progress','Completed','Cancelled')),
  priority VARCHAR(20) DEFAULT 'Medium' CHECK (priority IN ('Low','Medium','High','Urgent')),
  due_date DATE,
  
  assigned_to VARCHAR(255),
  assignee_id VARCHAR(255),
  case_id VARCHAR(255),
  branch_id BIGINT,
  created_by VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  
  INDEX idx_status (status),
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_assignee_id (assignee_id),
  INDEX idx_case_id (case_id),
  INDEX idx_due_date (due_date),
  INDEX idx_branch_id (branch_id),
  FOREIGN KEY (case_id) REFERENCES dashboard_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES dashboard_users(id) ON DELETE SET NULL,
  FOREIGN KEY (assignee_id) REFERENCES dashboard_users(id) ON DELETE SET NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES dashboard_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL COMMENT 'task_assigned, case_updated, etc.',
  title VARCHAR(500) NOT NULL,
  message TEXT,
  link VARCHAR(500),
  is_read BOOLEAN DEFAULT FALSE,
  
  related_id VARCHAR(255) COMMENT 'ID of related entity (task, case, etc.)',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL,
  
  INDEX idx_user_id (user_id),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES dashboard_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 8. Messenger & Communication
-- ============================================================================

CREATE TABLE IF NOT EXISTS messenger_conversations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255),
  type VARCHAR(20) DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
  created_by VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_type (type),
  INDEX idx_created_by (created_by),
  FOREIGN KEY (created_by) REFERENCES dashboard_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messenger_participants (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE INDEX uq_conversation_user (conversation_id, user_id),
  INDEX idx_user_id (user_id),
  FOREIGN KEY (conversation_id) REFERENCES messenger_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES dashboard_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messenger_messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT NOT NULL,
  sender_id VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_conversation_id (conversation_id),
  INDEX idx_sender_id (sender_id),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (conversation_id) REFERENCES messenger_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES dashboard_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 9. HR Management
-- ============================================================================

-- Leaves
CREATE TABLE IF NOT EXISTS leaves (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  employee_id VARCHAR(255) NOT NULL,
  leave_type VARCHAR(50) NOT NULL COMMENT 'Sick, Casual, Annual, etc.',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INT NOT NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  
  approved_by VARCHAR(255),
  approved_at TIMESTAMP NULL,
  rejection_reason TEXT,
  
  branch_id BIGINT,
  created_by VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_employee_id (employee_id),
  INDEX idx_status (status),
  INDEX idx_start_date (start_date),
  INDEX idx_branch_id (branch_id),
  FOREIGN KEY (employee_id) REFERENCES dashboard_users(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES dashboard_users(id) ON DELETE SET NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES dashboard_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Time Records
CREATE TABLE IF NOT EXISTS time_records (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  employee_id VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  check_in TIMESTAMP,
  check_out TIMESTAMP,
  hours_worked DECIMAL(5,2),
  overtime_hours DECIMAL(5,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'Present',
  notes TEXT,
  
  branch_id BIGINT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE INDEX uq_employee_date (employee_id, date),
  INDEX idx_date (date),
  INDEX idx_branch_id (branch_id),
  FOREIGN KEY (employee_id) REFERENCES dashboard_users(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payroll
CREATE TABLE IF NOT EXISTS payroll (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  employee_id VARCHAR(255) NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INT NOT NULL,
  
  basic_salary DECIMAL(12,2) NOT NULL,
  allowances DECIMAL(12,2) DEFAULT 0,
  deductions DECIMAL(12,2) DEFAULT 0,
  overtime_pay DECIMAL(12,2) DEFAULT 0,
  bonus DECIMAL(12,2) DEFAULT 0,
  net_salary DECIMAL(12,2) NOT NULL,
  
  status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending','Processed','Paid')),
  payment_date DATE,
  notes TEXT,
  
  branch_id BIGINT,
  created_by VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE INDEX uq_employee_month_year (employee_id, month, year),
  INDEX idx_status (status),
  INDEX idx_branch_id (branch_id),
  FOREIGN KEY (employee_id) REFERENCES dashboard_users(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES dashboard_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 10. Content & Information
-- ============================================================================

CREATE TABLE IF NOT EXISTS info_posts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100),
  tags JSON,
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP NULL,
  
  author_id VARCHAR(255),
  branch_id BIGINT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_category (category),
  INDEX idx_is_published (is_published),
  INDEX idx_author_id (author_id),
  INDEX idx_branch_id (branch_id),
  FOREIGN KEY (author_id) REFERENCES dashboard_users(id) ON DELETE SET NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS study_materials (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50),
  category VARCHAR(100),
  tags JSON,
  
  uploaded_by VARCHAR(255),
  branch_id BIGINT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_category (category),
  INDEX idx_uploaded_by (uploaded_by),
  INDEX idx_branch_id (branch_id),
  FOREIGN KEY (uploaded_by) REFERENCES dashboard_users(id) ON DELETE SET NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 11. Accounts & Finance
-- ============================================================================

CREATE TABLE IF NOT EXISTS accounts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  account_name VARCHAR(255) NOT NULL,
  account_type VARCHAR(50) NOT NULL COMMENT 'Asset, Liability, Income, Expense, Equity',
  balance DECIMAL(15,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'PKR',
  
  branch_id BIGINT,
  created_by VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_account_type (account_type),
  INDEX idx_branch_id (branch_id),
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES dashboard_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(255) PRIMARY KEY,
  invoice_number VARCHAR(100) UNIQUE NOT NULL,
  customer_id VARCHAR(255),
  customer_name VARCHAR(255) NOT NULL,
  
  subtotal DECIMAL(12,2) NOT NULL,
  tax DECIMAL(12,2) DEFAULT 0,
  discount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  
  status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft','Sent','Paid','Cancelled')),
  due_date DATE,
  paid_date DATE,
  
  notes TEXT,
  branch_id BIGINT,
  created_by VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_invoice_number (invoice_number),
  INDEX idx_customer_id (customer_id),
  INDEX idx_status (status),
  INDEX idx_branch_id (branch_id),
  FOREIGN KEY (customer_id) REFERENCES dashboard_students(id) ON DELETE SET NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES dashboard_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  invoice_id VARCHAR(255) NOT NULL,
  description VARCHAR(500) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  
  INDEX idx_invoice_id (invoice_id),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  invoice_id VARCHAR(255),
  amount DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL COMMENT 'Cash, Bank Transfer, Card, etc.',
  payment_date DATE NOT NULL,
  reference_number VARCHAR(100),
  notes TEXT,
  
  branch_id BIGINT,
  received_by VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_invoice_id (invoice_id),
  INDEX idx_payment_date (payment_date),
  INDEX idx_branch_id (branch_id),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY (received_by) REFERENCES dashboard_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 12. Reports & Analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS dashboard_reports (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  report_type VARCHAR(100) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  parameters JSON,
  generated_data JSON,
  
  generated_by VARCHAR(255),
  branch_id BIGINT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_report_type (report_type),
  INDEX idx_created_at (created_at),
  INDEX idx_branch_id (branch_id),
  FOREIGN KEY (generated_by) REFERENCES dashboard_users(id) ON DELETE SET NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 13. Public Forms
-- ============================================================================

CREATE TABLE IF NOT EXISTS public_lead_submissions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20) NOT NULL,
  country VARCHAR(100),
  city VARCHAR(100),
  message TEXT,
  source VARCHAR(100) DEFAULT 'Website Form',
  
  converted_to_lead_id BIGINT,
  is_processed BOOLEAN DEFAULT FALSE,
  processed_by VARCHAR(255),
  processed_at TIMESTAMP NULL,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_is_processed (is_processed),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (converted_to_lead_id) REFERENCES leads(id) ON DELETE SET NULL,
  FOREIGN KEY (processed_by) REFERENCES dashboard_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- End of Schema
-- ============================================================================
