import "server-only";
import { currentMonth, daysAgo, monthLabel, monthRange, shiftMonth, type MonthKey } from "@/lib/dates";
import {
  createTransactions,
  deleteTransaction,
  listCategories,
  listTransactions,
  monthlySummary,
  type Session,
} from "@/lib/finance";
import { formatCompact, formatRupiah } from "@/lib/money";
import * as ontology from "@/lib/ontology";
import { hasAmount, parseTransactions } from "@/lib/parser";
import type { TxKind } from "@/lib/types";

export type RecordedTx = {
  id: string;
  kind: TxKind;
  amount: number;
  description: string;
  counterparty: string | null;
  category: string;
  icon: string;
  reason: string | null;
  occurredAt: string;
};

export type RecordInput = {
  kind: TxKind;
  amount: number;
  description: string;
  counterparty?: string | null;
  categoryName?: string | null;
  daysAgo?: number;
};

export async function recordTransactions(session: Session, items: RecordInput[]): Promise<RecordedTx[]> {
  const categories = await listCategories(session);
  const byName = new Map(categories.map((c) => [`${c.kind}:${c.name.toLowerCase()}`, c.id]));
  const now = new Date();
  const created = await createTransactions(
    session,
    items.map((i) => ({
      kind: i.kind,
      amount: i.amount,
      description: i.description,
      counterparty: i.counterparty ?? null,
      categoryId: i.categoryName ? byName.get(`${i.kind}:${i.categoryName.toLowerCase()}`) ?? null : null,
      occurredAt: i.daysAgo ? daysAgo(Math.min(Math.max(i.daysAgo, 0), 365), now) : now,
      source: "assistant",
    })),
  );
  return created.map((t) => ({
    id: t.id,
    kind: t.kind,
    amount: t.amount,
    description: t.description,
    counterparty: t.counterparty,
    category: t.category?.name ?? "Tanpa kategori",
    icon: t.category?.icon ?? "❔",
    reason: t.categoryReason,
    occurredAt: t.occurred_at,
  }));
}

export async function summaryFor(session: Session, month: MonthKey) {
  const s = await monthlySummary(session, month);
  return {
    month,
    label: monthLabel(month),
    income: s.income,
    expense: s.expense,
    balance: s.balance,
    byGroup: s.byRoot.map(({ name, total, count }) => ({ name, total, count })),
    topCategories: s.byCategory.slice(0, 6).map(({ name, total, count }) => ({ name, total, count })),
    incomeSources: s.incomeByCategory.map(({ name, total }) => ({ name, total })),
    rule503020: {
      kebutuhanPct: s.income ? Math.round((s.byNecessity.kebutuhan / s.income) * 100) : null,
      keinginanPct: s.income ? Math.round((s.byNecessity.keinginan / s.income) * 100) : null,
      tabunganPct: s.income ? Math.round((s.byNecessity.tabungan / s.income) * 100) : null,
    },
  };
}

export async function findTransactions(
  session: Session,
  opts: { month?: MonthKey; kind?: TxKind; search?: string; limit?: number },
) {
  const [txs, categories] = await Promise.all([
    listTransactions(session, { ...opts, limit: Math.min(opts.limit ?? 15, 50) }),
    listCategories(session),
  ]);
  const byId = new Map(categories.map((c) => [c.id, c.name]));
  return txs.map((t) => ({
    id: t.id,
    kind: t.kind,
    amount: t.amount,
    description: t.description,
    counterparty: t.counterparty,
    category: t.category_id ? byId.get(t.category_id) ?? null : null,
    occurredAt: t.occurred_at,
  }));
}

export async function topPlaces(session: Session, month: MonthKey) {
  const { start, end } = monthRange(month);
  try {
    return await ontology.topCounterparties(session.userId, start, end);
  } catch {
    return [];
  }
}

export async function removeTransaction(session: Session, id: string) {
  const tx = await deleteTransaction(session, id);
  return tx ? { deleted: true, description: tx.description, amount: Number(tx.amount) } : { deleted: false };
}

export function categoryNames(categories: Awaited<ReturnType<typeof listCategories>>) {
  const leaf = (kind: TxKind) =>
    categories
      .filter((c) => c.kind === kind && !categories.some((o) => o.parent_id === c.id))
      .map((c) => c.name);
  return { expense: leaf("expense"), income: leaf("income") };
}

// ---------------------------------------------------------------------------
// Offline brain: rule-based replies when no LLM is configured.
// ---------------------------------------------------------------------------

export type OfflineReply = { text: string; recorded?: RecordedTx[] };

function monthFromText(text: string): MonthKey {
  return /bulan\s+(lalu|kemarin|kemaren)/i.test(text) ? shiftMonth(currentMonth(), -1) : currentMonth();
}

export async function offlineReply(session: Session, raw: string): Promise<OfflineReply> {
  const text = raw.trim();
  const lower = text.toLowerCase();

  if (/^(hai|halo|hello|hi|hei|pagi|siang|sore|malam)\b/.test(lower) && !hasAmount(text)) {
    return {
      text:
        "Halo! Aku Fuku 🪙 Ceritakan uang masuk/keluarmu, misalnya \"makan siang 25rb\" atau \"gajian 7,5jt\". Bisa juga tanya \"ringkasan bulan ini\".",
    };
  }

  if (/^(hapus|batal|batalkan|undo|salah)\b/.test(lower)) {
    const [last] = (await listTransactions(session, { limit: 20 })).filter((t) => t.source === "assistant");
    if (!last) return { text: "Belum ada catatan dari chat yang bisa kuhapus." };
    await deleteTransaction(session, last.id);
    return { text: `Oke, catatan "${last.description}" (${formatRupiah(last.amount)}) sudah kuhapus. 🧹` };
  }

  if (hasAmount(text) && !/\b(berapa|ringkas|rangkum)\b/.test(lower)) {
    const parsed = parseTransactions(text);
    if (parsed.length) {
      const recorded = await recordTransactions(
        session,
        parsed.map((p) => ({
          kind: p.kind,
          amount: p.amount,
          description: p.description,
          counterparty: p.counterparty,
          daysAgo: Math.round((Date.now() - p.occurredAt.getTime()) / 86_400_000),
        })),
      );
      const total = recorded.reduce((s, r) => s + (r.kind === "income" ? r.amount : -r.amount), 0);
      const lines = recorded.map(
        (r) => `• ${r.icon} ${r.description} — ${r.kind === "income" ? "+" : "−"}${formatRupiah(r.amount)} (${r.category})`,
      );
      const cheer = total >= 0 ? "Asyik, koinku nambah! ✨" : "Siap, sudah kucatat!";
      return { text: `${cheer}\n${lines.join("\n")}\n\nKalau kategorinya salah, ganti di halaman Transaksi ya — aku akan ingat.`, recorded };
    }
  }

  if (/(paling|terbesar|boros|sering|di ?mana|dimana)/.test(lower)) {
    const month = monthFromText(lower);
    const [s, places] = await Promise.all([summaryFor(session, month), topPlaces(session, month)]);
    if (!s.expense) return { text: `Belum ada pengeluaran di ${s.label}.` };
    const cats = s.topCategories.slice(0, 3).map((c, i) => `${i + 1}. ${c.name} — ${formatCompact(c.total)} (${c.count}×)`);
    const plc = places.slice(0, 3).map((p, i) => `${i + 1}. ${p.name} — ${formatCompact(p.total)} (${p.count}×)`);
    return {
      text: `Pengeluaran terbesar ${s.label}:\n${cats.join("\n")}${plc.length ? `\n\nPaling sering bayar ke:\n${plc.join("\n")}` : ""}`,
    };
  }

  if (/(ringkas|rangkum|bulan|total|saldo|sisa|pengeluaran|pemasukan|berapa|laporan|rekap)/.test(lower)) {
    const month = monthFromText(lower);
    const s = await summaryFor(session, month);
    if (!s.income && !s.expense) return { text: `Belum ada catatan di ${s.label}. Yuk mulai: "kopi 20rb".` };
    const groups = s.byGroup.map((g) => `• ${g.name}: ${formatCompact(g.total)}`).join("\n");
    const rule =
      s.rule503020.kebutuhanPct !== null
        ? `\n\n50/30/20 → kebutuhan ${s.rule503020.kebutuhanPct}%, keinginan ${s.rule503020.keinginanPct}%, tabungan ${s.rule503020.tabunganPct}%.`
        : "";
    return {
      text: `Rekap ${s.label}:\nMasuk ${formatRupiah(s.income)}\nKeluar ${formatRupiah(s.expense)}\nSisa ${formatRupiah(s.balance)}${groups ? `\n\n${groups}` : ""}${rule}`,
    };
  }

  return {
    text:
      "Hmm, aku belum paham 🤔 Coba:\n• \"bensin 30rb, parkir 5rb\"\n• \"gaji 7,5jt\"\n• \"ringkasan bulan ini\"\n• \"paling boros di mana?\"\n• \"hapus terakhir\"",
  };
}
