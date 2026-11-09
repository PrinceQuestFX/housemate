import { updatePassword } from "../../actions";
import { PasswordField } from "@/components/password-field";
import s from "../../login/landing.module.css";

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className={s.page}>
      <div className={s.solo}>
        <span className={s.brand}>HOUSEMATE</span>
        <h1 className={s.h1}>Nouveau mot de passe</h1>
        <form action={updatePassword} className={s.card}>
          <label className={s.field}>Mot de passe (10 caractères minimum)<PasswordField minLength={10} autoComplete="new-password" /></label>
          {error && <p role="alert" className={s.err}>Mot de passe invalide ou lien expiré.</p>}
          <button className={s.cta}>Enregistrer</button>
        </form>
      </div>
    </main>
  );
}
