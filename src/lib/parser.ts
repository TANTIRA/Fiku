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

const AMOUNT_GLOBAL = new RegExp(AMOUNT_PATTERN.source, "gi");

/** Valid amount matches only — bare numbers that parse to nothing are skipped. */
function* matchAmounts(text: string) {
  for (const m of text.matchAll(AMOUNT_GLOBAL)) {
    const amount = amountFromMatch(m[1], m[2]);
    if (amount) yield { match: m, amount };
  }
}

export function hasAmount(text: string): boolean {
  return !matchAmounts(text).next().done;
}

function parseOne(segment: string, now: Date): ParsedTransaction | null {
  const hit = matchAmounts(segment).next().value;
  if (!hit) return null;
  const { amount } = hit;

  let rest = segment.replace(hit.match[0], " ");
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

  // Detect income/expense on the cleaned text so counterparty names don't trigger income words.
  const kind = detectKind(rest.trim() || segment);
  const description =
    rest.replace(/\b(tf|trf)\b/gi, "transfer").replace(FILLER, " ").replace(/\s+/g, " ").replace(/^[\s,.-]+|[\s,.-]+$/g, "").trim() ||
    counterparty ||
    (kind === "income" ? "Pemasukan" : "Pengeluaran");

  return {
    kind,
    amount,
    description: titleCase(description).slice(0, 200),
    counterparty: counterparty ? titleCase(counterparty).slice(0, 100) : null,
    occurredAt,
  };
}

/**
 * Split "bensin 30rb parkir 5rb" at each amount: the words before an amount
 * describe that amount's transaction ("bensin" → 30rb, "parkir" → 5rb).
 * Leftover words after the last amount stay with it.
 */
function splitOnAmounts(segment: string): string[] {
  const hits = [...matchAmounts(segment)];
  if (hits.length <= 1) return [segment];
  const pieces: string[] = [];
  let start = 0;
  for (const hit of hits) {
    const end = hit.match.index! + hit.match[0].length;
    pieces.push(segment.slice(start, end));
    start = end;
  }
  const tail = segment.slice(start).trim();
  if (tail) pieces[pieces.length - 1] += ` ${tail}`;
  return pieces.filter((p) => p.trim());
}

/**
 * Turn free text like "makan siang 25rb, parkir 5rb kemarin" into transactions.
 * Rule-based so it works without an LLM; the LLM path uses the same normalizers.
 */
export function parseTransactions(text: string, now = new Date()): ParsedTransaction[] {
  const cleaned = text.trim();
  if (!cleaned) return [];
  // Separated parts without an amount belong to the previous item ("makan 25rb, parkir").
  const segments: string[] = [];
  for (const part of cleaned.split(SPLIT).filter(Boolean)) {
    if (hasAmount(part) || !segments.length) segments.push(part);
    else segments[segments.length - 1] += ` ${part}`;
  }
  const parsed = segments
    .flatMap(splitOnAmounts)
    .map((s) => parseOne(s, now))
    .filter((t): t is ParsedTransaction => t !== null);
  // "bensin 30rb, parkir 5rb kemarin": a single date word applies to the whole message.
  const dated = parsed.filter((t) => t.occurredAt !== now);
  if (dated.length === 1) for (const t of parsed) t.occurredAt = dated[0].occurredAt;
  return parsed;
}
