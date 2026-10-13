"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { Category, TxKind } from "@/lib/types";
import { addTransaction, type FormState } from "../actions";

export function AddTransactionForm({ categories, today }: { categories: Category[]; today: string }) {
  const [kind, setKind] = useState<TxKind>("expense");
  const [state, action, pending] = useActionState<FormState, FormData>(addTransaction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  const options = categories.filter((c) => c.kind === kind);
  const roots = options.filter((c) => !c.parent_id);
  const children = (id: string) => options.filter((c) => c.parent_id === id);

  return (
    <form ref={formRef} action={action} className="pixel-card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-pixel text-xl">Catat manual</h2>
        <div role="radiogroup" className="flex gap-1">
          {(["expense", "income"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`rounded-md border-[3px] border-ink px-3 py-0.5 font-pixel text-sm ${
                kind === k ? (k === "expense" ? "bg-berry-soft" : "bg-jade-soft") : "bg-white opacity-60"
              }`}
            >
              {k === "expense" ? "− Keluar" : "+ Masuk"}
            </button>
          ))}
        </div>
      </div>
      <input type="hidden" name="kind" value={kind} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="space-y-1 lg:col-span-1">
          <span className="text-xs font-semibold">Nominal</span>
          <input name="amount" required inputMode="decimal" placeholder="25rb" className="pixel-input" />
        </label>
        <label className="space-y-1 lg:col-span-2">
          <span className="text-xs font-semibold">Keterangan</span>
          <input name="description" required maxLength={200} placeholder={kind === "expense" ? "Makan siang" : "Gaji Oktober"} className="pixel-input" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold">{kind === "expense" ? "Tempat / toko" : "Dari"}</span>
          <input name="counterparty" maxLength={100} placeholder="opsional" className="pixel-input" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold">Tanggal</span>
          <input name="date" type="date" required defaultValue={today} max={today} className="pixel-input" />
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-56 flex-1 space-y-1">
          <span className="text-xs font-semibold">Kategori</span>
          <select name="categoryId" defaultValue="" className="pixel-input" key={kind}>
            <option value="">✨ Biar Fuku yang tebak</option>
            {roots.map((r) =>
              children(r.id).length ? (
                <optgroup key={r.id} label={`${r.icon ?? ""} ${r.name}`}>
                  {children(r.id).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </optgroup>
              ) : (
                <option key={r.id} value={r.id}>
                  {r.icon} {r.name}
                </option>
              ),
            )}
          </select>
        </label>
        <button disabled={pending} className="pixel-btn">
          {pending ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
      {state.ok && <p className="text-sm text-jade">{state.ok}</p>}
      {state.error && (
        <p role="alert" className="text-sm text-berry">
          {state.error}
        </p>
      )}
    </form>
  );
}
