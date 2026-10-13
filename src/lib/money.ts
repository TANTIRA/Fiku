const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function formatRupiah(amount: number): string {
  return idr.format(amount);
}

export function formatCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}Rp${trim(abs / 1_000_000_000)}M`;
  if (abs >= 1_000_000) return `${sign}Rp${trim(abs / 1_000_000)}jt`;
  if (abs >= 1_000) return `${sign}Rp${trim(abs / 1_000)}rb`;
  return `${sign}Rp${abs}`;
}

function trim(n: number) {
  return n.toLocaleString("id-ID", { maximumFractionDigits: 1 });
}

const MULTIPLIERS: Record<string, number> = {
  rb: 1_000,
  ribu: 1_000,
  k: 1_000,
  jt: 1_000_000,
  juta: 1_000_000,
  m: 1_000_000_000,
  miliar: 1_000_000_000,
  milyar: 1_000_000_000,
};

export const AMOUNT_PATTERN =
  /(?:rp\.?\s*)?(\d+(?:[.,]\d+)*)\s*(rb|ribu|k|jt|juta|miliar|milyar|m)?(?![a-z])/i;

/**
 * Parse Indonesian-style amounts: "25rb", "25 ribu", "1,5jt", "Rp 25.000", "25000", "2.5 juta".
 * Returns null if nothing that looks like money is found.
 */
export function parseAmount(raw: string): number | null {
  const match = raw.match(AMOUNT_PATTERN);
  if (!match) return null;
  return amountFromMatch(match[1], match[2]);
}

export function amountFromMatch(digits: string, suffix?: string): number | null {
  let value: number;
  if (suffix) {
    // With a multiplier, a single separator is a decimal mark ("1,5jt", "2.5jt").
    const parts = digits.split(/[.,]/);
    value =
      parts.length === 2 && parts[1].length <= 2
        ? Number(`${parts[0]}.${parts[1]}`)
        : Number(digits.replace(/[.,]/g, ""));
    value *= MULTIPLIERS[suffix.toLowerCase()];
  } else {
    // Without a multiplier, separators are thousands marks ("25.000", "1,500,000").
    const parts = digits.split(/[.,]/);
    const last = parts[parts.length - 1];
    value =
      parts.length > 1 && last.length !== 3
        ? Number(`${parts.slice(0, -1).join("")}.${last}`)
        : Number(digits.replace(/[.,]/g, ""));
  }
  const rounded = Math.round(value);
  return Number.isFinite(rounded) && rounded > 0 ? rounded : null;
}
