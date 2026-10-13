import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FukuSays } from "@/components/fuku/fuku";
import { MonthNav } from "@/components/month-nav";
import { currentMonth, formatDate, isMonthKey, type MonthKey } from "@/lib/dates";
import {
  listCategories,
  listTransactions,
  monthlySummary,
  overallBalance,
  requireSession,
  retryUnsynced,
} from "@/lib/finance";
import { fukuReaction } from "@/lib/fuku-mood";
import { formatCompact, formatRupiah } from "@/lib/money";
import type { CategoryTotal } from "@/lib/types";
import { ResyncButton } from "./resync-button";

export const metadata: Metadata = { title: "Ringkasan" };

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/dashboard">["searchParams"] }) {
  const { bulan } = await searchParams;
  const month: MonthKey = isMonthKey(bulan) ? bulan : currentMonth();
  const session = await requireSession();
  await retryUnsynced(session);

  const [summary, balance, recent, categories] = await Promise.all([
    monthlySummary(session, month),
    overallBalance(session),
    listTransactions(session, { month, limit: 6 }),
    listCategories(session),
  ]);
  const reaction = fukuReaction(summary);
  const catById = new Map(categories.map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-pixel text-3xl">Ringkasan</h1>
        <MonthNav month={month} basePath="/dashboard" />
      </div>

      <FukuSays mood={reaction.mood} sparkle={reaction.sparkle}>
        {reaction.message}
      </FukuSays>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Saldo total" value={balance} tone={balance >= 0 ? "ink" : "berry"} />
        <Stat label="Pemasukan" value={summary.income} tone="jade" prefix="+" />
        <Stat label="Pengeluaran" value={summary.expense} tone="berry" prefix="−" />
        <Stat label="Sisa bulan ini" value={summary.balance} tone={summary.balance >= 0 ? "jade" : "berry"} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="pixel-card p-5">
          <h2 className="font-pixel text-xl">Aturan 50/30/20</h2>
          <p className="mt-1 text-sm opacity-70">
            Porsi pengeluaran dari pemasukan. Kategori mewarisi jenisnya dari induknya di ontologi.
          </p>
          <div className="mt-4 space-y-4">
            <NecessityBar label="Kebutuhan" target={50} value={summary.byNecessity.kebutuhan} income={summary.income} color="var(--sky)" />
            <NecessityBar label="Keinginan" target={30} value={summary.byNecessity.keinginan} income={summary.income} color="var(--berry)" />
            <NecessityBar label="Tabungan" target={20} value={summary.byNecessity.tabungan} income={summary.income} color="var(--jade)" saving />
          </div>
        </section>

        <section className="pixel-card p-5">
          <h2 className="font-pixel text-xl">Pengeluaran per kelompok</h2>
          <Breakdown items={summary.byRoot} total={summary.expense} empty="Belum ada pengeluaran." />
          {summary.byCategory.length > 0 && (
            <>
              <h3 className="mt-5 font-pixel">Kategori teratas</h3>
              <Breakdown items={summary.byCategory.slice(0, 5)} total={summary.expense} compact />
            </>
          )}
        </section>
      </div>

      <section className="pixel-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-pixel text-xl">Terakhir dicatat</h2>
          <Link href={`/transaksi?bulan=${month}`} className="text-sm underline underline-offset-4">
            Lihat semua →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm opacity-70">
            Kosong. <Link href="/asisten" className="underline">Ngobrol dengan Fuku</Link> untuk mulai mencatat.
          </p>
        ) : (
          <ul className="mt-3 divide-y-2 divide-dashed divide-ink/20">
            {recent.map((t) => {
              const c = t.category_id ? catById.get(t.category_id) : undefined;
              return (
                <li key={t.id} className="flex items-center gap-3 py-2">
                  <span className="text-xl" aria-hidden>{c?.icon ?? "❔"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{t.description}</p>
                    <p className="text-xs opacity-60">
                      {formatDate(t.occurred_at)} · {c?.name ?? "Tanpa kategori"}
                    </p>
                  </div>
                  <span className={`font-pixel ${t.kind === "income" ? "text-jade" : "text-berry"}`}>
                    {t.kind === "income" ? "+" : "−"}
                    {formatCompact(t.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <footer className="flex flex-wrap items-center gap-3 text-xs opacity-70">
        <span>
          Analisis hierarki:{" "}
          {summary.reasoning === "typedb" ? "🧠 ontologi TypeDB" : "⚠️ cadangan lokal (TypeDB tidak tersedia/terlambat sinkron)"}
        </span>
        <ResyncButton />
      </footer>
    </div>
  );
}

function Stat({ label, value, tone, prefix = "" }: { label: string; value: number; tone: "ink" | "jade" | "berry"; prefix?: string }) {
  const color = { ink: "text-ink", jade: "text-jade", berry: "text-berry" }[tone];
  return (
    <div className="pixel-card p-4">
      <p className="text-xs uppercase tracking-wide opacity-70">{label}</p>
      <p className={`mt-1 font-pixel text-xl sm:text-2xl ${color}`} title={formatRupiah(value)}>
        {value === 0 ? "Rp0" : `${prefix}${formatCompact(Math.abs(value))}`}
      </p>
    </div>
  );
}

function NecessityBar({
  label,
  target,
  value,
  income,
  color,
  saving,
}: {
  label: string;
  target: number;
  value: number;
  income: number;
  color: string;
  saving?: boolean;
}) {
  const pct = income > 0 ? Math.round((value / income) * 100) : 0;
  const over = saving ? false : pct > target;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-pixel">{label}</span>
        <span className={over ? "font-semibold text-berry" : ""}>
          {formatCompact(value)} · {pct}% <span className="opacity-60">/ {target}%</span>
        </span>
      </div>
      <div className="pixel-bar relative mt-1">
        <div className="h-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
        <div className="absolute inset-y-0 border-l-2 border-dashed border-ink" style={{ left: `${target}%` }} />
      </div>
    </div>
  );
}

function Breakdown({ items, total, empty, compact }: { items: CategoryTotal[]; total: number; empty?: string; compact?: boolean }) {
  if (items.length === 0) return <p className="mt-3 text-sm opacity-70">{empty}</p>;
  return (
    <ul className={`mt-3 ${compact ? "space-y-1.5" : "space-y-3"}`}>
      {items.map((i) => {
        const pct = total ? (i.total / total) * 100 : 0;
        return (
          <li key={i.name}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate">
                <span aria-hidden>{i.icon}</span> {i.name}
                <span className="ml-1 text-xs opacity-60">×{i.count}</span>
              </span>
              <span className="font-pixel">{formatCompact(i.total)}</span>
            </div>
            {!compact && (
              <div className="pixel-bar mt-1">
                <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <h1 className="font-pixel text-3xl">Ringkasan</h1>
      <FukuSays mood="thinking">Menghitung koin-koinmu…</FukuSays>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="pixel-card h-20 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

