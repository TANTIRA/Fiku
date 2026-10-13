"use client";

import { useState, useTransition } from "react";
import { formatRupiah } from "@/lib/money";
import type { Category, Transaction } from "@/lib/types";
import { changeCategory, removeTransaction, type FormState } from "../actions";

export function TransactionRow({ tx, categories }: { tx: Transaction; categories: Category[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const current = categories.find((c) => c.id === tx.category_id);
  const leaves = categories.filter((c) => !categories.some((o) => o.parent_id === c.id));

  const run = (fn: () => Promise<FormState>) => {
    setError(null);
    start(async () => {
      const result = await fn();
      if (result?.error) setError(result.error);
    });
  };

  return (
    <li className={`flex flex-wrap items-center gap-3 py-2.5 ${pending ? "opacity-50" : ""}`}>
      <span className="text-xl" aria-hidden>
        {current?.icon ?? "❔"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {tx.description}
          {tx.source === "assistant" && (
            <span className="ml-2 rounded bg-gold-soft px-1 text-[10px] font-semibold uppercase" title="Dicatat lewat Asisten">
              chat
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs opacity-80">
          {tx.counterparty && <span>@ {tx.counterparty}</span>}
          <select
            aria-label="Ubah kategori"
            value={tx.category_id ?? ""}
            disabled={pending}
            onChange={(e) => run(() => changeCategory(tx.id, e.target.value))}
            className="rounded border-2 border-ink/30 bg-white px-1 py-0.5"
          >
            {!current && <option value="">Tanpa kategori</option>}
            {leaves.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <span className={`font-pixel ${tx.kind === "income" ? "text-jade" : "text-berry"}`}>
        {tx.kind === "income" ? "+" : "−"}
        {formatRupiah(tx.amount)}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm(`Hapus "${tx.description}"?`)) run(() => removeTransaction(tx.id));
        }}
        className="rounded border-2 border-transparent px-1.5 text-sm hover:border-berry hover:bg-berry-soft"
        aria-label="Hapus transaksi"
      >
        🗑
      </button>
      {error && (
        <p role="alert" className="w-full text-xs text-berry">
          {error}
        </p>
      )}
    </li>
  );
}
