/*
  Supabase project credentials.
  The anon/public key is safe to expose in client-side code -- it only
  ever acts under the RLS policies defined in supabase/schema.sql.
*/
window.SUPABASE_URL = "https://mytcucwpzolbggjmvzqq.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15dGN1Y3dwem9sYmdnam12enFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MTczNDUsImV4cCI6MjEwNjM5MzM0NX0.m5PkVy40St60ZuK1MXdzxmi1GALY85mR2O1zhb_7Y2M";

window.supabaseClient = (window.SUPABASE_URL.indexOf("YOUR-PROJECT-REF") === -1 && window.supabase)
  ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY)
  : null;

if (!window.supabaseClient) {
  console.info("Supabase not configured yet -- add your project URL and anon key to assets/js/supabase-client.js.");
}
