import { AMOUNT_PATTERN, amountFromMatch } from "@/lib/money";
import { daysAgo } from "@/lib/dates";

export type TxKind = "income" | "expense";

export type ParsedTransaction = {
  kind: TxKind;
  amount: number;
  description: string;
  counterparty: string | null;
  occurredAt: Date;
};

const INCOME_WORDS = [
  "gaji", "gajian", "salary", "upah", "honor", "bonus", "thr", "insentif", "komisi",
  "terima", "menerima", "diterima", "dapat", "dapet", "dpt", "pemasukan", "masuk",
  "dikasih", "dikirim", "kiriman", "transferan", "angpao", "jual", "jualan", "terjual",
  "penjualan", "freelance", "dividen", "bunga", "cashback", "refund", "reimburse",
  "cuan", "untung", "profit", "pendapatan",
];

const DATE_WORDS: { pattern: RegExp; days: number | ((m: RegExpMatchArray) => number) }[] = [
  { pattern: /\bkemarin\s+lusa\b/i, days: 2 },
  { pattern: /\b(kemarin|kemaren|kmrn|kmarin)\b/i, days: 1 },
  { pattern: /\b(\d{1,2})\s+hari\s+(?:yang\s+)?(?:lalu|lalu|yg lalu)\b/i, days: (m) => Number(m[1]) },
  { pattern: /\bminggu\s+lalu\b/i, days: 7 },
  { pattern: /\b(hari\s+ini|tadi\s+pagi|tadi\s+siang|tadi\s+sore|tadi\s+malam|tadi|barusan|td)\b/i, days: 0 },
];

const FILLER = /\b(beli|bayar|buat|untuk|utk|abis|habis|sebesar|senilai|seharga|total|sekitar|aku|saya|gue|gw|habisin)\b/gi;

const SPLIT = /\s*(?:;|\n|,(?!\d)|\s+dan\s+|\s+&\s+|\s+terus\s+|\s+lalu\s+)\s*/i;

export function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s&]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

function titleCase(value: string): string {
  return value.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

export function detectKind(text: string): TxKind {
  const lower = text.toLowerCase();
  if (/\btransfer\s+(?:dari|masuk)\b/.test(lower)) return "income";
  if (/\b(transfer|kirim|tf)\s+ke\b/.test(lower)) return "expense";
  return INCOME_WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(lower)) ? "income" : "expense";
}

export function hasAmount(text: string): boolean {
  return AMOUNT_PATTERN.test(text);
}

function parseOne(segment: string, now: Date): ParsedTransaction | null {
  const match = segment.match(AMOUNT_PATTERN);
  if (!match) return null;
  const amount = amountFromMatch(match[1], match[2]);
  if (!amount) return null;

  let rest = segment.replace(match[0], " ");
  let occurredAt = now;
  for (const { pattern, days } of DATE_WORDS) {
    const m = rest.match(pattern);
    if (m) {
      const n = typeof days === "function" ? days(m) : days;
      occurredAt = n === 0 ? now : daysAgo(n, now);
      rest = rest.replace(m[0], " ");
      break;
    }
  }

  rest = rest.replace(/\s+/g, " ").trim();
  let counterparty: string | null = null;
  const cp = rest.match(/\b(?:di|dari|ke|@)\s+([\p{L}\p{N}][\p{L}\p{N}\s&'.-]{0,60})$/iu);
  if (cp) {
    counterparty = cp[1].replace(FILLER, " ").replace(/\s+/g, " ").trim() || null;
    rest = rest.slice(0, cp.index);
  }

  const description =
    rest.replace(/\b(tf|trf)\b/gi, "transfer").replace(FILLER, " ").replace(/\s+/g, " ").replace(/^[\s,.-]+|[\s,.-]+$/g, "").trim() ||
    counterparty ||
    (detectKind(segment) === "income" ? "Pemasukan" : "Pengeluaran");

  return {
    kind: detectKind(segment),
    amount,
    description: titleCase(description).slice(0, 200),
    counterparty: counterparty ? titleCase(counterparty).slice(0, 100) : null,
    occurredAt,
  };
}

/**
 * Turn free text like "makan siang 25rb, parkir 5rb kemarin" into transactions.
 * Rule-based so it works without an LLM; the LLM path uses the same normalizers.
 */
export function parseTransactions(text: string, now = new Date()): ParsedTransaction[] {
  const cleaned = text.trim();
  if (!cleaned) return [];
  const parts = cleaned.split(SPLIT).filter(Boolean);
  const segments = parts.length > 1 && parts.every(hasAmount) ? parts : [cleaned];
  const parsed = segments.map((s) => parseOne(s, now)).filter((t): t is ParsedTransaction => t !== null);
  // "bensin 30rb, parkir 5rb kemarin": a single date word applies to the whole message.
  const dated = parsed.filter((t) => t.occurredAt !== now);
  if (dated.length === 1) for (const t of parsed) t.occurredAt = dated[0].occurredAt;
  return parsed;
}
