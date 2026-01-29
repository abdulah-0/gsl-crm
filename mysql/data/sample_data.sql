-- ============================================================================
-- Sample Data for Testing
-- This file contains sample data to help you test the MySQL system
-- ============================================================================

USE gsl_crm;

-- Insert sample branches
INSERT INTO branches (name, code, city, country, phone, email, status) VALUES
('I8 Head Office', 'I8-HQ', 'Islamabad', 'Pakistan', '+92-51-1234567', 'i8@gslcrm.com', 'Active'),
('F-10 Branch', 'F10', 'Islamabad', 'Pakistan', '+92-51-7654321', 'f10@gslcrm.com', 'Active'),
('Lahore Branch', 'LHR', 'Lahore', 'Pakistan', '+92-42-1234567', 'lahore@gslcrm.com', 'Active');

-- Insert sample users
INSERT INTO dashboard_users (id, full_name, email, role, status, permissions, branch_id) VALUES
('USR001', 'Super Admin', 'admin@gslcrm.com', 'Super Admin', 'Active', '["dashboard","users","leads","students","cases","tasks","branches","reports"]', 1),
('USR002', 'Branch Manager', 'manager@gslcrm.com', 'Admin', 'Active', '["dashboard","leads","students","cases","tasks"]', 2),
('USR003', 'Counsellor', 'counsellor@gslcrm.com', 'Counsellor', 'Active', '["dashboard","leads","students","cases"]', 1);

-- Insert sample services
INSERT INTO dashboard_services (id, name, type, description, price, duration_weeks) VALUES
('SRV001', 'Study Abroad Consultation', 'Consultation', 'Complete study abroad consultation and guidance', 50000.00, 12),
('SRV002', 'Visa Processing', 'Service', 'Student visa application and processing', 75000.00, 8),
('SRV003', 'IELTS Preparation', 'Course', 'Comprehensive IELTS preparation course', 30000.00, 6);

-- Insert sample universities
INSERT INTO universities (name, country, city, ranking, type) VALUES
('University of Oxford', 'United Kingdom', 'Oxford', 1, 'Public'),
('Harvard University', 'United States', 'Cambridge', 2, 'Private'),
('University of Toronto', 'Canada', 'Toronto', 18, 'Public'),
('University of Melbourne', 'Australia', 'Melbourne', 14, 'Public'),
('National University of Singapore', 'Singapore', 'Singapore', 11, 'Public');

-- Insert sample leads
INSERT INTO leads (full_name, email, phone, country, city, source, status, assigned_to, branch_id, created_by) VALUES
('Ahmed Khan', 'ahmed@example.com', '+92-300-1234567', 'Pakistan', 'Islamabad', 'Website', 'New', 'USR003', 1, 'USR001'),
('Sara Ali', 'sara@example.com', '+92-321-7654321', 'Pakistan', 'Lahore', 'Referral', 'Contacted', 'USR002', 2, 'USR001'),
('Hassan Raza', 'hassan@example.com', '+92-333-9876543', 'Pakistan', 'Karachi', 'Social Media', 'Qualified', 'USR003', 1, 'USR001');

-- Insert sample students
INSERT INTO dashboard_students (id, full_name, email, phone, program_title, status, branch_id, created_by) VALUES
('ST001', 'Ali Hassan', 'ali@example.com', '+92-300-1111111', 'Computer Science', 'Active', 1, 'USR001'),
('ST002', 'Fatima Ahmed', 'fatima@example.com', '+92-321-2222222', 'Business Administration', 'Active', 2, 'USR002');

-- Insert sample cases
INSERT INTO dashboard_cases (id, student_id, student_name, student_email, service_id, status, priority, assigned_to, branch_id, created_by) VALUES
('CS001', 'ST001', 'Ali Hassan', 'ali@example.com', 'SRV001', 'Open', 'High', 'USR003', 1, 'USR001'),
('CS002', 'ST002', 'Fatima Ahmed', 'fatima@example.com', 'SRV002', 'In Progress', 'Medium', 'USR002', 2, 'USR001');

-- Insert sample tasks
INSERT INTO dashboard_tasks (title, description, status, priority, due_date, assigned_to, assignee_id, case_id, branch_id, created_by) VALUES
('Follow up with student', 'Contact student for document submission', 'Pending', 'High', DATE_ADD(CURDATE(), INTERVAL 2 DAY), 'USR003', 'USR003', 'CS001', 1, 'USR001'),
('Prepare visa application', 'Prepare and review visa application documents', 'In Progress', 'Urgent', DATE_ADD(CURDATE(), INTERVAL 5 DAY), 'USR002', 'USR002', 'CS002', 2, 'USR001');

-- Insert sample notifications
INSERT INTO notifications (user_id, type, title, message, is_read, related_id) VALUES
('USR003', 'task_assigned', 'New Task Assigned', 'You have been assigned a new task: Follow up with student', FALSE, '1'),
('USR002', 'task_assigned', 'New Task Assigned', 'You have been assigned a new task: Prepare visa application', FALSE, '2');

SELECT '
=============================================================================
  Sample Data Inserted Successfully!
=============================================================================

Created:
- 3 Branches
- 3 Users (Super Admin, Branch Manager, Counsellor)
- 3 Services
- 5 Universities
- 3 Leads
- 2 Students
- 2 Cases
- 2 Tasks
- 2 Notifications

You can now test the API endpoints with this sample data.

Test credentials:
- Super Admin: admin@gslcrm.com
- Branch Manager: manager@gslcrm.com
- Counsellor: counsellor@gslcrm.com

=============================================================================
' as message;
