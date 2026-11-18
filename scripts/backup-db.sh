#!/usr/bin/env bash
# Daily backup of the Shiloh merch SQLite database.
#
# Creates a consistent snapshot (SQLite VACUUM INTO) while the dev server
# keeps running, verifies the snapshot is readable, and prunes old copies
# so only the newest 14 remain. Safe to run any time; exits non-zero on
# any failure so schedulers can detect a problem.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f db/custom.db ]; then
  echo "ERROR: db/custom.db not found" >&2
  exit 1
fi

mkdir -p backups
F="backups/custom-$(date +%Y%m%d-%H%M).db"

# Snapshot (readonly connection — the live database is never written to).
F="$F" bun -e 'const {Database}=require("bun:sqlite");const d=new Database("db/custom.db",{readonly:true});d.exec("VACUUM INTO \x27"+process.env.F+"\x27");d.close();'

# Verify the snapshot opens and reports sane row counts.
bun -e "const {Database}=require('bun:sqlite');const d=new Database(process.argv[1],{readonly:true});const c=(t)=>d.query('SELECT COUNT(*) n FROM \"'+t+'\"').get().n;console.log('verified '+process.argv[1]+' — Product: '+c('Product')+' Order: '+c('Order')+' Setting: '+c('Setting'));d.close();" "$F"

# Prune: keep the newest 14 backups.
ls -t backups/custom-*.db | tail -n +15 | xargs -r rm --
echo "kept: $(ls backups/custom-*.db | wc -l) backup(s) in backups/"
