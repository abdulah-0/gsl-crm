
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
        console.error('Missing Supabase URL or Key in .env');
        console.log('Keys found:', Object.keys(env));
        process.exit(1);
    }

    console.log('Connecting to Supabase...');
    const supabase = createClient(supabaseUrl, supabaseKey);

    (async () => {
        console.log('Attempting to insert a test case with status "Not Enrolled"...');

        // Use a random ID to avoid collisions if possible, or let DB generate it
        const { data, error } = await supabase
            .from('dashboard_cases')
            .insert([{
                title: 'Debug Not Enrolled',
                status: 'Not Enrolled',
                stage: 'Not Enrolled',
                assignees: [] // Ensure required fields are present
            }])
            .select();

        if (error) {
            console.error('INSERT FAILED:', error.message);
            console.error('Full Error:', JSON.stringify(error, null, 2));
            if (error.message.includes('invalid input value for enum')) {
                console.log('\n>>> DIAGNOSIS: The database still thinks "Not Enrolled" is invalid. The SQL script was not run or failed. <<<');
            }
        } else {
            console.log('INSERT SUCCESS! The database accepts "Not Enrolled".');
            // Clean up
            if (data && data[0]) {
                await supabase.from('dashboard_cases').delete().eq('id', data[0].id);
                console.log('Cleaned up test case.');
            }
        }
    })();

} catch (err) {
    console.error('Failed to read .env or run script:', err);
}
