/*
  # Recreate Admin User with Proper Authentication
  
  This migration properly creates the admin user account with correct password hashing
  and all required authentication data.
  
  1. User Details
    - Email: admin@signatureverify.local
    - Password: admin123
    - Email confirmed by default
  
  2. Authentication Setup
    - Creates user in auth.users table
    - Creates identity in auth.identities table
    - Properly hashes password using crypt with bf algorithm
*/

DO $$
DECLARE
  admin_uid uuid;
BEGIN
  -- Generate a new UUID for the admin user
  admin_uid := gen_random_uuid();
  
  -- Check if admin user already exists
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'admin@signatureverify.local'
  ) THEN
    -- Create the user with proper authentication
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      admin_uid,
      'authenticated',
      'authenticated',
      'admin@signatureverify.local',
      crypt('admin123', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Admin"}',
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );

    -- Create the identity record
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      admin_uid,
      admin_uid::text,
      format('{"sub":"%s","email":"%s"}', admin_uid::text, 'admin@signatureverify.local')::jsonb,
      'email',
      NOW(),
      NOW(),
      NOW()
    );
  END IF;
END $$;
