#!/usr/bin/env bash
# Consistent SQLite snapshot; use persistent, independently backed storage.
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_FILE="${SHILOH_DB_PATH:-$ROOT/db/custom.db}"
OUT_DIR="${SHILOH_BACKUP_DIR:-$HOME/shiloh-backups}"
DB_FILE="$(realpath -m "$DB_FILE")"
OUT_DIR="$(realpath -m "$OUT_DIR")"

if [ ! -f "$DB_FILE" ]; then
  echo "Backup ERROR: SQLite file not found: $DB_FILE" >&2
  exit 1
fi
case "$OUT_DIR" in
  "$ROOT"|"$ROOT"/*)
    echo "Backup ERROR: backups must be outside the deployment" >&2
    exit 1
    ;;
esac
mkdir -p "$OUT_DIR"
F="$OUT_DIR/custom-$(date -u +%Y%m%d-%H%M%S).db"
if [ -e "$F" ]; then
  echo "Backup ERROR: snapshot path already exists" >&2
  exit 1
fi
DB_FILE="$DB_FILE" SNAPSHOT="$F" bun -e '
const {Database}=require("bun:sqlite");
const db=new Database(process.env.DB_FILE,{readonly:true});
const target=process.env.SNAPSHOT.replaceAll("\x27","\x27\x27");
db.exec("VACUUM INTO \x27"+target+"\x27");db.close();
'
SNAPSHOT="$F" bun -e '
const {Database}=require("bun:sqlite");
const db=new Database(process.env.SNAPSHOT,{readonly:true});
const row=db.query("PRAGMA quick_check").get();
if (!row || Object.values(row)[0] !== "ok") throw new Error("SQLite integrity check failed");
for(const name of ["Product","Order","Setting","PaymentAttempt","PaymentAudit"]) {
  const count=db.query("SELECT COUNT(*) AS n FROM \""+name+"\"").get();
  console.log(name+": "+count.n);
}
db.close();
'
find "$OUT_DIR" -maxdepth 1 -type f -name 'custom-*.db' -printf '%T@ %p\n' \
  | sort -nr | tail -n +15 | cut -d' ' -f2- | while IFS= read -r old; do rm -- "$old"; done
echo "Backup verified: $F"
echo "IMPORTANT: replicate snapshots to off-server storage."
