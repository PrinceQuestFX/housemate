import { logout } from "../actions";
import s from "../login/landing.module.css";

export default function WaitingPage() {
  return (
    <main className={s.page}>
      <div className={s.solo}>
        <span className={s.brand}>HOUSEMATE</span>
        <h1 className={s.h1}>Demande envoyée.</h1>
        <p className={s.lead}>Votre compte existe. Dès qu&apos;un administrateur valide votre arrivée, reconnectez-vous : la maison s&apos;ouvrira.</p>
        <form action={logout}><button className={s.cta}>Se déconnecter</button></form>
      </div>
    </main>
  );
}
