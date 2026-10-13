import type { Metadata } from "next";
import { Chat } from "./chat";

export const metadata: Metadata = { title: "Asisten" };

export default function AssistantPage() {
  return <Chat />;
}
