-- ============================================================================
-- MySQL Database Setup Script
-- Run this script to create the database and set up initial configuration
-- ============================================================================

-- Create database
CREATE DATABASE IF NOT EXISTS gsl_crm
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE gsl_crm;

-- Create admin user (optional - for remote access)
-- CREATE USER IF NOT EXISTS 'gsl_admin'@'%' IDENTIFIED BY 'secure_password_here';
-- GRANT ALL PRIVILEGES ON gsl_crm.* TO 'gsl_admin'@'%';
-- FLUSH PRIVILEGES;

-- Show database info
SELECT 
  'Database created successfully!' as message,
  DATABASE() as current_database,
  @@character_set_database as charset,
  @@collation_database as collation;

-- Instructions
SELECT '
=============================================================================
  GSL CRM Database Created Successfully!
=============================================================================

Next steps:
1. Run the complete schema: SOURCE mysql/schema/complete_schema.sql;
2. (Optional) Load sample data: SOURCE mysql/data/sample_data.sql;
3. Configure your .env file with database credentials
4. Start the API server: npm run mysql:dev

=============================================================================
' as instructions;
