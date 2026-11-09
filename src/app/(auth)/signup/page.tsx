import Link from "next/link";
import { signUp } from "./actions";
import { Field, btn, input } from "@/components/ui";

const ERRORS: Record<string, string> = {
  closed: "Les inscriptions sont fermées.",
  code: "Code de la maison incorrect.",
  invalid: "Prénom ou adresse e-mail invalide.",
  password: "Le mot de passe doit contenir au moins 10 caractères.",
  exists: "Création impossible (adresse déjà utilisée ?).",
  full: "La maison est complète.",
  setup: "La maison n'est pas encore prête. Prévenez un administrateur.",
};

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const closed = !process.env.HOUSE_JOIN_CODE;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Créer mon compte</h1>
        <p className="text-sm text-neutral-500">Rejoignez la maison avec le code donné par un administrateur.</p>
      </div>
      {closed ? (
        <p role="alert" className="text-sm text-red-600">{ERRORS.closed}</p>
      ) : (
        <form action={signUp} className="space-y-4">
          <Field label="Prénom"><input name="first" required autoComplete="given-name" className={input} /></Field>
          <Field label="Nom"><input name="last" autoComplete="family-name" className={input} /></Field>
          <Field label="Adresse e-mail"><input name="email" type="email" required autoComplete="email" className={input} /></Field>
          <Field label="Mot de passe (10 caractères minimum)">
            <input name="password" type="password" required minLength={10} autoComplete="new-password" className={input} />
          </Field>
          <Field label="Code de la maison"><input name="code" required autoComplete="off" className={input} /></Field>
          {error && <p role="alert" className="text-sm text-red-600">{ERRORS[error] ?? "Une erreur est survenue."}</p>}
          <button className={`${btn} w-full`}>Créer mon compte</button>
        </form>
      )}
      <Link href="/login" className="text-center text-sm underline">J'ai déjà un compte</Link>
    </main>
  );
}
