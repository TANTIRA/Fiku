"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { Fuku } from "@/components/fuku/fuku";
import type { Mood } from "@/components/fuku/sprite";
import { formatDate } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";

type Recorded = {
  id: string;
  kind: "income" | "expense";
  amount: number;
  description: string;
  counterparty: string | null;
  category: string;
  icon: string;
  reason: string | null;
  occurredAt: string;
};

const STORAGE_KEY = "fuku-chat-v1";
const SUGGESTIONS = [
  "makan siang 25rb",
  "bensin 30rb, parkir 5rb kemarin",
  "gajian 7,5jt",
  "ringkasan bulan ini",
  "paling boros di mana?",
];

const GREETING: UIMessage = {
  id: "greeting",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "Halo, aku Fuku! 🪙 Ceritakan uang yang masuk atau keluar hari ini, nanti aku catat dan kelompokkan. Mau rekap? Tanya saja.",
    },
  ],
};

function loadMessages(): UIMessage[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return Array.isArray(saved) && saved.length ? saved : [GREETING];
  } catch {
    return [GREETING];
  }
}

export function Chat() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error, setMessages } = useChat({ id: "fuku-chat", messages: [GREETING] });
  const bottomRef = useRef<HTMLDivElement>(null);
  const restored = useRef(false);
  const busy = status === "submitted" || status === "streaming";

  // Restore history after mount (localStorage isn't available during SSR).
  useEffect(() => {
    setMessages(loadMessages());
    restored.current = true;
  }, [setMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    if (restored.current && status === "ready") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    }
  }, [messages, status]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const justRecorded = lastAssistant ? recordedIn(lastAssistant) : [];
  const mood: Mood = error
    ? "worried"
    : busy
      ? "thinking"
      : justRecorded.some((r) => r.kind === "income")
        ? "happy"
        : "idle";

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput("");
  };

  return (
    <div className="flex h-[calc(100dvh-10rem)] flex-col gap-4 sm:h-[calc(100dvh-7.5rem)]">
      <div className="flex items-center gap-3">
        <Fuku mood={mood} size={64} sparkle={mood === "happy"} />
        <div className="flex-1">
          <h1 className="font-pixel text-2xl">Ngobrol dengan Fuku</h1>
          <p className="text-sm opacity-70">
            {busy ? "Fuku sedang berpikir…" : "Ketik transaksi dengan bahasa sehari-hari."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setMessages([GREETING]);
            localStorage.removeItem(STORAGE_KEY);
          }}
          className="pixel-btn pixel-btn-ghost px-3 py-1 text-xs"
        >
          Bersihkan
        </button>
      </div>

      <div className="pixel-card flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {messages.map((m) => (
          <Message key={m.id} message={m} />
        ))}
        {status === "submitted" && (
          <div className="flex items-end gap-2">
            <Fuku mood="thinking" size={32} />
            <div className="pixel-bubble font-pixel">
              <span className="animate-pulse">• • •</span>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="rounded border-2 border-berry bg-berry-soft px-3 py-2 text-sm">
            Gagal mengirim pesan. {error.message}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            onClick={() => send(s)}
            className="rounded-full border-2 border-ink/40 bg-white px-3 py-1 text-xs hover:border-ink"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='contoh: "kopi di kenangan 28rb"'
          aria-label="Pesan untuk Fuku"
          maxLength={1000}
          className="pixel-input flex-1"
          autoFocus
        />
        <button type="submit" disabled={busy || !input.trim()} className="pixel-btn">
          Kirim ▶
        </button>
      </form>
    </div>
  );
}

function recordedIn(message: UIMessage): Recorded[] {
  const out: Recorded[] = [];
  for (const part of message.parts) {
    if (part.type === "data-recorded") out.push(...(part.data as Recorded[]));
    if (part.type === "tool-recordTransactions" && part.state === "output-available") {
      out.push(...((part.output as { recorded: Recorded[] }).recorded ?? []));
    }
  }
  return out;
}

function Message({ message }: { message: UIMessage }) {
  if (message.role === "user") {
    const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-lg border-[3px] border-ink bg-gold-soft px-3 py-2 shadow-[3px_3px_0_var(--ink)]">
          {text}
        </div>
      </div>
    );
  }

  const recorded = recordedIn(message);
  const texts = message.parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text);
  const working = message.parts.some(
    (p) => p.type.startsWith("tool-") && "state" in p && (p.state === "input-streaming" || p.state === "input-available"),
  );

  return (
    <div className="flex items-start gap-2">
      <Fuku mood={recorded.length ? "happy" : "idle"} size={32} animate={false} />
      <div className="max-w-[85%] space-y-2">
        {recorded.length > 0 && (
          <ul className="space-y-1.5">
            {recorded.map((r) => (
              <li key={r.id} className="flex items-center gap-2 rounded-md border-2 border-ink bg-white px-2.5 py-1.5 text-sm">
                <span aria-hidden>{r.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{r.description}</span>
                  <span className="block text-xs opacity-60">
                    {r.category}
                    {r.reason && r.reason !== "dipilih" && ` · tebakan dari ${r.reason}`} · {formatDate(r.occurredAt)}
                  </span>
                </span>
                <span className={`font-pixel ${r.kind === "income" ? "text-jade" : "text-berry"}`}>
                  {r.kind === "income" ? "+" : "−"}
                  {formatRupiah(r.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {working && <p className="text-xs opacity-60">🔧 Fuku sedang membuka buku catatan…</p>}
        {texts.map((t, i) => (
          <div key={i} className="pixel-bubble whitespace-pre-wrap">
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}
