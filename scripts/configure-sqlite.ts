/**
 * Run once on the live persistent database before launch:
 * SHILOH_DB_PATH=/absolute/path/to/custom.db bun scripts/configure-sqlite.ts
 * WAL persists for the database; busy_timeout is connection-scoped and is
 * therefore for this inspection session only.
 */
import { Database } from "bun:sqlite";
import { resolve } from "node:path";

const file = process.env.SHILOH_DB_PATH;
if (!file) throw new Error("SHILOH_DB_PATH must point to the persistent SQLite file");
const db = new Database(resolve(file));
try {
  const integrity = db.query("PRAGMA integrity_check").get() as Record<string, string> | null;
  if (!integrity || Object.values(integrity)[0] !== "ok") {
    throw new Error("Database integrity check failed; do not enable payments");
  }
  db.exec("PRAGMA busy_timeout = 5000");
  const row = db.query("PRAGMA journal_mode = WAL").get() as Record<string, string>;
  console.log("SQLite integrity: OK; journal mode:", Object.values(row)[0]);
} finally {
  db.close();
}
