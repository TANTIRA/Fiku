#!/usr/bin/env node
// Creates the Fuku TypeDB database and applies ontology/schema.tql.
// Usage: node scripts/typedb-setup.mjs [--reset]
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const url = process.env.TYPEDB_URL ?? "http://127.0.0.1:8000";
const username = process.env.TYPEDB_USERNAME ?? "admin";
const password = process.env.TYPEDB_PASSWORD ?? "password";
const database = process.env.TYPEDB_DATABASE ?? "fuku";
const reset = process.argv.includes("--reset");

async function call(path, init = {}) {
  const res = await fetch(`${url}${path}`, init);
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

for (let attempt = 1; ; attempt++) {
  try {
    await fetch(`${url}/health`);
    break;
  } catch {
    if (attempt === 30) throw new Error(`TypeDB not reachable at ${url}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

const { token } = await call("/v1/signin", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username, password }),
});
const auth = { authorization: `Bearer ${token}` };

const { databases } = await call("/v1/databases", { headers: auth });
const exists = databases.some((d) => d.name === database);

if (exists && reset) {
  await call(`/v1/databases/${database}`, { method: "DELETE", headers: auth });
  console.log(`Dropped database "${database}"`);
}
if (!exists || reset) {
  await call(`/v1/databases/${database}`, { method: "POST", headers: auth });
  console.log(`Created database "${database}"`);
}

const schema = await readFile(fileURLToPath(new URL("../ontology/schema.tql", import.meta.url)), "utf8");
const run = (query) =>
  call("/v1/query", {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ databaseName: database, transactionType: "schema", query }),
  });

// Type definitions are additive/idempotent; functions must be redefined if they exist.
const [types, ...rest] = schema.split(/\n(?=[ \t]*fun\s)/);
const funs = rest.filter((f) => f.trim());
await run(types);
for (const fun of funs) {
  try {
    await run(`define\n${fun}`);
  } catch (err) {
    if (!String(err.message).includes("FUN5")) throw err;
    await run(`redefine\n${fun}`);
  }
}
console.log(`Applied ontology schema to "${database}" (${funs.length} functions)`);
