import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const directory = join(process.cwd(), "supabase", "migrations");
const files = (await readdir(directory)).filter(file => file.endsWith(".sql")).sort();
if (!files.length) throw new Error("No Supabase migrations were found.");

const numbers = files.map(file => Number(file.match(/^(\d+)_/)?.[1]));
if (numbers.some(Number.isNaN)) throw new Error("Every migration must begin with a numeric prefix.");
if (new Set(numbers).size !== numbers.length) throw new Error("Migration prefixes must be unique.");
for (let index = 1; index < numbers.length; index++) {
  if (numbers[index] !== numbers[index - 1] + 1) throw new Error(`Migration sequence has a gap before ${files[index]}.`);
}

for (const file of files) {
  const sql = await readFile(join(directory, file), "utf8");
  if (!/enable row level security/i.test(sql) && /create table public\./i.test(sql)) {
    throw new Error(`${file} creates a public table without enabling Row Level Security.`);
  }
  if (/\b(service_role|supabase_service_role_key)\b/i.test(sql)) {
    throw new Error(`${file} must not contain a service-role credential or role grant.`);
  }
}

console.log(`Validated ${files.length} ordered Supabase migrations.`);
