
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
    console.log('Inspecting schema for dashboard_cases...');

    // Try to insert a value with an invalid status to trigger an error that reveals the enum name
    const { error } = await supabase
        .from('dashboard_cases')
        .insert([{
            title: 'Temp Case for Enum Check',
            status: 'INVALID_STATUS_XYZ',
            stage: 'INVALID_STATUS_XYZ'
        }])
        .select();

    if (error) {
        console.log('Error details:', JSON.stringify(error, null, 2));
        console.log('Message:', error.message);
    } else {
        console.log('Unexpected success inserting invalid status?');
        // If success, delete it
        // This implies it's NOT an enum, or the enum accepts anything (unlikely)
    }
}

inspectSchema();
