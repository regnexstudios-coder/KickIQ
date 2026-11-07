/**
 * pnpm import <file> --client <uuid> [--type <report_type>] [--by <who>]
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-side only; never ship to a browser).
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { importFile } from "../lib/import/importer";
import { SupabaseStore } from "../lib/import/supabaseStore";
import { reportTypeSchema } from "../lib/parsers/types";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { client: { type: "string" }, type: { type: "string" }, by: { type: "string", default: "cli" } },
});
const file = positionals[0];
if (!file || !values.client) {
  console.error("Usage: pnpm import <file.csv|xlsx> --client <client-uuid> [--type <report_type>] [--by <name>]");
  process.exit(2);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).");
  process.exit(2);
}
const reportType = values.type ? reportTypeSchema.parse(values.type) : undefined;

const store = new SupabaseStore(createClient(url, key, { auth: { persistSession: false } }));
const r = await importFile(store, { clientId: values.client, buffer: readFileSync(file), fileName: basename(file), importedBy: values.by!, reportType });

if (r.duplicate) console.log(`⚠ Already imported (import ${r.importId}). Nothing changed.`);
console.log(`${r.reportType}: ${r.rowsParsed} rows parsed, ${r.rowsSkipped} skipped, ${r.unparsed.length} unparsed`);
console.log(`orders: ${r.orders} · deductions: ${r.deductionsNew} new, ${r.deductionsSeen} already known · credits: ${r.creditsNew} new`);
for (const u of r.unparsed) console.log(`  row ${u.row}: ${u.reason}`);
