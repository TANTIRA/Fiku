"use client";

import { useTransition } from "react";
import { formatRupiah } from "@/lib/money";
import type { Category, Transaction } from "@/lib/types";
import { changeCategory, removeTransaction } from "../actions";

export function TransactionRow({ tx, categories }: { tx: Transaction; categories: Category[] }) {
  const [pending, start] = useTransition();
  const current = categories.find((c) => c.id === tx.category_id);
  const leafOrRoot = categories.filter((c) => !categories.some((o) => o.parent_id === c.id));

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
            onChange={(e) => start(() => changeCategory(tx.id, e.target.value))}
            className="rounded border-2 border-ink/30 bg-white px-1 py-0.5"
          >
            {!current && <option value="">Tanpa kategori</option>}
            {leafOrRoot.map((c) => (
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
          if (confirm(`Hapus "${tx.description}"?`)) start(() => removeTransaction(tx.id));
        }}
        className="rounded border-2 border-transparent px-1.5 text-sm hover:border-berry hover:bg-berry-soft"
        aria-label="Hapus transaksi"
      >
        🗑
      </button>
    </li>
  );
}
