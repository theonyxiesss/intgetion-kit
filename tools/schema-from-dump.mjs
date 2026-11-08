#!/usr/bin/env node
// Turns a `pg_dump --schema-only --no-owner --no-privileges -t ...` of a module's
// tables into a migration that is safe to run again on a live database.
// Usage: node tools/schema-from-dump.mjs <dump.sql> <out.sql> <header text> [type=v1,v2 ...]
import { readFileSync, writeFileSync } from "node:fs";

const [dumpPath, outPath, header, ...typeArgs] = process.argv.slice(2);
if (!dumpPath || !outPath) {
  console.error("usage: schema-from-dump <dump.sql> <out.sql> <header> [type=v1,v2 ...]");
  process.exit(1);
}

const text = readFileSync(dumpPath, "utf8").replace(/\r\n/g, "\n");
const statements = text
  .split("\n")
  .filter((line) => !line.startsWith("--") && !line.startsWith("\\"))
  .join("\n")
  .split(/;\n/)
  .map((s) => s.trim())
  .filter(Boolean)
  .filter((s) => !/^SET |^SELECT pg_catalog\./.test(s));

const quote = (value) => `'${value.replaceAll("'", "''")}'`;
const out = [];

out.push(
  header
    .split("\\n")
    .map((line) => `-- ${line}`)
    .join("\n"),
);

if (typeArgs.length) {
  const lines = ["DO $$", "BEGIN"];
  for (const arg of typeArgs) {
    const [name, values] = arg.split("=");
    lines.push(
      `  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = ${quote(name)}) THEN`,
      `    CREATE TYPE public.${name} AS ENUM (${values.split(",").map(quote).join(", ")});`,
      "  END IF;",
    );
  }
  lines.push("END", "$$;");
  out.push(
    "-- Shared types: created only when missing (other modules use them too).\n" +
      lines.join("\n"),
  );
}

for (const raw of statements) {
  let s = raw;
  let m;
  if ((m = s.match(/^CREATE TABLE (public\.\w+) \(/))) {
    out.push(s.replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ") + ";");
  } else if (
    (m = s.match(/^ALTER TABLE ONLY (public\.(\w+))\s+ADD CONSTRAINT (\w+) ([\s\S]+)$/))
  ) {
    const [, table, , name, body] = m;
    out.push(
      `DO $$\nBEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = ${quote(name)}) THEN\n    ALTER TABLE ${table} ADD CONSTRAINT ${name} ${body};\n  END IF;\nEND\n$$;`,
    );
  } else if (/^CREATE (UNIQUE )?INDEX /.test(s)) {
    out.push(s.replace(/^CREATE (UNIQUE )?INDEX /, "CREATE $1INDEX IF NOT EXISTS ") + ";");
  } else if (/^CREATE TRIGGER /.test(s)) {
    out.push(s.replace(/^CREATE TRIGGER /, "CREATE OR REPLACE TRIGGER ") + ";");
  } else if ((m = s.match(/^CREATE POLICY (\w+) ON (public\.(\w+)) ([\s\S]+)$/))) {
    const [, name, table, short] = m;
    out.push(
      `DO $$\nBEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = ${quote(short)} AND policyname = ${quote(name)}) THEN\n    ${s};\n  END IF;\nEND\n$$;`,
    );
  } else if (/^ALTER TABLE (ONLY )?public\.\w+ (ENABLE|FORCE) ROW LEVEL SECURITY$/.test(s)) {
    out.push(s + ";");
  } else if (/^COMMENT ON /.test(s)) {
    out.push(s + ";");
  } else if (/^CREATE (OR REPLACE )?FUNCTION /.test(s)) {
    out.push(s.replace(/^CREATE FUNCTION /, "CREATE OR REPLACE FUNCTION ") + ";");
  } else {
    throw new Error(`unhandled statement:\n${s.slice(0, 200)}`);
  }
}

writeFileSync(outPath, out.join("\n\n") + "\n");
console.log(`wrote ${outPath} (${statements.length} statements)`);
