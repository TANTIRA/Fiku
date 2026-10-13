import "server-only";
import { datetime, readRows, str, write } from "@/lib/typedb";
import { normalizeKey } from "@/lib/parser";
import type { Category, Necessity, Transaction } from "@/lib/types";

/**
 * TypeDB projection of the ledger. Postgres stays the system of record; this graph holds
 * the knowledge the assistant reasons over: the category hierarchy (with necessity
 * inherited from ancestors), counterparties, and which categories they were filed under.
 */

export function counterpartyKey(userId: string, tx: Pick<Transaction, "counterparty" | "description">) {
  const label = normalizeKey(tx.counterparty || tx.description);
  return label ? { key: `${userId}:${label}`, label } : null;
}

async function existingCategoryIds(userId: string): Promise<Set<string> | null> {
  const rows = await readRows(`
    match $u isa person, has ref-id ${str(userId)};
    try { owning (owner: $u, owned: $c); $c isa category, has ref-id $id; };
    select $id;`);
  if (rows.length === 0) return null; // person missing
  return new Set(rows.map((r) => r.id).filter((id): id is string => typeof id === "string"));
}

/** Make sure the person and all their categories (plus hierarchy) exist in the graph. */
export async function ensureUserGraph(userId: string, categories: Category[]): Promise<void> {
  let existing = await existingCategoryIds(userId);
  if (existing === null) {
    await write(`insert $u isa person, has ref-id ${str(userId)};`);
    existing = new Set();
  }
  const missing = categories.filter((c) => !existing.has(c.id));
  if (missing.length === 0) return;

  const inserts = missing.map((c, i) => {
    const attrs = [
      `has ref-id ${str(c.id)}`,
      `has name ${str(c.name)}`,
      `has flow ${str(c.kind)}`,
      ...(c.necessity ? [`has necessity ${str(c.necessity)}`] : []),
      ...c.keywords.map((k) => `has keyword ${str(k.toLowerCase())}`),
    ];
    return `$c${i} isa category, ${attrs.join(", ")};\n owning (owner: $u, owned: $c${i});`;
  });
  await write(`match $u isa person, has ref-id ${str(userId)};\ninsert\n${inserts.join("\n")}`);

  const links = missing.filter((c) => c.parent_id);
  if (links.length === 0) return;
  const vars = new Map<string, string>();
  const v = (id: string) => {
    if (!vars.has(id)) vars.set(id, `$k${vars.size}`);
    return vars.get(id)!;
  };
  const inserts2 = links.map((c) => `category-hierarchy (parent: ${v(c.parent_id!)}, child: ${v(c.id)});`);
  const matches = [...vars].map(([id, name]) => `${name} isa category, has ref-id ${str(id)};`);
  await write(`match\n${matches.join("\n")}\ninsert\n${inserts2.join("\n")}`);
}

const DELETE_TX = (id: string) => `
  match $t isa transaction, has ref-id ${str(id)};
    $o isa owning, links (owned: $t);
    try { $cl isa classification, links (item: $t); };
    try { $tw isa transacted-with, links (transaction: $t); };
  delete try { $cl; }; try { $tw; }; $o; $t;`;

export async function removeTransaction(id: string): Promise<void> {
  await write(DELETE_TX(id));
}

/** Upsert a transaction into the graph (delete + insert keeps it idempotent). */
export async function syncTransaction(userId: string, tx: Transaction): Promise<void> {
  await removeTransaction(tx.id);

  const cp = counterpartyKey(userId, tx);
  const match = [`$u isa person, has ref-id ${str(userId)};`];
  if (tx.category_id) match.push(`$c isa category, has ref-id ${str(tx.category_id)};`);

  const put = cp
    ? `put $cp isa counterparty, has ref-id ${str(cp.key)}, has name ${str(cp.label)};\n  owning (owner: $u, owned: $cp);`
    : "";

  const insert = [
    `$t isa ${tx.kind}, has ref-id ${str(tx.id)}, has amount ${Math.round(tx.amount)}, has occurred-at ${datetime(tx.occurred_at)}, has note ${str(tx.description)};`,
    `owning (owner: $u, owned: $t);`,
    ...(tx.category_id ? [`classification (item: $t, category: $c);`] : []),
    ...(cp ? [`transacted-with (transaction: $t, counterparty: $cp);`] : []),
  ];

  const inserted = await write(`match\n${match.join("\n")}\n${put}\ninsert\n${insert.join("\n")}`);
  if (inserted === 0) throw new Error(`Ontology sync matched nothing for transaction ${tx.id}`);
}

/** Wipe a user's subgraph and rebuild it from the ledger. */
export async function rebuildUser(
  userId: string,
  categories: Category[],
  transactions: Transaction[],
): Promise<void> {
  const u = `$u isa person, has ref-id ${str(userId)};`;
  await write(`
    match ${u} $o isa owning, links (owner: $u, owned: $t); $t isa transaction;
      try { $cl isa classification, links (item: $t); };
      try { $tw isa transacted-with, links (transaction: $t); };
    delete try { $cl; }; try { $tw; }; $o; $t;`);
  await write(`
    match ${u} $o isa owning, links (owner: $u, owned: $c); $c isa category;
      try { $h isa category-hierarchy, links (child: $c); };
    delete try { $h; }; $o; $c;`);
  await write(`
    match ${u} $o isa owning, links (owner: $u, owned: $x); $x isa counterparty;
    delete $o; $x;`);
  await write(`match ${u} delete $u;`);

  await ensureUserGraph(userId, categories);
  for (const tx of transactions) await syncTransaction(userId, tx);
}

type Rollup = {
  byRoot: { name: string; total: number; count: number }[];
  byNecessity: Record<Necessity, number>;
};

/** Expense rolled up the hierarchy using the `category_root` / `effective_necessity` functions. */
export async function expenseRollup(userId: string, start: Date, end: Date): Promise<Rollup> {
  const base = `
    match
      $u isa person, has ref-id ${str(userId)};
      owning (owner: $u, owned: $t);
      $t isa expense, has amount $a, has occurred-at $d;
      $d >= ${datetime(start)}; $d < ${datetime(end)};
      classification (item: $t, category: $c);`;

  const [roots, needs] = await Promise.all([
    readRows(`${base}
      let $r in category_root($c);
      $r has name $name;
      reduce $total = sum($a), $count = count groupby $name;`),
    readRows(`${base}
      let $n in effective_necessity($c);
      reduce $total = sum($a) groupby $n;`),
  ]);

  const byNecessity: Record<Necessity, number> = { kebutuhan: 0, keinginan: 0, tabungan: 0 };
  for (const row of needs) byNecessity[row.n as Necessity] = Number(row.total);

  return {
    byRoot: roots
      .map((r) => ({ name: String(r.name), total: Number(r.total), count: Number(r.count) }))
      .sort((a, b) => b.total - a.total),
    byNecessity,
  };
}

/**
 * Category most often used with this counterparty (learned from the user's own history,
 * including manual corrections). Returns the category id, or null.
 */
export async function learnedCategory(
  userId: string,
  label: string,
  kind: "income" | "expense",
): Promise<string | null> {
  const key = normalizeKey(label);
  if (!key) return null;
  const rows = await readRows(`
    match
      $cp isa counterparty, has ref-id ${str(`${userId}:${key}`)};
      transacted-with (transaction: $t, counterparty: $cp);
      $t isa ${kind};
      classification (item: $t, category: $c);
      $c has ref-id $id;
    reduce $n = count groupby $id;`);
  rows.sort((a, b) => Number(b.n) - Number(a.n));
  return rows.length ? String(rows[0].id) : null;
}

/** Keyword → category id index for the user's categories. */
export async function keywordIndex(userId: string): Promise<{ keyword: string; categoryId: string; kind: string }[]> {
  const rows = await readRows(`
    match
      $u isa person, has ref-id ${str(userId)};
      owning (owner: $u, owned: $c);
      $c isa category, has ref-id $id, has flow $f, has keyword $k;
    select $id, $f, $k;`);
  return rows.map((r) => ({ keyword: String(r.k), categoryId: String(r.id), kind: String(r.f) }));
}

/** Top counterparties for a period, useful for the assistant ("paling sering belanja di mana?"). */
export async function topCounterparties(userId: string, start: Date, end: Date, limit = 5) {
  const rows = await readRows(`
    match
      $u isa person, has ref-id ${str(userId)};
      owning (owner: $u, owned: $t);
      $t isa expense, has amount $a, has occurred-at $d;
      $d >= ${datetime(start)}; $d < ${datetime(end)};
      transacted-with (transaction: $t, counterparty: $cp);
      $cp has name $name;
    reduce $total = sum($a), $count = count groupby $name;`);
  return rows
    .map((r) => ({ name: String(r.name), total: Number(r.total), count: Number(r.count) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}
