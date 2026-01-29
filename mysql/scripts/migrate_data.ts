import { createClient } from '@supabase/supabase-js';
import { getConnection } from '../config/database';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Export data from Supabase and import to MySQL
 */
async function migrateData() {
    console.log('Starting data migration from Supabase to MySQL...\n');

    try {
        const connection = await getConnection();

        // Tables to migrate (in order due to foreign key constraints)
        const tables = [
            'branches',
            'dashboard_users',
            'dashboard_services',
            'universities',
            'dashboard_students',
            'leads',
            'dashboard_cases',
            'application_history',
            'dashboard_tasks',
            'notifications',
            'leaves',
            'time_records',
            'payroll',
            'info_posts',
            'study_materials',
        ];

        for (const table of tables) {
            console.log(`\n📦 Migrating ${table}...`);

            try {
                // Fetch all data from Supabase
                const { data, error } = await supabase
                    .from(table)
                    .select('*')
                    .order('created_at', { ascending: true });

                if (error) {
                    console.error(`  ❌ Error fetching from ${table}:`, error.message);
                    continue;
                }

                if (!data || data.length === 0) {
                    console.log(`  ℹ️  No data found in ${table}`);
                    continue;
                }

                console.log(`  ✓ Fetched ${data.length} records from Supabase`);

                // Insert data into MySQL
                let inserted = 0;
                let failed = 0;

                for (const record of data) {
                    try {
                        // Convert JSONB fields to JSON strings
                        const processedRecord = { ...record };

                        // Handle JSON fields
                        if (processedRecord.permissions && typeof processedRecord.permissions === 'object') {
                            processedRecord.permissions = JSON.stringify(processedRecord.permissions);
                        }
                        if (processedRecord.tags && typeof processedRecord.tags === 'object') {
                            processedRecord.tags = JSON.stringify(processedRecord.tags);
                        }

                        // Build INSERT query
                        const fields = Object.keys(processedRecord).join(', ');
                        const placeholders = Object.keys(processedRecord).map(() => '?').join(', ');
                        const values = Object.values(processedRecord);

                        const sql = `INSERT INTO ${table} (${fields}) VALUES (${placeholders})`;
                        await connection.execute(sql, values);
                        inserted++;
                    } catch (err: any) {
                        failed++;
                        if (err.code !== 'ER_DUP_ENTRY') {
                            console.error(`  ⚠️  Error inserting record:`, err.message);
                        }
                    }
                }

                console.log(`  ✓ Inserted ${inserted} records into MySQL`);
                if (failed > 0) {
                    console.log(`  ⚠️  Failed to insert ${failed} records (likely duplicates)`);
                }

            } catch (err: any) {
                console.error(`  ❌ Error migrating ${table}:`, err.message);
            }
        }

        connection.release();
        console.log('\n✅ Data migration completed!\n');

    } catch (error: any) {
        console.error('\n❌ Migration failed:', error.message);
        process.exit(1);
    }
}

/**
 * Verify migration by comparing record counts
 */
async function verifyMigration() {
    console.log('\n🔍 Verifying migration...\n');

    const tables = [
        'branches',
        'dashboard_users',
        'leads',
        'dashboard_cases',
        'dashboard_tasks',
        'universities',
    ];

    for (const table of tables) {
        try {
            // Count in Supabase
            const { count: supabaseCount } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });

            // Count in MySQL
            const connection = await getConnection();
            const [rows] = await connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
            const mysqlCount = (rows as any)[0].count;
            connection.release();

            const match = supabaseCount === mysqlCount ? '✓' : '✗';
            console.log(`  ${match} ${table}: Supabase=${supabaseCount}, MySQL=${mysqlCount}`);

        } catch (err: any) {
            console.error(`  ❌ Error verifying ${table}:`, err.message);
        }
    }

    console.log('\n');
}

// Run migration
const args = process.argv.slice(2);

if (args.includes('--verify')) {
    verifyMigration().then(() => process.exit(0));
} else {
    migrateData()
        .then(() => verifyMigration())
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('Migration failed:', err);
            process.exit(1);
        });
}
