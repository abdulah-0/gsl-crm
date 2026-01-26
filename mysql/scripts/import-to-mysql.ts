import * as fs from 'fs';
import * as path from 'path';
import { getConnection, transaction } from '../config/database';

// Data directory
const DATA_DIR = path.join(__dirname, '../data');

// Tables to import (in dependency order - same as export)
const TABLES = [
    'dashboard_users',
    'user_permissions',
    'user_reporting_hierarchy',
    'branches',
    'universities',
    'leads',
    'lead_documents',
    'lead_timeline',
    'public_lead_submissions',
    'dashboard_services',
    'dashboard_students',
    'dashboard_student_academics',
    'dashboard_student_experiences',
    'student_mock_tests',
    'dashboard_cases',
    'application_history',
    'dashboard_teachers',
    'dashboard_teacher_assignments',
    'teacher_student_assignments',
    'dashboard_attendance',
    'teachers_timetable',
    'dashboard_student_remarks',
    'dashboard_study_materials',
    'dashboard_tasks',
    'notifications',
    'messenger',
    'employees',
    'employee_time_records',
    'payroll',
    'leaves',
    'employee_onboarding',
    'employee_assets',
    'chart_of_accounts',
    'vouchers',
    'invoices',
    'invoice_items',
    'payments',
    'dashboard_reports',
    'info_posts',
    'activity_log',
];

// Convert PostgreSQL data types to MySQL compatible values
function convertValue(value: any, columnName: string): any {
    if (value === null || value === undefined) {
        return null;
    }

    // Convert arrays to JSON strings
    if (Array.isArray(value)) {
        return JSON.stringify(value);
    }

    // Convert objects to JSON strings
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }

    // Convert boolean to 0/1
    if (typeof value === 'boolean') {
        return value ? 1 : 0;
    }

    // Convert timestamps
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
        return value.replace('T', ' ').substring(0, 19);
    }

    return value;
}

// Import a single table
async function importTable(tableName: string): Promise<number> {
    const filePath = path.join(DATA_DIR, `${tableName}.json`);

    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  No data file found for ${tableName}, skipping...`);
        return 0;
    }

    console.log(`📥 Importing ${tableName}...`);

    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const records = JSON.parse(fileContent);

        if (!Array.isArray(records) || records.length === 0) {
            console.log(`ℹ️  No records to import for ${tableName}`);
            return 0;
        }

        let importedCount = 0;

        await transaction(async (conn) => {
            // Disable foreign key checks temporarily
            await conn.query('SET FOREIGN_KEY_CHECKS = 0');

            // Get column names from first record
            const columns = Object.keys(records[0]);
            const placeholders = columns.map(() => '?').join(', ');
            const columnNames = columns.map(c => `\`${c}\``).join(', ');

            // Batch insert (1000 records at a time)
            const batchSize = 1000;
            for (let i = 0; i < records.length; i += batchSize) {
                const batch = records.slice(i, i + batchSize);

                for (const record of batch) {
                    const values = columns.map(col => convertValue(record[col], col));

                    try {
                        await conn.execute(
                            `INSERT INTO ${tableName} (${columnNames}) VALUES (${placeholders})`,
                            values
                        );
                        importedCount++;
                    } catch (error: any) {
                        // Skip duplicate entries
                        if (error.code !== 'ER_DUP_ENTRY') {
                            console.error(`❌ Error importing record in ${tableName}:`, error.message);
                        }
                    }
                }

                console.log(`   Imported ${Math.min(i + batchSize, records.length)}/${records.length} records...`);
            }

            // Re-enable foreign key checks
            await conn.query('SET FOREIGN_KEY_CHECKS = 1');
        });

        console.log(`✅ Imported ${importedCount} records into ${tableName}`);
        return importedCount;
    } catch (error) {
        console.error(`❌ Error importing ${tableName}:`, error);
        return 0;
    }
}

// Import all tables
async function importAll(): Promise<void> {
    console.log('🚀 Starting MySQL data import...\n');

    // Check if data directory exists
    if (!fs.existsSync(DATA_DIR)) {
        console.error(`❌ Data directory not found: ${DATA_DIR}`);
        console.error('Please run export-from-supabase.ts first to export data');
        process.exit(1);
    }

    // Check metadata
    const metadataPath = path.join(DATA_DIR, '_metadata.json');
    if (fs.existsSync(metadataPath)) {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        console.log('📋 Export Metadata:');
        console.log(`   Exported at: ${metadata.exportedAt}`);
        console.log(`   Tables exported: ${metadata.tablesExported}`);
        console.log(`   Duration: ${metadata.duration}\n`);
    }

    const startTime = Date.now();
    let totalRecords = 0;
    let successCount = 0;
    let errorCount = 0;

    for (const table of TABLES) {
        try {
            const count = await importTable(table);
            totalRecords += count;
            successCount++;
        } catch (error) {
            console.error(`❌ Failed to import ${table}:`, error);
            errorCount++;
        }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log('📊 Import Summary');
    console.log('='.repeat(60));
    console.log(`✅ Successfully imported: ${successCount} tables`);
    console.log(`❌ Failed imports: ${errorCount} tables`);
    console.log(`📝 Total records imported: ${totalRecords}`);
    console.log(`⏱️  Total time: ${duration}s`);
    console.log('='.repeat(60));

    // Create import log
    const importLog = {
        importedAt: new Date().toISOString(),
        tablesImported: successCount,
        tablesFailed: errorCount,
        totalRecords,
        duration: `${duration}s`,
    };

    fs.writeFileSync(
        path.join(DATA_DIR, '_import_log.json'),
        JSON.stringify(importLog, null, 2)
    );

    console.log(`\n📁 Import log saved to: ${path.join(DATA_DIR, '_import_log.json')}`);
}

// Run import
importAll().catch(error => {
    console.error('❌ Import failed:', error);
    process.exit(1);
});
