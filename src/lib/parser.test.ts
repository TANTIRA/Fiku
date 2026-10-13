import { describe, expect, it } from "vitest";
import { hasAmount, parseTransactions } from "./parser";

const NOW = new Date("2026-10-13T05:00:00Z"); // 12:00 WIB

describe("hasAmount", () => {
  it("detects only amounts that parse", () => {
    expect(hasAmount("kopi 25rb")).toBe(true);
    expect(hasAmount("kopi 25000")).toBe(true);
    expect(hasAmount("kopi 25")).toBe(false); // ambiguous bare number
    expect(hasAmount("kopi")).toBe(false);
  });
});

describe("parseTransactions", () => {
  it("parses a single expense", () => {
    const [t] = parseTransactions("makan siang 25rb", NOW);
    expect(t).toMatchObject({ kind: "expense", amount: 25_000, description: "Makan Siang" });
  });

  it("splits comma-separated items", () => {
    const txs = parseTransactions("bensin 30rb, parkir 5rb", NOW);
    expect(txs).toHaveLength(2);
    expect(txs.map((t) => t.amount)).toEqual([30_000, 5_000]);
    expect(txs[1].description).toBe("Parkir");
  });

  it("splits multiple amounts without separators", () => {
    const txs = parseTransactions("bensin 30rb parkir 5rb", NOW);
    expect(txs).toHaveLength(2);
    expect(txs.map((t) => [t.amount, t.description])).toEqual([
      [30_000, "Bensin"],
      [5_000, "Parkir"],
    ]);
  });

  it("merges amount-less parts into the previous description", () => {
    const txs = parseTransactions("makan 25rb, parkir", NOW);
    expect(txs).toHaveLength(1);
    expect(txs[0].amount).toBe(25_000);
    expect(txs[0].description).toBe("Makan Parkir");
  });

  it("detects income words", () => {
    const [t] = parseTransactions("gajian 7,5jt", NOW);
    expect(t).toMatchObject({ kind: "income", amount: 7_500_000 });
  });

  it("does not treat counterparty names as income words", () => {
    const [t] = parseTransactions("bayar 50rb ke jualan budi", NOW);
    expect(t.kind).toBe("expense");
    expect(t.counterparty).toBe("Jualan Budi");
  });

  it("extracts the counterparty", () => {
    const [t] = parseTransactions("kopi di kenangan 28rb", NOW);
    expect(t).toMatchObject({ kind: "expense", amount: 28_000, counterparty: "Kenangan" });
  });

  it("applies date words to every item", () => {
    const txs = parseTransactions("bensin 30rb parkir 5rb kemarin", NOW);
    const day = 24 * 60 * 60 * 1000;
    for (const t of txs) {
      expect(t.occurredAt.getTime()).toBe(NOW.getTime() - day);
    }
  });

  it("returns [] for empty or amount-less input", () => {
    expect(parseTransactions("", NOW)).toEqual([]);
    expect(parseTransactions("halo fuku", NOW)).toEqual([]);
  });
});
