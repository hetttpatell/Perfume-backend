import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function setup() {
  // Try inserting a test row — if the table exists, we'll get a proper response
  // If not, we need to ask the user to create it manually
  const { data, error } = await supabase
    .from('contact_messages')
    .select('*')
    .limit(1);

  if (error && error.code === 'PGRST205') {
    console.log('TABLE_NOT_FOUND');
  } else if (error) {
    console.log('ERROR:', error.message);
  } else {
    console.log('TABLE_EXISTS');
    console.log('DATA:', JSON.stringify(data));
  }
}

setup();
