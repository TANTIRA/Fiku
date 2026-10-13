"use client";

import { useActionState, useEffect, useState } from "react";
import { Fuku } from "@/components/fuku/fuku";
import { authenticate, type AuthState } from "./actions";

export function LoginForm() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [state, action, pending] = useActionState<AuthState, FormData>(authenticate, { mode: "login" });

  // This page only renders while signed out — drop any chat history left by a previous account.
  useEffect(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("fuku-chat")) localStorage.removeItem(key);
    }
  }, []);

  return (
    <div className="pixel-card w-full max-w-sm p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Fuku mood={state.error ? "worried" : pending ? "thinking" : "idle"} size={88} />
        <h1 className="font-pixel text-2xl">{mode === "login" ? "Halo lagi!" : "Kenalan dulu yuk"}</h1>
        <p className="text-sm opacity-75">
          {mode === "login" ? "Masuk untuk lanjut mencatat keuanganmu." : "Buat akun Fuku gratis."}
        </p>
      </div>

      <form action={action} className="mt-6 space-y-4">
        <input type="hidden" name="mode" value={mode} />
        <label className="block space-y-1">
          <span className="font-pixel text-sm">Email</span>
          <input name="email" type="email" required autoComplete="email" className="pixel-input" />
        </label>
        <label className="block space-y-1">
          <span className="font-pixel text-sm">Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="pixel-input"
          />
        </label>
        {state.error && (
          <p role="alert" className="rounded border-2 border-berry bg-berry-soft px-3 py-2 text-sm">
            {state.error}
          </p>
        )}
        {state.notice && (
          <p role="status" className="rounded border-2 border-jade bg-jade-soft px-3 py-2 text-sm">
            {state.notice}
          </p>
        )}
        <button type="submit" disabled={pending} className="pixel-btn w-full">
          {pending ? "Sebentar…" : mode === "login" ? "Masuk" : "Daftar"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
        className="mt-4 w-full text-center text-sm underline underline-offset-4"
      >
        {mode === "login" ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk"}
      </button>
    </div>
  );
}
