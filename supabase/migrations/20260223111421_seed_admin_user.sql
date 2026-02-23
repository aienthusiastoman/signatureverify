/*
  # Seed Admin User

  Creates a default admin user with:
  - Email: admin@signatureverify.local
  - Password: admin123

  This uses Supabase's internal auth schema to create the user directly.
  The password is hashed using bcrypt as required by Supabase auth.
*/

DO $$
DECLARE
  admin_uid uuid := gen_random_uuid();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'admin@signatureverify.local'
  ) THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role
    ) VALUES (
      admin_uid,
      '00000000-0000-0000-0000-000000000000',
      'admin@signatureverify.local',
      crypt('admin123', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Admin"}',
      'authenticated',
      'authenticated'
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      created_at,
      updated_at,
      last_sign_in_at
    ) VALUES (
      gen_random_uuid(),
      admin_uid,
      jsonb_build_object('sub', admin_uid::text, 'email', 'admin@signatureverify.local'),
      'email',
      'admin@signatureverify.local',
      now(),
      now(),
      now()
    );
  END IF;
END $$;
