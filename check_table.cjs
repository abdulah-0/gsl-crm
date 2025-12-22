
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.resolve(__dirname, '.env');

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
        console.error('Missing Supabase credentials');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    (async () => {
        console.log('Checking dashboard_cases table...');

        // Try to fetch one row to see if table exists
        const { data, error } = await supabase
            .from('dashboard_cases')
            .select('*')
            .limit(1);

        if (error) {
            console.error('Error accessing dashboard_cases:', error.message);
            console.error('Full error:', JSON.stringify(error, null, 2));
        } else {
            console.log('✓ Table exists and is accessible');
            console.log('Sample row columns:', data && data[0] ? Object.keys(data[0]) : 'No data');

            // Check if status and stage columns exist
            if (data && data[0]) {
                console.log('Has status column:', 'status' in data[0]);
                console.log('Has stage column:', 'stage' in data[0]);
                if ('status' in data[0]) console.log('Sample status value:', data[0].status);
                if ('stage' in data[0]) console.log('Sample stage value:', data[0].stage);
            }
        }
    })();

} catch (err) {
    console.error('Script error:', err);
}
