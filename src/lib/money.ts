export function toMinor(input: string): number {
  const n = Number(input.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) throw new Error("invalid_amount");
  return Math.round(n * 100);
}

export const fmt = (minor: number | string | bigint): string =>
  new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(Number(minor) / 100);
