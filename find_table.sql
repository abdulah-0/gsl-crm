-- Find all tables that might be dashboard_cases
-- Run this in Supabase SQL Editor to see what tables exist

SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE tablename LIKE '%case%'
ORDER BY schemaname, tablename;

-- Also check all schemas
SELECT schema_name
FROM information_schema.schemata
ORDER BY schema_name;
