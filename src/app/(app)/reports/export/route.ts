import { getContext } from "@/lib/session";
import { isPeriod, loadReport } from "@/server/report-data";

// Neutralise l'injection de formules dans Excel/Sheets.
const cell = (v: string | number) => {
  const s = String(v);
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET(req: Request) {
  const period = new URL(req.url).searchParams.get("period") ?? "";
  if (!isPeriod(period)) return new Response("période invalide", { status: 400 });
  const ctx = await getContext();
  const r = await loadReport(ctx, period);
  const rows: (string | number)[][] = [
    ["Section", "Libellé", "Valeur 1", "Valeur 2", "Valeur 3"],
    ...r.scores.map((s) => ["Score", s.name, s.start, s.lost, s.final]),
    ...r.expenses.map((e) => ["Dépense", e.title, e.category, e.spent_on, (Number(e.amount_minor) / 100).toFixed(2)]),
    ["Total dépenses (MAD)", "", "", "", (r.total / 100).toFixed(2)],
  ];
  const csv = "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="housemate-${period}.csv"` },
  });
}
