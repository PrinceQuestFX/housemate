import Link from "next/link";
import { login } from "../actions";
import { Field, btn, input } from "@/components/ui";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">HOUSEMATE</h1>
        <p className="text-sm text-neutral-500">La maison, sans prise de tête.</p>
      </div>
      <form action={login} className="space-y-4">
        <Field label="Adresse e-mail"><input name="email" type="email" required autoComplete="email" className={input} /></Field>
        <Field label="Mot de passe"><input name="password" type="password" required autoComplete="current-password" className={input} /></Field>
        {error && <p role="alert" className="text-sm text-red-600">Identifiants invalides.</p>}
        <button className={`${btn} w-full`}>Se connecter</button>
      </form>
      <Link href="/signup" className="text-center text-sm underline">Créer mon compte</Link>
      <Link href="/reset" className="text-center text-sm underline">Mot de passe oublié</Link>
    </main>
  );
}
