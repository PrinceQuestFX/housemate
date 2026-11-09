"use client";
import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes } from "react";

/** Bouton d'envoi : se grise et affiche une roue pendant que l'action s'exécute, pour qu'on sache que le clic est pris en compte. */
export function SubmitButton({ children, disabled, className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button {...rest} disabled={disabled || pending} aria-busy={pending} className={`${className} ${pending ? "cursor-wait opacity-70" : ""}`}>
      {pending && <span aria-hidden="true" className="mr-2 inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent align-[-2px]" />}
      {children}
    </button>
  );
}
