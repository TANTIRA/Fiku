function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

/** Dev-only fallback: convenient locally, but production must set the variable. */
function devDefault(name: string, value: string | undefined, fallback: string): string {
  return value ?? (process.env.NODE_ENV === "production" ? required(name, undefined) : fallback);
}

export const env = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseKey() {
    return required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
  },
  typedb: {
    get url() {
      return process.env.TYPEDB_URL ?? "http://127.0.0.1:8000";
    },
    get username() {
      return devDefault("TYPEDB_USERNAME", process.env.TYPEDB_USERNAME, "admin");
    },
    get password() {
      return devDefault("TYPEDB_PASSWORD", process.env.TYPEDB_PASSWORD, "password");
    },
    get database() {
      return process.env.TYPEDB_DATABASE ?? "fuku";
    },
  },
  llm: {
    get baseURL() {
      return process.env.LLM_BASE_URL;
    },
    get apiKey() {
      return process.env.LLM_API_KEY;
    },
    get model() {
      return process.env.LLM_MODEL;
    },
    get enabled() {
      return Boolean(process.env.LLM_BASE_URL && process.env.LLM_MODEL);
    },
  },
};
