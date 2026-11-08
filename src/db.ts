import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hostedSsl, withoutSslMode } from "./ssl";

let database: PostgresJsDatabase | undefined;

export function maxConnections(url: string): number {
  try {
    return new URL(url).port === "6543" ? 4 : 1;
  } catch {
    return 1;
  }
}

export function getDb(): PostgresJsDatabase {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  database ??= drizzle(
    postgres(withoutSslMode(url), {
      max: maxConnections(url),
      prepare: false,
      ssl: hostedSsl(url),
    }),
  );
  return database;
}
