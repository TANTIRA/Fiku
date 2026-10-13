import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  tool,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { z } from "zod";
import {
  categoryNames,
  findTransactions,
  offlineReply,
  recordTransactions,
  removeTransaction,
  summaryFor,
  topPlaces,
} from "@/lib/assistant";
import { currentMonth, isMonthKey, monthLabel, TIMEZONE } from "@/lib/dates";
import { env } from "@/lib/env";
import { getSession, listCategories, type Session } from "@/lib/finance";
import { allowRequest } from "@/lib/rate-limit";

export const maxDuration = 60;

const MAX_BODY_BYTES = 64 * 1024;
const MAX_MESSAGES = 30;

const IncomingMessage = z.looseObject({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  parts: z.array(z.looseObject({ type: z.string() })).catch([]),
});

const Month = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .optional()
  .describe("Bulan format YYYY-MM. Kosongkan untuk bulan ini.");

function monthOrCurrent(m?: string) {
  return isMonthKey(m) ? m : currentMonth();
}

function buildTools(session: Session) {
  return {
    recordTransactions: tool({
      description:
        "Catat satu atau lebih transaksi uang masuk (income) / keluar (expense). Panggil setiap kali pengguna menyebut uang yang sudah diterima atau dibelanjakan.",
      inputSchema: z.object({
        items: z
          .array(
            z.object({
              kind: z.enum(["income", "expense"]),
              amount: z.number().int().positive().describe("Nominal dalam Rupiah, contoh 25rb = 25000"),
              description: z.string().min(1).max(200).describe("Keterangan singkat, contoh 'Makan siang'"),
              counterparty: z.string().max(100).optional().describe("Tempat/toko/pemberi, jika disebut"),
              categoryName: z
                .string()
                .optional()
                .describe("Nama kategori persis dari daftar. Kosongkan jika ragu; Fuku akan menebak dari riwayat."),
              daysAgo: z.number().int().min(0).max(365).optional().describe("0 = hari ini, 1 = kemarin"),
            }),
          )
          .min(1)
          .max(20),
      }),
      execute: async ({ items }) => ({ recorded: await recordTransactions(session, items) }),
    }),
    getMonthlySummary: tool({
      description:
        "Ringkasan bulanan: total masuk/keluar, sisa, pengeluaran per kelompok (hierarki kategori), kategori teratas, dan rasio 50/30/20.",
      inputSchema: z.object({ month: Month }),
      execute: async ({ month }) => summaryFor(session, monthOrCurrent(month)),
    }),
    findTransactions: tool({
      description: "Cari daftar transaksi (terbaru dulu), bisa difilter bulan, jenis, atau kata kunci.",
      inputSchema: z.object({
        month: Month,
        kind: z.enum(["income", "expense"]).optional(),
        search: z.string().max(50).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async (args) => ({
        transactions: await findTransactions(session, { ...args, month: args.month ? monthOrCurrent(args.month) : undefined }),
      }),
    }),
    topPlaces: tool({
      description: "Tempat/toko/pihak yang paling banyak menerima uang pengguna pada suatu bulan.",
      inputSchema: z.object({ month: Month }),
      execute: async ({ month }) => ({ places: await topPlaces(session, monthOrCurrent(month)) }),
    }),
    deleteTransaction: tool({
      description:
        "Hapus satu transaksi berdasarkan id. Hanya panggil setelah pengguna jelas meminta menghapus/membatalkan transaksi tertentu.",
      inputSchema: z.object({ id: z.uuid() }),
      execute: async ({ id }) => removeTransaction(session, id),
    }),
  };
}

function systemPrompt(categories: { expense: string[]; income: string[] }) {
  const today = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: TIMEZONE,
  }).format(new Date());
  return `Kamu adalah Fuku 🪙, maskot koin 8-bit yang imut dan asisten keuangan pribadi.
Bicara dalam Bahasa Indonesia santai, hangat, singkat (maks 4 kalimat), boleh 1 emoji. Mata uang Rupiah.
Sekarang: ${today} (WIB). Bulan ini: ${monthLabel(currentMonth())}.

Aturan:
- Jika pengguna menyebut pemasukan/pengeluaran yang SUDAH terjadi, langsung panggil recordTransactions (satu panggilan berisi semua item). Jangan minta konfirmasi untuk nominal yang jelas.
- "rb"/"ribu"/"k" = ×1.000, "jt"/"juta" = ×1.000.000. "gaji", "bonus", "dikasih", "jual" = income.
- Pakai categoryName hanya jika yakin dan namanya ada di daftar. Jika tidak, kosongkan.
- Untuk pertanyaan tentang kondisi keuangan, panggil tool dulu; jangan mengarang angka.
- Untuk menghapus: cari transaksinya dengan findTransactions, lalu deleteTransaction hanya jika pengguna jelas memintanya.
- Setelah mencatat, konfirmasi singkat (kategori yang dipakai) tanpa mengulang semua detail. Ingatkan pengguna bisa mengganti kategori di halaman Transaksi — Fuku akan mengingatnya.
- Beri saran hemat yang ramah bila relevan (aturan 50/30/20).

Kategori pengeluaran: ${categories.expense.join(", ")}.
Kategori pemasukan: ${categories.income.join(", ")}.`;
}

function lastUserText(messages: UIMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  if (!last || !Array.isArray(last.parts)) return "";
  return last.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join(" ")
    .trim();
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!allowRequest(session.userId, 30, 60_000)) {
    return new Response("Terlalu banyak pesan. Istirahat dulu ya.", { status: 429 });
  }

  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }
  const parsed = z
    .object({ messages: z.array(IncomingMessage) })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response("Bad request", { status: 400 });
  const messages = parsed.data.messages.slice(-MAX_MESSAGES) as UIMessage[];
  if (!messages.length) return new Response("Bad request", { status: 400 });

  if (!env.llm.enabled) {
    const text = lastUserText(messages).slice(0, 1000);
    const stream = createUIMessageStream({
      async execute({ writer }) {
        const reply = await offlineReply(session, text);
        writer.write({ type: "start" });
        if (reply.recorded?.length) {
          writer.write({ type: "data-recorded", data: reply.recorded });
        }
        writer.write({ type: "text-start", id: "t" });
        writer.write({ type: "text-delta", id: "t", delta: reply.text });
        writer.write({ type: "text-end", id: "t" });
        writer.write({ type: "finish" });
      },
      onError: (err) => {
        console.error("[assistant/offline]", err);
        return "Aduh, Fuku tersandung. Coba lagi ya.";
      },
    });
    return createUIMessageStreamResponse({ stream });
  }

  const provider = createOpenAICompatible({
    name: "llm",
    baseURL: env.llm.baseURL!,
    apiKey: env.llm.apiKey,
  });
  const categories = categoryNames(await listCategories(session));

  let modelMessages;
  try {
    modelMessages = await convertToModelMessages(messages);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const result = streamText({
    model: provider.chatModel(env.llm.model!),
    system: systemPrompt(categories),
    messages: modelMessages,
    tools: buildTools(session),
    stopWhen: isStepCount(5),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onError: (err) => {
        console.error("[assistant/llm]", err);
        return "Fuku tidak bisa menghubungi otaknya (LLM). Cek LLM_BASE_URL / LLM_API_KEY.";
      },
    }),
  });
}
