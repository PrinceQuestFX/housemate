import { SubmitButton } from "@/components/submit-button";
import { getContext } from "@/lib/session";
import { saveProfile } from "@/server/actions";
import { changePassword } from "@/server/account-actions";
import { PasswordField } from "@/components/password-field";
import { PushButton } from "@/components/push-button";
import { Field, btn, card, input } from "@/components/ui";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ pw?: string }> }) {
  const { pw } = await searchParams;
  const { supabase, userId } = await getContext();
  const { data: p } = await supabase.from("profiles").select("first_name, last_name, phone").eq("id", userId).single();
  return (
    <>
      <h1 className="text-2xl font-semibold">Réglages</h1>
      <form action={saveProfile} className={`${card} space-y-3`}>
        <h2 className="font-medium">Mon profil</h2>
        <Field label="Prénom"><input name="first" defaultValue={p?.first_name} required className={input} /></Field>
        <Field label="Nom"><input name="last" defaultValue={p?.last_name} className={input} /></Field>
        <Field label="Téléphone"><input name="phone" defaultValue={p?.phone ?? ""} inputMode="tel" className={input} /></Field>
        <SubmitButton className={btn}>Enregistrer</SubmitButton>
      </form>
      <form action={changePassword} className={`${card} space-y-3`}>
        <h2 className="font-medium">Mon mot de passe</h2>
        <Field label="Nouveau mot de passe (10 caractères minimum)"><PasswordField name="password" minLength={10} autoComplete="new-password" className={input} /></Field>
        <Field label="Confirmer le mot de passe"><PasswordField name="confirm" minLength={10} autoComplete="new-password" className={input} /></Field>
        {pw === "ok" && <p role="status" className="text-sm text-emerald-300">Mot de passe modifié.</p>}
        {pw === "err" && <p role="alert" className="text-sm text-rose-300">Les deux mots de passe doivent être identiques (10 caractères minimum).</p>}
        <SubmitButton className={btn}>Changer le mot de passe</SubmitButton>
      </form>
      <section className={`${card} space-y-3`}><h2 className="font-medium">Notifications</h2><PushButton /></section>
    </>
  );
}
