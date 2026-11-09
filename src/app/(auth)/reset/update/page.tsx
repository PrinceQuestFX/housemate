import { updatePassword } from "../../actions";
import { Field, btn, input } from "@/components/ui";

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Nouveau mot de passe</h1>
      <form action={updatePassword} className="space-y-4">
        <Field label="Mot de passe (10 caractères minimum)">
          <input name="password" type="password" minLength={10} required autoComplete="new-password" className={input} />
        </Field>
        {error && <p role="alert" className="text-sm text-red-600">Mot de passe invalide ou lien expiré.</p>}
        <button className={`${btn} w-full`}>Enregistrer</button>
      </form>
    </main>
  );
}
