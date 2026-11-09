import { SubmitButton } from "@/components/submit-button";
import Link from "next/link";
import { requestReset } from "../actions";
import s from "../login/landing.module.css";

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams;
  return (
    <main className={s.page}>
      <div className={s.solo}>
        <span className={s.brand}>HOUSEMATE</span>
        <h1 className={s.h1}>Mot de passe oublié ?</h1>
        {sent ? <p className={s.lead}>Si ce compte existe, un e-mail de réinitialisation vient d&apos;être envoyé.</p> : (
          <form action={requestReset} className={s.card}>
            <label className={s.field}>Adresse e-mail<input name="email" type="email" required /></label>
            <SubmitButton className={s.cta}>Envoyer le lien</SubmitButton>
          </form>
        )}
        <div className={s.links}><Link href="/login">Retour à la connexion</Link></div>
      </div>
    </main>
  );
}
