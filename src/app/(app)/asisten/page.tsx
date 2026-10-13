import type { Metadata } from "next";
import { Suspense } from "react";
import { requireSession } from "@/lib/finance";
import { Chat } from "./chat";

export const metadata: Metadata = { title: "Asisten" };

export default function AssistantPage() {
  return (
    <Suspense fallback={<p className="font-pixel">Memuat…</p>}>
      <ChatLoader />
    </Suspense>
  );
}

async function ChatLoader() {
  const { userId } = await requireSession();
  return <Chat userId={userId} />;
}
