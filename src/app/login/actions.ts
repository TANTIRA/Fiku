"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const Credentials = z.object({
  email: z.email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
});

const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: "Email atau password salah.",
  user_already_exists: "Email sudah terdaftar. Silakan masuk.",
  email_not_confirmed: "Email belum dikonfirmasi. Cek inbox kamu ya.",
  weak_password: "Password terlalu lemah. Minimal 8 karakter, kombinasi huruf & angka.",
  over_request_rate_limit: "Terlalu banyak percobaan. Tunggu sebentar ya.",
};

export type AuthState = { error?: string; notice?: string; mode: "login" | "signup" };

export async function authenticate(prev: AuthState, formData: FormData): Promise<AuthState> {
  const mode = formData.get("mode") === "signup" ? "signup" : "login";
  const parsed = Credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { mode, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } =
    mode === "signup"
      ? await supabase.auth.signUp(parsed.data)
      : await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { mode, error: AUTH_ERRORS[error.code ?? ""] ?? "Gagal masuk. Coba lagi ya." };
  }
  if (mode === "signup" && !data.session) {
    return { mode, notice: "Akun dibuat! Cek email untuk konfirmasi, lalu masuk." };
  }
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
