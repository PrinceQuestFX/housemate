"use client";

import { btn } from "@/components/ui";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="space-y-3 rounded-xl border border-red-300 p-6">
      <h2 className="font-medium">Cette action a échoué.</h2>
      <p className="text-sm text-neutral-600">
        Vérifiez les informations saisies ou vos droits, puis réessayez. Les règles de la maison peuvent refuser une action.
      </p>
      <button onClick={reset} className={btn}>Réessayer</button>
    </div>
  );
}
