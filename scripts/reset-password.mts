// Dépannage : définit un nouveau mot de passe pour un compte existant (sans e-mail).
// Usage (Windows cmd) :
//   set RESET_EMAIL=adresse@exemple.com
//   set RESET_PASSWORD=NouveauMotDePasse10car
//   npx --yes tsx --env-file=.env.local scripts\reset-password.mts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.RESET_EMAIL?.trim().toLowerCase();
const password = process.env.RESET_PASSWORD ?? "";

if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis");
if (!email) throw new Error("RESET_EMAIL est requis");
if (password.length < 10) throw new Error("RESET_PASSWORD doit contenir au moins 10 caractères");

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

let userId: string | undefined;
for (let page = 1; !userId; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
  if (data.users.length < 200) break;
}
if (!userId) throw new Error(`Aucun compte trouvé pour ${email}`);

const { error } = await admin.auth.admin.updateUserById(userId, { password });
if (error) throw error;
console.log(`✓ Mot de passe mis à jour pour ${email}`);
