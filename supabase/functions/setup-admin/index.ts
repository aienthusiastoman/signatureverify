import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if admin user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const adminExists = existingUsers?.users.some(
      (u) => u.email === "admin@signatureverify.local"
    );

    if (adminExists) {
      // Delete the existing user to recreate with proper credentials
      const userToDelete = existingUsers?.users.find(
        (u) => u.email === "admin@signatureverify.local"
      );
      if (userToDelete) {
        await supabaseAdmin.auth.admin.deleteUser(userToDelete.id);
      }
    }

    // Create admin user with proper authentication
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: "admin@signatureverify.local",
      password: "admin123",
      email_confirm: true,
      user_metadata: {
        full_name: "Admin",
      },
    });

    if (createError) {
      throw createError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Admin user created successfully",
        user_id: newUser.user?.id,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
