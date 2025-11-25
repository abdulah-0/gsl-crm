
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.resolve(__dirname, '.env');
console.log('Reading .env from:', envPath);

try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const env = {};
    envContent.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim();
            env[key] = value;
        }
    });

    const supabaseUrl = env.VITE_SUPABASE_URL;
    const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase URL or Key');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    (async () => {
        console.log('1. Fetching a recent case to test update...');
        const { data: cases, error: fetchError } = await supabase
            .from('dashboard_cases')
            .select('*')
            .limit(1);

        if (fetchError) {
            console.error('Fetch failed:', fetchError);
            return;
        }

        if (!cases || cases.length === 0) {
            console.log('No cases found to test update.');
            return;
        }

        const testCase = cases[0];
        console.log('Found case:', { id: testCase.id, case_number: testCase.case_number, status: testCase.status });

        console.log('2. Attempting to update status to "Not Enrolled"...');
        // Using the exact logic from frontend: .eq('case_number', id)
        // We use testCase.case_number if available, else testCase.id (as string)
        const idToUse = testCase.case_number || String(testCase.id);

        const { data: updateData, error: updateError } = await supabase
            .from('dashboard_cases')
            .update({ stage: 'Not Enrolled', status: 'Not Enrolled' })
            .eq('case_number', idToUse)
            .select();

        if (updateError) {
            console.error('UPDATE FAILED:', updateError);
            console.error('Message:', updateError.message);
            console.error('Details:', updateError.details);
            console.error('Hint:', updateError.hint);
        } else {
            console.log('UPDATE SUCCESS!', updateData);

            // Revert
            console.log('Reverting status...');
            await supabase
                .from('dashboard_cases')
                .update({ stage: testCase.stage, status: testCase.status })
                .eq('case_number', idToUse);
        }
    })();

} catch (err) {
    console.error('Script error:', err);
}
