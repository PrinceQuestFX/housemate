import { SubmitButton } from "@/components/submit-button";
import { getContext, currentPeriod } from "@/lib/session";
import { isPeriod, loadReport } from "@/server/report-data";
import { CATEGORIES } from "@/lib/labels";
import { fmt } from "@/lib/money";
import { PrintButton } from "@/components/print-button";
import { card, input } from "@/components/ui";

function recentPeriods(n = 12) {
  const [y, m] = currentPeriod().split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period: q } = await searchParams;
  const period = q && isPeriod(q) ? q : currentPeriod();
  const ctx = await getContext();
  const r = await loadReport(ctx, period);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <h1 className="text-2xl font-semibold">Rapport mensuel</h1>
        <form className="flex gap-2">
          <select name="period" defaultValue={period} className={input}>{recentPeriods().map((p) => <option key={p}>{p}</option>)}</select>
          <SubmitButton className="rounded-lg border px-3 text-sm">Afficher</SubmitButton>
        </form>
      </div>
      <h1 className="hidden text-2xl font-semibold print:block">HOUSEMATE · Bilan {period}</h1>

      <section className={card}>
        <h2 className="mb-2 font-medium">Classement</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th>Membre</th><th>Départ</th><th>Perdus</th><th>Final</th></tr></thead>
          <tbody>{r.scores.map((s) => <tr key={s.name}><td>{s.name}</td><td>{s.start}</td><td>{s.lost}</td><td>{s.final}{s.final === 200 ? " 🏅" : ""}</td></tr>)}</tbody>
        </table>
        <p className="mt-2 text-xs text-neutral-500">Infractions validées : {r.infractions} · Tâches validées : {r.tasksDone}/{r.tasksTotal}</p>
      </section>

      <section className={card}>
        <h2 className="mb-2 font-medium">Dépenses : {fmt(r.total)}</h2>
        <ul className="space-y-1 text-sm">
          {Object.entries(r.byCategory).map(([k, v]) => <li key={k} className="flex justify-between"><span>{CATEGORIES[k]}</span><span>{fmt(v)}</span></li>)}
        </ul>
        {r.members.length > 0 && <p className="mt-2 text-xs text-neutral-500">Part moyenne par membre : {fmt(Math.round(r.total / r.members.length))}</p>}
      </section>

      <div className="flex gap-2 print:hidden">
        <a href={`/reports/export?period=${period}`} className="rounded-lg border px-4 py-2 text-sm">Exporter en CSV</a>
        <PrintButton />
      </div>
    </>
  );
}
