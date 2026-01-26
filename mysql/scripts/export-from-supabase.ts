import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Supabase configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase credentials not found in environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Tables to export (in dependency order)
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

// Output directory
const OUTPUT_DIR = path.join(__dirname, '../data');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Export a single table
async function exportTable(tableName: string): Promise<void> {
    console.log(`📦 Exporting ${tableName}...`);

    try {
        let allData: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
                console.error(`❌ Error exporting ${tableName}:`, error);
                return;
            }

            if (!data || data.length === 0) {
                hasMore = false;
            } else {
                allData = allData.concat(data);
                page++;

                if (data.length < pageSize) {
                    hasMore = false;
                }
            }
        }

        // Write to file
        const outputPath = path.join(OUTPUT_DIR, `${tableName}.json`);
        fs.writeFileSync(outputPath, JSON.stringify(allData, null, 2));

        console.log(`✅ Exported ${allData.length} records from ${tableName}`);
    } catch (error) {
        console.error(`❌ Error exporting ${tableName}:`, error);
    }
}

// Export all tables
async function exportAll(): Promise<void> {
    console.log('🚀 Starting Supabase data export...\n');

    const startTime = Date.now();
    let successCount = 0;
    let errorCount = 0;

    for (const table of TABLES) {
        try {
            await exportTable(table);
            successCount++;
        } catch (error) {
            console.error(`❌ Failed to export ${table}:`, error);
            errorCount++;
        }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log('📊 Export Summary');
    console.log('='.repeat(60));
    console.log(`✅ Successfully exported: ${successCount} tables`);
    console.log(`❌ Failed exports: ${errorCount} tables`);
    console.log(`⏱️  Total time: ${duration}s`);
    console.log('='.repeat(60));

    // Create metadata file
    const metadata = {
        exportedAt: new Date().toISOString(),
        supabaseUrl,
        tablesExported: successCount,
        tablesFailed: errorCount,
        totalTables: TABLES.length,
        duration: `${duration}s`,
    };

    fs.writeFileSync(
        path.join(OUTPUT_DIR, '_metadata.json'),
        JSON.stringify(metadata, null, 2)
    );

    console.log(`\n📁 Data exported to: ${OUTPUT_DIR}`);
}

// Run export
exportAll().catch(error => {
    console.error('❌ Export failed:', error);
    process.exit(1);
});
