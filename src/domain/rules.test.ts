import { describe, expect, it } from "vitest";
import {
  earnsMonthlyCongratulations, isSanctionPoints, monthlyScore, resolveContest, splitEqual,
} from "./rules";

describe("points", () => {
  it("accepte uniquement 20, 30, 50", () => {
    expect([10, 20, 25, 30, 40, 50].filter(isSanctionPoints)).toEqual([20, 30, 50]);
  });
  it("calcule le score mensuel", () => {
    expect(monthlyScore([])).toBe(200);
    expect(monthlyScore([-20, -50])).toBe(130);
    expect(monthlyScore([-30, 30])).toBe(200); // sanction annulée par vote
  });
  it("félicite uniquement à 200", () => {
    expect(earnsMonthlyCongratulations(200)).toBe(true);
    expect(earnsMonthlyCongratulations(180)).toBe(false);
  });
});

describe("répartition des dépenses", () => {
  it("1000 DH / 5 = 200 DH chacun", () => {
    expect(splitEqual(100_000, 5)).toEqual([20_000, 20_000, 20_000, 20_000, 20_000]);
  });
  it("conserve le total quand le montant ne se divise pas", () => {
    const shares = splitEqual(1_000, 3);
    expect(shares).toEqual([334, 333, 333]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(1_000);
  });
  it("refuse les montants invalides", () => {
    expect(() => splitEqual(0, 5)).toThrow();
    expect(() => splitEqual(10.5, 5)).toThrow();
  });
});

describe("vote de contestation", () => {
  it("reste ouvert sans majorité", () => {
    expect(resolveContest(["uphold", "overturn"], 5)).toBe("open");
  });
  it("3 sur 5 pour maintenir", () => {
    expect(resolveContest(["uphold", "uphold", "overturn", "uphold"], 5)).toBe("upheld");
  });
  it("3 sur 5 pour annuler", () => {
    expect(resolveContest(["overturn", "overturn", "uphold", "overturn"], 5)).toBe("overturned");
  });
});
