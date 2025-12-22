
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

async function checkEnum() {
    console.log('Checking if we can insert "Not Enrolled" status...');

    const { data, error } = await supabase
        .from('dashboard_cases')
        .insert([{
            title: 'Temp Case for Enum Check',
            status: 'Not Enrolled',
            stage: 'Not Enrolled',
            assignees: []
        }])
        .select();

    if (error) {
        console.log('Error inserting:', error.message);
        if (error.message.includes('invalid input value for enum') || error.message.includes('violates check constraint')) {
            console.log('ENUM_DETECTED');
        } else {
            console.log('OTHER_ERROR');
        }
    } else {
        console.log('INSERT_SUCCESS');
        if (data && data[0]) {
            await supabase.from('dashboard_cases').delete().eq('id', data[0].id);
            console.log('Cleaned up temp case.');
        }
    }
}

checkEnum();
