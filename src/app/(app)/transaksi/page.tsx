import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Fuku } from "@/components/fuku/fuku";
import { MonthNav } from "@/components/month-nav";
import { currentMonth, isMonthKey, toDateInput, TIMEZONE, type MonthKey } from "@/lib/dates";
import { listCategories, listTransactions, requireSession } from "@/lib/finance";
import { formatRupiah } from "@/lib/money";
import type { Transaction, TxKind } from "@/lib/types";
import { AddTransactionForm } from "./add-form";
import { TransactionRow } from "./transaction-row";

export const metadata: Metadata = { title: "Transaksi" };

export default function TransactionsPage({ searchParams }: PageProps<"/transaksi">) {
  return (
    <Suspense fallback={<p className="font-pixel">Memuat…</p>}>
      <Transactions searchParams={searchParams} />
    </Suspense>
  );
}

async function Transactions({ searchParams }: { searchParams: PageProps<"/transaksi">["searchParams"] }) {
  const params = await searchParams;
  const month: MonthKey = isMonthKey(params.bulan) ? params.bulan : currentMonth();
  const kind: TxKind | undefined =
    params.jenis === "income" || params.jenis === "expense" ? params.jenis : undefined;
  const search = typeof params.cari === "string" ? params.cari.slice(0, 50) : undefined;

  const session = await requireSession();
  const [txs, categories] = await Promise.all([
    listTransactions(session, { month, kind, search }),
    listCategories(session),
  ]);

  const income = txs.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0);
  const expense = txs.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amount, 0);
  const groups = groupByDay(txs);
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { bulan: month, jenis: kind, cari: search, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/transaksi?${p}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-pixel text-3xl">Transaksi</h1>
        <MonthNav
          month={month}
          basePath="/transaksi"
          extra={new URLSearchParams({ ...(kind && { jenis: kind }), ...(search && { cari: search }) }).toString()}
        />
      </div>

      <AddTransactionForm categories={categories} today={toDateInput()} />

      <section className="pixel-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          {([undefined, "expense", "income"] as const).map((k) => (
            <Link
              key={k ?? "all"}
              href={qs({ jenis: k })}
              className={`rounded-md border-[3px] px-3 py-0.5 font-pixel text-sm ${
                kind === k ? "border-ink bg-gold" : "border-ink/20"
              }`}
            >
              {k === undefined ? "Semua" : k === "expense" ? "Keluar" : "Masuk"}
            </Link>
          ))}
          <form action="/transaksi" className="ml-auto flex gap-2">
            <input type="hidden" name="bulan" value={month} />
            {kind && <input type="hidden" name="jenis" value={kind} />}
            <input name="cari" defaultValue={search} placeholder="Cari…" className="pixel-input w-40 py-1" />
          </form>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <span>
            Masuk <b className="font-pixel text-jade">{formatRupiah(income)}</b>
          </span>
          <span>
            Keluar <b className="font-pixel text-berry">{formatRupiah(expense)}</b>
          </span>
        </div>

        {txs.length === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-2 py-6 text-center">
            <Fuku mood="sleepy" size={72} />
            <p className="text-sm opacity-70">Belum ada transaksi di sini.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {groups.map(([day, items]) => (
              <div key={day}>
                <h3 className="mb-1 font-pixel text-sm capitalize opacity-70">{day}</h3>
                <ul className="divide-y-2 divide-dashed divide-ink/20">
                  {items.map((t) => (
                    <TransactionRow key={t.id} tx={t} categories={categories.filter((c) => c.kind === t.kind)} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function groupByDay(txs: Transaction[]): [string, Transaction[]][] {
  const fmt = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", timeZone: TIMEZONE });
  const map = new Map<string, Transaction[]>();
  for (const t of txs) {
    const key = fmt.format(new Date(t.occurred_at));
    map.set(key, [...(map.get(key) ?? []), t]);
  }
  return [...map];
}
