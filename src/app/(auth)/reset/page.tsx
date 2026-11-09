import Link from "next/link";
import { requestReset } from "../actions";
import { Field, btn, input } from "@/components/ui";

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Mot de passe oublié</h1>
      {sent ? (
        <p className="text-sm">Si ce compte existe, un e-mail de réinitialisation vient d'être envoyé.</p>
      ) : (
        <form action={requestReset} className="space-y-4">
          <Field label="Adresse e-mail"><input name="email" type="email" required className={input} /></Field>
          <button className={`${btn} w-full`}>Envoyer le lien</button>
        </form>
      )}
      <Link href="/login" className="text-center text-sm underline">Retour</Link>
    </main>
  );
}
