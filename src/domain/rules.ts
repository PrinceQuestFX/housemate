// Règles métier pures, miroir des fonctions SQL. Aucune dépendance à Supabase.

export const MONTHLY_CAPITAL = 200;
export const SANCTION_POINTS = [10, 15, 20, 30] as const;
export type SanctionPoints = (typeof SANCTION_POINTS)[number];

export function isSanctionPoints(n: number): n is SanctionPoints {
  return (SANCTION_POINTS as readonly number[]).includes(n);
}

/** Score mensuel = 200 - sanctions validées (les annulations par vote sont des deltas positifs). */
export function monthlyScore(deltas: readonly number[]): number {
  return MONTHLY_CAPITAL + deltas.reduce((sum, d) => sum + d, 0);
}

export const earnsMonthlyCongratulations = (score: number): boolean => score === MONTHLY_CAPITAL;

/** Répartit un montant en centimes en parts entières ; le reste va aux premières parts. */
export function splitEqual(amountMinor: number, parts: number): number[] {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) throw new Error("invalid_amount");
  if (!Number.isInteger(parts) || parts <= 0) throw new Error("invalid_parts");
  const base = Math.floor(amountMinor / parts);
  const remainder = amountMinor - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
}

export type VoteOutcome = "open" | "upheld" | "overturned";

/** Majorité absolue des membres : 3 sur 5. */
export function resolveContest(votes: readonly ("uphold" | "overturn")[], memberCount: number): VoteOutcome {
  const threshold = Math.floor(memberCount / 2) + 1;
  const up = votes.filter((v) => v === "uphold").length;
  const down = votes.length - up;
  if (up >= threshold) return "upheld";
  if (down >= threshold) return "overturned";
  return "open";
}
