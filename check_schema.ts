
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
    console.log('Checking dashboard_cases schema...');
    const { data: cases, error } = await supabase
        .from('dashboard_cases')
        .select('university_id, student_info')
        .limit(1);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Sample case data:', cases);
    }
}

checkSchema();
