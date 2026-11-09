"use client";

import { useState } from "react";
import { btnGhost } from "@/components/ui";

type Result = { description?: string; problems?: string[]; category?: string; indicative_severity?: string | null };

export function AiAnalyze() {
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(e: React.MouseEvent<HTMLButtonElement>) {
    const input = e.currentTarget.form?.elements.namedItem("photo") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return setErr("Ajoutez d'abord une photo.");
    setBusy(true); setErr(""); setRes(null);
    const fd = new FormData();
    fd.set("photo", file);
    const r = await fetch("/api/ai/analyze", { method: "POST", body: fd });
    setBusy(false);
    if (!r.ok) return setErr(r.status === 429 ? "Trop d'analyses, réessayez dans quelques minutes." : "Analyse indisponible.");
    setRes(await r.json());
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={run} disabled={busy} className={btnGhost}>{busy ? "Analyse en cours…" : "Analyser avec l'IA (facultatif)"}</button>
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      {res && (
        <div className="space-y-1 rounded-lg bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
          <p>{res.description}</p>
          {!!res.problems?.length && <ul className="list-disc pl-5">{res.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
          <p className="text-neutral-500">Catégorie suggérée : {res.category ?? "—"} · gravité indicative : {res.indicative_severity ?? "—"}</p>
          <p className="text-xs text-neutral-500">Simple assistance : seuls les administrateurs décident d'une sanction.</p>
        </div>
      )}
    </div>
  );
}
