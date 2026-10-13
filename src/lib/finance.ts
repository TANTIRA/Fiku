import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { monthRange, type MonthKey } from "@/lib/dates";
import { normalizeKey } from "@/lib/parser";
import * as ontology from "@/lib/ontology";
import type {
  Category,
  CategoryTotal,
  MonthlySummary,
  Necessity,
  NecessityBucket,
  Transaction,
  TxKind,
} from "@/lib/types";

const TX_COLUMNS =
  "id, kind, amount, category_id, description, counterparty, occurred_at, source, ontology_synced";

export type Session = {
  userId: string;
  email: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
};

/** Current user or null. Cached per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { userId: claims.sub, email: String(claims.email ?? ""), supabase };
});

/** Current user or redirect to /login. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function listCategories(session: Session): Promise<Category[]> {
  const { data, error } = await session.supabase
    .from("categories")
    .select("id, name, kind, parent_id, necessity, keywords, icon")
    .order("created_at");
  if (error) throw error;
  return data as Category[];
}

export async function listTransactions(
  session: Session,
  opts: { month?: MonthKey; kind?: TxKind; search?: string; limit?: number } = {},
): Promise<Transaction[]> {
  let q = session.supabase
    .from("transactions")
    .select(TX_COLUMNS)
    .order("occurred_at", { ascending: false })
    .limit(Math.min(opts.limit ?? 500, 1000));
  if (opts.month) {
    const { start, end } = monthRange(opts.month);
    q = q.gte("occurred_at", start.toISOString()).lt("occurred_at", end.toISOString());
  }
  if (opts.kind) q = q.eq("kind", opts.kind);
  if (opts.search) {
    const s = opts.search.replace(/[%,()]/g, " ").trim();
    if (s) q = q.or(`description.ilike.%${s}%,counterparty.ilike.%${s}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data as Transaction[]).map((t) => ({ ...t, amount: Number(t.amount) }));
}

/** Keep the ontology in step with the ledger; failures leave `ontology_synced = false` for retry. */
async function syncToOntology(session: Session, txs: Transaction[], categories?: Category[]) {
  if (txs.length === 0) return;
  try {
    await ontology.ensureUserGraph(session.userId, categories ?? (await listCategories(session)));
    const synced: string[] = [];
    for (const tx of txs) {
      await ontology.syncTransaction(session.userId, tx);
      synced.push(tx.id);
    }
    await session.supabase.from("transactions").update({ ontology_synced: true }).in("id", synced);
  } catch (err) {
    console.error("[ontology] sync failed:", err instanceof Error ? err.message : err);
  }
}

const lastUnsyncedRetry = new Map<string, number>();

export async function retryUnsynced(session: Session): Promise<void> {
  // Throttle: when TypeDB is down, retrying on every render stalls the page for seconds.
  const now = Date.now();
  if (now - (lastUnsyncedRetry.get(session.userId) ?? 0) < 60_000) return;
  lastUnsyncedRetry.set(session.userId, now);
  if (lastUnsyncedRetry.size > 1000) lastUnsyncedRetry.clear();

  const { data } = await session.supabase
    .from("transactions")
    .select(TX_COLUMNS)
    .eq("ontology_synced", false)
    .limit(200);
  if (data?.length) await syncToOntology(session, data as Transaction[]);
}

/** Ensure the user's graph exists; returns whether it did (so callers can skip re-checks). */
async function ensureGraph(session: Session, categories: Category[]): Promise<boolean> {
  try {
    await ontology.ensureUserGraph(session.userId, categories);
    return true;
  } catch (err) {
    console.error("[ontology] ensure graph failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Pick a category: (1) what this counterparty was filed under before (ontology),
 * (2) keyword match against category keywords, (3) the kind's catch-all.
 */
export async function categorize(
  session: Session,
  input: { kind: TxKind; description: string; counterparty?: string | null },
  categories: Category[],
  graphReady = false,
): Promise<{ category: Category; reason: "riwayat" | "kata kunci" | "default" }> {
  const ofKind = categories.filter((c) => c.kind === input.kind);
  const byId = new Map(ofKind.map((c) => [c.id, c]));

  try {
    if (!graphReady) await ontology.ensureUserGraph(session.userId, categories);
    for (const label of [input.counterparty, input.description]) {
      if (!label) continue;
      const id = await ontology.learnedCategory(session.userId, label, input.kind);
      if (id && byId.has(id)) return { category: byId.get(id)!, reason: "riwayat" };
    }
  } catch (err) {
    console.error("[ontology] categorize lookup failed:", err instanceof Error ? err.message : err);
  }

  const text = ` ${normalizeKey(`${input.description} ${input.counterparty ?? ""}`)} `;
  let best: { category: Category; len: number } | null = null;
  for (const c of ofKind) {
    for (const k of c.keywords) {
      const kw = normalizeKey(k);
      if (kw && text.includes(` ${kw} `) && (!best || kw.length > best.len)) {
        best = { category: c, len: kw.length };
      }
    }
  }
  if (best) return { category: best.category, reason: "kata kunci" };

  const leaves = ofKind.filter((c) => !ofKind.some((o) => o.parent_id === c.id));
  const fallback =
    leaves.find((c) => /lain/i.test(c.name)) ?? leaves[leaves.length - 1] ?? ofKind[0];
  return { category: fallback, reason: "default" };
}

export type NewTransaction = {
  kind: TxKind;
  amount: number;
  description: string;
  counterparty?: string | null;
  occurredAt?: Date;
  categoryId?: string | null;
  source?: "manual" | "assistant";
};

export async function createTransactions(
  session: Session,
  items: NewTransaction[],
  knownCategories?: Category[],
): Promise<(Transaction & { category: Category | null; categoryReason: string | null })[]> {
  if (items.length === 0) return [];
  const categories = knownCategories ?? (await listCategories(session));
  const graphReady = await ensureGraph(session, categories);
  const rows = [];
  const reasons: (string | null)[] = [];
  for (const item of items) {
    let categoryId = item.categoryId ?? null;
    let reason: string | null = categoryId ? "dipilih" : null;
    if (categoryId && !categories.some((c) => c.id === categoryId && c.kind === item.kind)) {
      categoryId = null;
    }
    if (!categoryId) {
      const picked = await categorize(session, item, categories, graphReady);
      categoryId = picked.category?.id ?? null;
      reason = picked.reason;
    }
    reasons.push(reason);
    rows.push({
      user_id: session.userId,
      kind: item.kind,
      amount: Math.round(item.amount),
      description: item.description.trim().slice(0, 200) || "Transaksi",
      counterparty: item.counterparty?.trim().slice(0, 100) || null,
      occurred_at: (item.occurredAt ?? new Date()).toISOString(),
      category_id: categoryId,
      source: item.source ?? "manual",
    });
  }

  const { data, error } = await session.supabase.from("transactions").insert(rows).select(TX_COLUMNS);
  if (error) throw error;
  const created = (data as Transaction[]).map((t) => ({ ...t, amount: Number(t.amount) }));
  await syncToOntology(session, created, categories);

  const byId = new Map(categories.map((c) => [c.id, c]));
  return created.map((t, i) => ({
    ...t,
    category: t.category_id ? byId.get(t.category_id) ?? null : null,
    categoryReason: reasons[i],
  }));
}

export async function updateTransactionCategory(
  session: Session,
  id: string,
  categoryId: string,
): Promise<void> {
  const { data, error } = await session.supabase
    .from("transactions")
    .update({ category_id: categoryId, ontology_synced: false })
    .eq("id", id)
    .select(TX_COLUMNS)
    .single();
  if (error) throw error;
  await syncToOntology(session, [{ ...(data as Transaction), amount: Number(data.amount) }]);
}

export async function deleteTransaction(session: Session, id: string): Promise<Transaction | null> {
  const { data, error } = await session.supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .select(TX_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  try {
    await ontology.removeTransaction(id);
  } catch (err) {
    console.error("[ontology] delete failed:", err instanceof Error ? err.message : err);
  }
  return (data as Transaction | null) ?? null;
}

export async function rebuildOntology(session: Session): Promise<number> {
  const categories = await listCategories(session);
  // PostgREST caps responses (max_rows); page through so nothing is silently skipped.
  const txs: Transaction[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await session.supabase
      .from("transactions")
      .select(TX_COLUMNS)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as Transaction[];
    txs.push(...rows);
    if (rows.length < PAGE) break;
  }
  for (const t of txs) t.amount = Number(t.amount);
  await ontology.rebuildUser(session.userId, categories, txs);
  if (txs.length) {
    await session.supabase.from("transactions").update({ ontology_synced: true }).in(
      "id",
      txs.map((t) => t.id),
    );
  }
  return txs.length;
}

function rootOf(id: string, byId: Map<string, Category>): Category | undefined {
  let c = byId.get(id);
  const seen = new Set<string>();
  while (c?.parent_id && !seen.has(c.id)) {
    seen.add(c.id);
    c = byId.get(c.parent_id) ?? c;
    if (!c.parent_id) break;
  }
  return c;
}

function necessityOf(id: string, byId: Map<string, Category>): Necessity | null {
  let c = byId.get(id);
  const seen = new Set<string>();
  while (c && !seen.has(c.id)) {
    if (c.necessity) return c.necessity;
    seen.add(c.id);
    c = c.parent_id ? byId.get(c.parent_id) : undefined;
  }
  return null;
}

function totalsBy(txs: Transaction[], keyOf: (t: Transaction) => { name: string; icon: string | null }) {
  const map = new Map<string, CategoryTotal>();
  for (const t of txs) {
    const { name, icon } = keyOf(t);
    const cur = map.get(name) ?? { name, icon, total: 0, count: 0 };
    cur.total += t.amount;
    cur.count += 1;
    map.set(name, cur);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export async function monthlySummary(session: Session, month: MonthKey): Promise<MonthlySummary> {
  const [txs, categories] = await Promise.all([
    listTransactions(session, { month, limit: 1000 }),
    listCategories(session),
  ]);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const expenses = txs.filter((t) => t.kind === "expense");
  const incomes = txs.filter((t) => t.kind === "income");
  const income = incomes.reduce((s, t) => s + t.amount, 0);
  const expense = expenses.reduce((s, t) => s + t.amount, 0);

  const label = (t: Transaction) => {
    const c = t.category_id ? byId.get(t.category_id) : undefined;
    return { name: c?.name ?? "Tanpa kategori", icon: c?.icon ?? "❔" };
  };

  let byRoot: CategoryTotal[];
  let byNecessity: Record<NecessityBucket, number>;
  let reasoning: MonthlySummary["reasoning"] = "typedb";

  try {
    const { start, end } = monthRange(month);
    const rollup = await ontology.expenseRollup(session.userId, start, end);
    const iconByName = new Map(categories.map((c) => [c.name, c.icon]));
    byRoot = rollup.byRoot.map((r) => ({ ...r, icon: iconByName.get(r.name) ?? null }));
    byNecessity = rollup.byNecessity;
    // Transactions not yet projected (or uncategorized) would be missing; fall back if totals differ.
    const projected = byRoot.reduce((s, r) => s + r.total, 0);
    if (projected !== expense) throw new Error(`ontology total ${projected} != ledger ${expense}`);
  } catch (err) {
    console.warn("[ontology] rollup fallback:", err instanceof Error ? err.message : err);
    reasoning = "fallback";
    byRoot = totalsBy(expenses, (t) => {
      const r = t.category_id ? rootOf(t.category_id, byId) : undefined;
      return { name: r?.name ?? "Tanpa kategori", icon: r?.icon ?? "❔" };
    });
    byNecessity = { kebutuhan: 0, keinginan: 0, tabungan: 0, uncategorized: 0 };
    for (const t of expenses) {
      const n = t.category_id ? necessityOf(t.category_id, byId) : null;
      byNecessity[n ?? "uncategorized"] += t.amount;
    }
  }

  return {
    month,
    income,
    expense,
    balance: income - expense,
    byRoot,
    byCategory: totalsBy(expenses, label),
    incomeByCategory: totalsBy(incomes, label),
    byNecessity,
    reasoning,
  };
}

export async function overallBalance(session: Session): Promise<number> {
  // Aggregate in Postgres: selecting raw rows would silently truncate at max_rows.
  const { data, error } = await session.supabase
    .from("transactions")
    .select("kind, amount.sum()");
  if (error) throw error;
  return (data as { kind: TxKind; sum: number | string }[]).reduce(
    (s, r) => s + (r.kind === "income" ? Number(r.sum) : -Number(r.sum)),
    0,
  );
}
