"use client";

import { useActionState } from "react";
import { addMember, type AddMemberState } from "@/server/admin-actions";
import { Field, btn, input } from "@/components/ui";

export function AddMemberForm() {
  const [state, action, pending] = useActionState<AddMemberState, FormData>(addMember, {});
  return (
    <form action={action} className="space-y-3">
      <Field label="Prénom"><input name="first" required className={input} /></Field>
      <Field label="Nom"><input name="last" required className={input} /></Field>
      <Field label="Adresse e-mail"><input name="email" type="email" required className={input} /></Field>
      <button disabled={pending} className={btn}>{pending ? "Création…" : "Inviter ce membre"}</button>
      {state.message && <p role="alert" className="text-sm text-red-600">{state.message}</p>}
      {state.ok && (
        <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-950">
          Compte créé. Mot de passe temporaire, à transmettre en main propre (affiché une seule fois) :{" "}
          <code className="font-mono">{state.password}</code>
        </p>
      )}
    </form>
  );
}
