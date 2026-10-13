import { describe, expect, it } from "vitest";
import { formatCompact, parseAmount } from "./money";

describe("parseAmount", () => {
  it("parses suffixed amounts", () => {
    expect(parseAmount("25rb")).toBe(25_000);
    expect(parseAmount("25 ribu")).toBe(25_000);
    expect(parseAmount("1,5jt")).toBe(1_500_000);
    expect(parseAmount("2.5 juta")).toBe(2_500_000);
    expect(parseAmount("5m")).toBe(5_000_000_000);
  });

  it("parses thousands-separated amounts", () => {
    expect(parseAmount("25.000")).toBe(25_000);
    expect(parseAmount("1.500.000")).toBe(1_500_000);
    expect(parseAmount("1,500,000")).toBe(1_500_000);
    expect(parseAmount("Rp 1.500")).toBe(1_500);
  });

  it("reads bare decimals as fractions of a thousand", () => {
    expect(parseAmount("1,5")).toBe(1_500);
    expect(parseAmount("2,5")).toBe(2_500);
  });

  it("rounds fractional rupiah over 1000", () => {
    expect(parseAmount("1500,75")).toBe(1_501);
  });

  it("rejects ambiguous bare numbers and zero", () => {
    expect(parseAmount("25")).toBeNull();
    expect(parseAmount("500")).toBeNull();
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("kopi")).toBeNull();
  });

  it("accepts plain rupiah at 1000+", () => {
    expect(parseAmount("25000")).toBe(25_000);
    expect(parseAmount("1000")).toBe(1_000);
  });
});

describe("formatCompact", () => {
  it("formats rupiah ranges", () => {
    expect(formatCompact(25000)).toBe("Rp25rb");
    expect(formatCompact(1_500_000)).toBe("Rp1,5jt");
    expect(formatCompact(-2500)).toBe("-Rp2,5rb");
    expect(formatCompact(500)).toBe("Rp500");
  });
});
