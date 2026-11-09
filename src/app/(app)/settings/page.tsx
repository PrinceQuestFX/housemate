import { getContext } from "@/lib/session";
import { saveProfile } from "@/server/actions";
import { PushButton } from "@/components/push-button";
import { Field, btn, card, input } from "@/components/ui";

export default async function SettingsPage() {
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
        <button className={btn}>Enregistrer</button>
      </form>
      <section className={`${card} space-y-3`}><h2 className="font-medium">Notifications</h2><PushButton /></section>
    </>
  );
}
