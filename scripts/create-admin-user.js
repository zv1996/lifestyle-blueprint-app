// Script to create an admin user in Supabase
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // Use service key for admin operations

// Admin user details
const adminEmail = 'zack@transcendingcreative.com';
const adminPassword = process.env.ADMIN_PASSWORD || 'TemporaryPassword123!'; // Use env var or default
const adminFirstName = 'Zack';
const adminLastName = 'Vivas';

async function createAdminUser() {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Supabase URL or Service Key not provided.');
    console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.');
    process.exit(1);
  }

  // Initialize Supabase client with service key for admin operations
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    console.log(`Creating admin user: ${adminEmail}...`);
    
    // Create user in Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        is_admin: true
      }
    });

    if (authError) throw authError;
    
    console.log('Auth user created successfully.');
    console.log(`User ID: ${authUser.user.id}`);
    
    // Insert user profile in users table
    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .insert({
        user_id: authUser.user.id,
        first_name: adminFirstName,
        last_name: adminLastName
      })
      .select();
      
    if (profileError) throw profileError;
    
    console.log('User profile created successfully.');
    console.log('Admin user setup complete!');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log('Please change the password after first login.');
    
  } catch (error) {
    console.error('Error creating admin user:', error.message);
    process.exit(1);
  }
}

// Execute the function
createAdminUser();
