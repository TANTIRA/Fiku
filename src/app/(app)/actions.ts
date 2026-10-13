"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import {
  createTransactions,
  deleteTransaction,
  rebuildOntology,
  requireSession,
  updateTransactionCategory,
} from "@/lib/finance";
import { fromDateInput } from "@/lib/dates";
import { parseAmount } from "@/lib/money";

export type FormState = { ok?: string; error?: string };

const NewTx = z.object({
  kind: z.enum(["income", "expense"]),
  amount: z.string().transform((v, ctx) => {
    const n = parseAmount(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Nominal tidak valid (contoh: 25000 atau 25rb)" });
      return z.NEVER;
    }
    return n;
  }),
  description: z.string().trim().min(1, "Isi keterangan dulu").max(200),
  counterparty: z.string().trim().max(100).optional(),
  categoryId: z.union([z.uuid(), z.literal("")]).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid")
    // Reject impossible dates like 2026-02-31 instead of letting Date normalize them.
    .refine((v) => {
      const [y, m, d] = v.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
    }, "Tanggal tidak valid"),
});

export async function addTransaction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = NewTx.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  try {
    const [tx] = await createTransactions(session, [
      {
        kind: d.kind,
        amount: d.amount,
        description: d.description,
        counterparty: d.counterparty || null,
        categoryId: d.categoryId || null,
        occurredAt: fromDateInput(d.date),
      },
    ]);
    refresh();
    return { ok: `Tercatat di ${tx.category?.name ?? "tanpa kategori"} ✓` };
  } catch (err) {
    console.error(err);
    return { error: "Gagal menyimpan transaksi." };
  }
}

export async function changeCategory(id: string, categoryId: string): Promise<FormState> {
  const session = await requireSession();
  const ids = z.tuple([z.uuid(), z.uuid()]).safeParse([id, categoryId]);
  if (!ids.success) return { error: "Kategori tidak valid." };
  try {
    await updateTransactionCategory(session, ids.data[0], ids.data[1]);
    refresh();
    return {};
  } catch (err) {
    console.error(err);
    return { error: "Gagal mengubah kategori." };
  }
}

export async function removeTransaction(id: string): Promise<FormState> {
  const session = await requireSession();
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { error: "Transaksi tidak valid." };
  try {
    await deleteTransaction(session, parsed.data);
    refresh();
    return {};
  } catch (err) {
    console.error(err);
    return { error: "Gagal menghapus transaksi." };
  }
}

export async function resyncOntology(): Promise<FormState> {
  const session = await requireSession();
  try {
    const n = await rebuildOntology(session);
    refresh();
    return { ok: `Ontologi disinkron ulang (${n} transaksi).` };
  } catch (err) {
    console.error(err);
    return { error: "TypeDB tidak bisa dihubungi." };
  }
}
