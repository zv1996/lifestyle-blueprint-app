# Admin User Setup Instructions

This guide will help you create an admin user in your Supabase project for testing the Lifestyle Blueprint app.

## Prerequisites
- Node.js installed
- npm installed (comes with Node.js)
- Access to your Supabase project dashboard

## Steps to Create Admin User

### 1. Get Your Supabase Service Key

1. Go to your Supabase dashboard: https://app.supabase.com/
2. Select your "Lifestyle Blueprint" project
3. Navigate to Project Settings > API
4. Under "Project API keys", find the "service_role" key (this has full admin access)
5. Copy this key

### 2. Update Your .env File

1. Open the `.env` file in this project
2. Replace `your_service_key_here` with the service_role key you copied
3. Optionally, change the `ADMIN_PASSWORD` if you want a different password

### 3. Run the Admin User Creation Script

```bash
npm run create-admin
```

### 4. Verify User Creation

1. Go back to your Supabase dashboard
2. Navigate to Authentication > Users
3. You should see the user `zack@transcendingcreative.com` in the list
4. Check the Database > Table Editor > users table to verify the profile was created

### 5. Test Login

You can now use these credentials to log in to the app:
- Email: zack@transcendingcreative.com
- Password: The password you set in the .env file (default: TemporaryPassword123!)

## Security Notes

- The service_role key has full access to your database, so keep it secure
- Don't commit the .env file to version control
- Change the admin password after first login
- Consider setting up proper Row Level Security (RLS) policies for your tables