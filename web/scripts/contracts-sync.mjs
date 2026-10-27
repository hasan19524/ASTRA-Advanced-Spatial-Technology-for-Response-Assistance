#!/usr/bin/env node
/**
 * contracts:sync — pull OpenAPI and emit web/src/api/openapi-types.ts so
 * TypeScript errors show exactly what moved on the backend.
 *
 * Sources, in order:
 *   1. $OPENAPI_PATH (env var, path to a local file)
 *   2. http://localhost:8000/openapi.json (live backend)
 *   3. ../contracts/openapi.json (committed snapshot from the last sync)
 *
 * Usage:  npm run contracts:sync   (no backend needed if snapshot exists)
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, "..");
const REPO = join(WEB, "..");
const OUT = join(WEB, "src", "api", "openapi-types.ts");

let spec = null;
let source = "";

// 1. env override
if (process.env.OPENAPI_PATH) {
  spec = JSON.parse(await readFile(process.env.OPENAPI_PATH, "utf8"));
  source = process.env.OPENAPI_PATH;
}
// 2. live backend
if (!spec) {
  const API = process.env.API_BASE_URL ?? "http://localhost:8000";
  try {
    const res = await fetch(`${API}/openapi.json`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      spec = await res.json();
      source = `${API}/openapi.json`;
    }
  } catch {
    /* fall through to snapshot */
  }
}
// 3. committed snapshot
if (!spec) {
  const snapshot = join(REPO, "contracts", "openapi.json");
  spec = JSON.parse(await readFile(snapshot, "utf8"));
  source = "contracts/openapi.json (snapshot)";
}

if (!spec?.components?.schemas) {
  console.error("[contracts:sync] no components.schemas found");
  process.exit(1);
}

const header = `/**
 * AUTO-GENERATED from ${source} — do not edit by hand.
 * Regenerate:  npm run contracts:sync
 * Generated: ${new Date().toISOString()}
 */
/* eslint-disable */
`;

// Minimal but useful emission: schema components as TS interfaces
const schemas = spec.components?.schemas ?? {};
let body = "";
for (const [name, schema] of Object.entries(schemas)) {
  if (schema.type !== "object" && !schema.properties) continue;
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  body += `export interface ${name} {\n`;
  for (const [prop, def] of Object.entries(props)) {
    const t = tsType(def);
    const opt = required.has(prop) ? "" : "?";
    body += `  ${prop}${opt}: ${t};\n`;
  }
  body += `}\n\n`;
}

function tsType(def) {
  if (!def) return "unknown";
  if (def.$ref) return def.$ref.split("/").pop();
  if (def.type === "string") return "string";
  if (def.type === "integer" || def.type === "number") return "number";
  if (def.type === "boolean") return "boolean";
  if (def.type === "array") return `Array<${tsType(def.items)}>`;
  if (def.enum) return def.enum.map((v) => JSON.stringify(v)).join(" | ");
  if (def.anyOf) return def.anyOf.map(tsType).join(" | ");
  return "Record<string, unknown>";
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, header + (body || "export {};\n"), "utf8");
console.log(`[contracts:sync] wrote ${OUT} (${Object.keys(schemas).length} schemas)`);
