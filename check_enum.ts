
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEnum() {
  console.log('Checking if we can insert "Not Enrolled" status...');
  
  // Try to insert a dummy case with the new status. 
  // If it fails with "invalid input value for enum", we know it's an enum.
  // We'll use a transaction or immediately delete it if it succeeds.
  
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
      console.log('It seems to be an ENUM or Check Constraint.');
      console.log('You need to run: ALTER TYPE case_status_enum ADD VALUE IF NOT EXISTS \'Not Enrolled\';');
    } else {
      console.log('Unknown error, might be other constraints.');
    }
  } else {
    console.log('Insert successful! It seems "Not Enrolled" is accepted.');
    if (data && data[0]) {
      await supabase.from('dashboard_cases').delete().eq('id', data[0].id);
      console.log('Cleaned up temp case.');
    }
  }
}

checkEnum();
