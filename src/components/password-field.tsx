"use client";
import { useState } from "react";

export function PasswordField({ name = "password", autoComplete, minLength, className }: { name?: string; autoComplete?: string; minLength?: number; className?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input name={name} type={show ? "text" : "password"} required minLength={minLength} autoComplete={autoComplete} className={className} style={{ paddingRight: "5rem" }} />
      <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show}
        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: 0, color: "#6EE0B5", font: "inherit", fontSize: ".85rem", cursor: "pointer" }}>
        {show ? "Masquer" : "Voir"}
      </button>
    </div>
  );
}
