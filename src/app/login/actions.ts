"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const Credentials = z.object({
  email: z.email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

export type AuthState = { error?: string; mode: "login" | "signup" };

export async function authenticate(prev: AuthState, formData: FormData): Promise<AuthState> {
  const mode = formData.get("mode") === "signup" ? "signup" : "login";
  const parsed = Credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { mode, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } =
    mode === "signup"
      ? await supabase.auth.signUp(parsed.data)
      : await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    const message =
      error.code === "invalid_credentials"
        ? "Email atau password salah."
        : error.code === "user_already_exists"
          ? "Email sudah terdaftar. Silakan masuk."
          : error.message;
    return { mode, error: message };
  }
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
