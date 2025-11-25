
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

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
