/**
 * Création one-shot des 5 comptes (Prince et Jordan en admin).
 * Usage : voir docs/ADMINS.md
 *   HOUSEMATE_USERS="mail1:Prince:Nom:admin,mail2:Jordan:Nom:admin,mail3:Prenom:Nom:member,..." \
 *   npx tsx --env-file=.env.local scripts/bootstrap-admins.ts
 * Les mots de passe temporaires sont générés aléatoirement et affichés une seule fois.
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis");

const people = (process.env.HOUSEMATE_USERS ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean)
  .map((s) => {
    const [email, first, last, role] = s.split(":");
    return { email, first, last, role: role === "admin" ? "admin" : "member" };
  });
if (!people.length) throw new Error("HOUSEMATE_USERS est vide");

const admin = createClient(url, key, { auth: { persistSession: false } });

const { data: existing } = await admin.from("households").select("id").limit(1);
let householdId = existing?.[0]?.id as string | undefined;
if (!householdId) {
  const { data, error } = await admin.from("households").insert({ name: process.env.HOUSEHOLD_NAME ?? "Maison" }).select("id").single();
  if (error) throw error;
  householdId = data.id;
}

for (const p of people) {
  const password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email: p.email, password, email_confirm: true });
  if (error) { console.error(`✗ ${p.email} : ${error.message}`); continue; }
  await admin.from("profiles").upsert({ id: data.user.id, first_name: p.first ?? "", last_name: p.last ?? "" });
  await admin.from("household_members").upsert({ household_id: householdId, user_id: data.user.id, role: p.role });
  console.log(`✓ ${p.email} (${p.role}) mot de passe temporaire : ${password}`);
}
console.log("Changez les mots de passe via « Mot de passe oublié » à la première connexion.");
