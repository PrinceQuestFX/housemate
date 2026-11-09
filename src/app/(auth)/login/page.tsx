import { SubmitButton } from "@/components/submit-button";
import Link from "next/link";
import { login } from "../actions";
import { PasswordField } from "@/components/password-field";
import s from "./landing.module.css";

const Person = ({ x, y, shirt, skin }: { x: number; y: number; shirt: string; skin: string }) => (
  <g><circle cx={x} cy={y} r="11" fill={skin} /><rect x={x - 12} y={y + 14} width="24" height="48" rx="11" fill={shirt} /></g>
);

function House() {
  return (
    <svg className={s.house} viewBox="0 0 560 400" role="img" aria-label="Une maison où chacun s'occupe de quelque chose : ménage, comptes, réparations, mur d'annonces">
      <polygon points="30,122 280,26 530,122" fill="#F4B942" />
      <rect x="400" y="46" width="26" height="50" fill="#E09B2D" />
      <g className={s.ring}><path d="M280 44a12 12 0 0 1 12 12v8l5 6H263l5-6v-8a12 12 0 0 1 12-12z" fill="#10272B" /><circle cx="280" cy="80" r="3" fill="#10272B" /></g>
      <rect x="40" y="122" width="480" height="258" rx="14" fill="#1B3F45" />
      <path d="M280 122v258M40 251h480" stroke="#2F5C64" strokeWidth="4" />
      {/* ménage */}
      <Person x={100} y={170} shirt="#6EE0B5" skin="#C68B59" />
      <g className={s.sweep}><line x1="124" y1="196" x2="150" y2="238" stroke="#F4B942" strokeWidth="4" strokeLinecap="round" /><polygon points="140,236 164,236 156,244 144,244" fill="#E09B2D" /></g>
      {[[200, 214, 0], [222, 190, .6], [180, 192, 1.1]].map(([x, y, d]) => <path key={x} className={s.twinkle} style={{ animationDelay: `${d}s` }} d={`M${x} ${y - 8}l3 5 5 3-5 3-3 5-3-5-5-3 5-3z`} fill="#fff" />)}
      {/* comptes */}
      <Person x={338} y={172} shirt="#8EC5FF" skin="#8D5A3B" />
      <rect x="432" y="190" width="44" height="50" rx="10" fill="none" stroke="#F4B942" strokeWidth="4" />
      {[0, .7, 1.4].map((d, i) => <circle key={i} className={s.fall} style={{ animationDelay: `${d}s` }} cx={444 + i * 10} cy="176" r="6" fill="#F4B942" />)}
      <text className={s.rise} x="372" y="168" fill="#6EE0B5" fontSize="20" fontWeight="800">÷ 5</text>
      {/* réparations */}
      <Person x={96} y={302} shirt="#FF8FA3" skin="#E0A878" />
      <g className={s.hammer}><line x1="120" y1="332" x2="150" y2="318" stroke="#C9D6D3" strokeWidth="5" strokeLinecap="round" /><rect x="144" y="306" width="20" height="12" rx="3" fill="#C9D6D3" /></g>
      <rect x="170" y="318" width="96" height="14" rx="5" fill="#8EC5FF" />
      <path className={s.drip} d="M226 336c-5 8-5 13 0 13s5-5 0-13z" fill="#8EC5FF" />
      {/* mur */}
      <rect x="306" y="272" width="186" height="84" rx="8" fill="#0B1E21" stroke="#2F5C64" strokeWidth="3" />
      {[[324, "#F4B942", 0], [380, "#6EE0B5", .5], [436, "#FF8FA3", 1]].map(([x, c, d]) => <g key={x as number} className={s.sway} style={{ animationDelay: `${d}s` }}><rect x={x as number} y="284" width="44" height="48" rx="4" fill={c as string} /><line x1={(x as number) + 8} y1="302" x2={(x as number) + 34} y2="302" stroke="#10272B" strokeWidth="3" /><line x1={(x as number) + 8} y1="314" x2={(x as number) + 26} y2="314" stroke="#10272B" strokeWidth="3" /></g>)}
    </svg>
  );
}

const Frame = ({ children }: { children: React.ReactNode }) => (
  <svg className={s.art} viewBox="0 0 160 110" aria-hidden="true">{children}</svg>
);

const FEATURES = [
  { t: "Des points, pas des disputes", p: "Un système de points clair pour les règles de la maison. Chaque décision est écrite, expliquée et consultable par tous.",
    art: <Frame><circle cx="80" cy="55" r="34" fill="none" stroke="#2F5C64" strokeWidth="10" /><circle className={s.gauge} cx="80" cy="55" r="34" fill="none" stroke="#6EE0B5" strokeWidth="10" strokeLinecap="round" transform="rotate(-90 80 55)" /><text className={s.rise} x="64" y="60" fill="#F4B942" fontSize="16" fontWeight="800">+10</text></Frame> },
  { t: "Les comptes, sans calculette", p: "Qui a payé quoi, qui doit combien. La part de chacun se calcule toute seule, et les rapports du mois s'exportent.",
    art: <Frame>{[40, 62, 28, 74, 50].map((h, i) => <rect key={i} className={s.bar} style={{ animationDelay: `${i * .25}s` }} x={20 + i * 26} y={95 - h} width="18" height={h} rx="4" fill={i % 2 ? "#F4B942" : "#8EC5FF"} />)}<circle className={s.fall} cx="80" cy="14" r="7" fill="#F4B942" /></Frame> },
  { t: "Le ménage tourne tout seul", p: "Chaque semaine, chacun voit sa tâche et la coche quand c'est fait. Plus besoin de rappeler qui doit passer la serpillière.",
    art: <Frame>{[0, 1, 2].map((i) => <g key={i}><rect x="26" y={20 + i * 28} width="20" height="20" rx="5" fill="none" stroke="#6EE0B5" strokeWidth="3" /><path className={s.tick} style={{ animationDelay: `${i * 1.2}s` }} d={`M30 ${30 + i * 28}l5 5 8-10`} fill="none" stroke="#6EE0B5" strokeWidth="4" strokeLinecap="round" /><rect x="56" y={26 + i * 28} width={80 - i * 14} height="8" rx="4" fill="#2F5C64" /></g>)}</Frame> },
  { t: "Un mur pour toute la maison", p: "Annonces, courses, rappels : tout le monde lit la même chose, au même endroit, sans fouiller dans un groupe de discussion.",
    art: <Frame>{[[22, "#F4B942", 0], [66, "#6EE0B5", .6], [110, "#FF8FA3", 1.2]].map(([x, c, d]) => <g key={x as number} className={s.sway} style={{ animationDelay: `${d}s` }}><rect x={x as number} y="18" width="36" height="60" rx="4" fill={c as string} /><circle cx={(x as number) + 18} cy="22" r="3" fill="#10272B" /><line x1={(x as number) + 7} y1="40" x2={(x as number) + 29} y2="40" stroke="#10272B" strokeWidth="3" /><line x1={(x as number) + 7} y1="52" x2={(x as number) + 22} y2="52" stroke="#10272B" strokeWidth="3" /></g>)}</Frame> },
  { t: "Une alerte quand ça vous concerne", p: "Installez HOUSEMATE sur l'écran d'accueil : une notification arrive sur votre téléphone dès qu'il se passe quelque chose pour vous.",
    art: <Frame><rect x="52" y="8" width="56" height="94" rx="10" fill="none" stroke="#8EC5FF" strokeWidth="4" /><circle className={s.ripple} cx="80" cy="46" r="18" fill="none" stroke="#F4B942" strokeWidth="3" /><g className={s.ring}><path d="M80 32a11 11 0 0 1 11 11v8l5 6H64l5-6v-8a11 11 0 0 1 11-11z" fill="#F4B942" /></g></Frame> },
  { t: "Une photo, un avis neutre", p: "Prenez la cuisine en photo : l'IA décrit ce qu'elle voit, sans accuser personne. Les administrateurs décident de la suite.",
    art: <Frame><rect x="28" y="12" width="104" height="86" rx="10" fill="#0B1E21" stroke="#6EE0B5" strokeWidth="4" /><rect x="44" y="58" width="30" height="28" rx="4" fill="#2F5C64" /><circle cx="100" cy="40" r="12" fill="#F4B942" opacity=".8" /><rect className={s.scan} x="32" y="18" width="96" height="5" rx="2.5" fill="#6EE0B5" /></Frame> },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className={s.page}>
      <section className={s.hero}>
        <div>
          <span className={s.brand}>HOUSEMATE</span>
          <h1 className={s.h1}>La maison tourne, vous vivez.</h1>
          <p className={s.lead}>Ménage, comptes, réparations, annonces : chacun sait quoi faire, et tout est noté. Le tout, sans prise de tête.</p>
          <House />
        </div>
        <form action={login} className={s.card}>
          <h2>Retrouvez votre maison</h2>
          <label className={s.field}>Adresse e-mail<input name="email" type="email" required autoComplete="email" /></label>
          <label className={s.field}>Mot de passe<PasswordField autoComplete="current-password" /></label>
          {error && <p role="alert" className={s.err}>Identifiants invalides.</p>}
          <SubmitButton className={s.cta}>Se connecter</SubmitButton>
          <div className={s.links}><Link href="/signup">Créer mon compte</Link><Link href="/reset">Mot de passe oublié</Link></div>
        </form>
      </section>
      <section className={s.features} aria-label="Ce que fait HOUSEMATE">
        {FEATURES.map((f) => (
          <article key={f.t} className={s.feat}><div><h2>{f.t}</h2><p>{f.p}</p></div>{f.art}</article>
        ))}
      </section>
      <p className={s.foot}>Historique complet, membres et rapports : tout est au même endroit, pour toute la maison.</p>
    </main>
  );
}
