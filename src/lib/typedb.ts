import "server-only";
import { env } from "@/lib/env";

type TxType = "read" | "write" | "schema";

type Concept = {
  kind: string;
  value?: string | number | boolean;
  valueType?: string;
  iid?: string;
};

type QueryResponse =
  | { answerType: "ok"; answers: null }
  | { answerType: "conceptRows"; answers: { data: Record<string, Concept> }[] }
  | { answerType: "conceptDocuments"; answers: Record<string, unknown>[] };

export class TypeDBError extends Error {}

let token: { value: string; expiresAt: number } | null = null;

async function getToken(force = false): Promise<string> {
  if (!force && token && token.expiresAt > Date.now()) return token.value;
  const res = await fetch(`${env.typedb.url}/v1/signin`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: env.typedb.username, password: env.typedb.password }),
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new TypeDBError(`TypeDB sign-in failed (${res.status})`);
  const body = (await res.json()) as { token: string };
  // Tokens are valid for a few hours; refresh well before expiry.
  token = { value: body.token, expiresAt: Date.now() + 30 * 60 * 1000 };
  return token.value;
}

async function query(txType: TxType, typeql: string, retry = true): Promise<QueryResponse> {
  const res = await fetch(`${env.typedb.url}/v1/query`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${await getToken()}`,
    },
    body: JSON.stringify({
      databaseName: env.typedb.database,
      transactionType: txType,
      query: typeql,
      queryOptions: { includeQueryStructure: false, includeInstanceTypes: false },
    }),
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (res.status === 401 && retry) {
    await getToken(true);
    return query(txType, typeql, false);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new TypeDBError(`TypeDB ${txType} query failed (${res.status}): ${body.slice(0, 500)}`);
  }
  return (await res.json()) as QueryResponse;
}

/** Rows as plain JS values (attribute/value concepts unwrapped). */
export async function readRows(typeql: string): Promise<Record<string, unknown>[]> {
  const res = await query("read", typeql);
  if (res.answerType !== "conceptRows") return [];
  return res.answers.map(({ data }) =>
    Object.fromEntries(Object.entries(data).map(([k, c]) => [k, c.value ?? c.iid])),
  );
}

export async function readDocuments<T = Record<string, unknown>>(typeql: string): Promise<T[]> {
  const res = await query("read", typeql);
  if (res.answerType !== "conceptDocuments") return [];
  return res.answers as T[];
}

export async function write(typeql: string): Promise<number> {
  const res = await query("write", typeql);
  return res.answerType === "conceptRows" ? res.answers.length : 0;
}

export async function defineSchema(typeql: string): Promise<void> {
  await query("schema", typeql);
}

/** Escape a JS string into a TypeQL string literal. */
export function str(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ")}"`;
}

/** TypeQL datetime literal in UTC (the ontology stores naive UTC datetimes). */
export function datetime(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 23);
}
