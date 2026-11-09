"use client";

import { btnGhost } from "@/components/ui";

export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className={btnGhost}>Exporter en PDF</button>;
}
