import { describe, expect, it } from "vitest";
import { currentMonth, isMonthKey, monthRange, shiftMonth, toDateInput } from "./dates";

// 2026-10-13T05:00Z = 12:00 WIB
const NOW = new Date("2026-10-13T05:00:00Z");

describe("currentMonth / isMonthKey", () => {
  it("uses Jakarta time", () => {
    expect(currentMonth(NOW)).toBe("2026-10");
    // 2026-10-31T18:00Z is Nov 1, 01:00 in Jakarta.
    expect(currentMonth(new Date("2026-10-31T18:00:00Z"))).toBe("2026-11");
  });

  it("validates the YYYY-MM shape", () => {
    expect(isMonthKey("2026-10")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("26-10")).toBe(false);
    expect(isMonthKey("2026-1")).toBe(false);
    expect(isMonthKey(5)).toBe(false);
  });
});

describe("monthRange", () => {
  it("bounds the month in Jakarta time", () => {
    const { start, end } = monthRange("2026-10");
    expect(start.toISOString()).toBe("2026-09-30T17:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-31T17:00:00.000Z");
  });
});

describe("shiftMonth", () => {
  it("wraps across years", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});

describe("toDateInput", () => {
  it("returns the Jakarta date", () => {
    expect(toDateInput(NOW)).toBe("2026-10-13");
    expect(toDateInput(new Date("2026-10-13T17:30:00Z"))).toBe("2026-10-14");
  });
});
