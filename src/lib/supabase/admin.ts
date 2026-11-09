import { createClient } from "@supabase/supabase-js";

/** Client service_role : serveur uniquement, jamais importé depuis un composant client. */
export function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}
