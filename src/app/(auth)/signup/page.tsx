import Link from "next/link";
import { signUp } from "./actions";
import { PasswordField } from "@/components/password-field";
import s from "../login/landing.module.css";

const ERRORS: Record<string, string> = {
  invalid: "Prénom ou adresse e-mail invalide.",
  password: "Le mot de passe doit contenir au moins 10 caractères.",
  exists: "Création impossible : adresse déjà utilisée ?",
  setup: "La maison n'est pas prête. Réessayez ou prévenez un administrateur.",
};

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className={s.page}>
      <div className={s.solo}>
        <span className={s.brand}>HOUSEMATE</span>
        <h1 className={s.h1}>Rejoignez la maison.</h1>
        <p className={s.lead}>Créez votre compte : un administrateur validera votre arrivée.</p>
        <form action={signUp} className={s.card}>
          <label className={s.field}>Prénom<input name="first" required autoComplete="given-name" /></label>
          <label className={s.field}>Nom<input name="last" autoComplete="family-name" /></label>
          <label className={s.field}>Adresse e-mail<input name="email" type="email" required autoComplete="email" /></label>
          <label className={s.field}>Mot de passe (10 caractères minimum)<PasswordField minLength={10} autoComplete="new-password" /></label>
          {error && <p role="alert" className={s.err}>{ERRORS[error] ?? "Une erreur est survenue."}</p>}
          <button className={s.cta}>Créer mon compte</button>
          <div className={s.links}><Link href="/login">J&apos;ai déjà un compte</Link></div>
        </form>
      </div>
    </main>
  );
}
