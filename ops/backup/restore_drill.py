#!/usr/bin/env python3
"""Read-only integrity and restore drill for the newest Shiloh automatic SQLite snapshot."""
import os, sqlite3, tempfile, pathlib, time, sys
backup_dir=pathlib.Path(os.environ.get('SHILOH_BACKUP_DIR','/home/lightworld/data/shiloh-store/backups'))
files=sorted(backup_dir.glob('custom-*.db'),key=lambda f:f.stat().st_mtime,reverse=True)
if not files:sys.exit('FAIL: no Shiloh database backups available')
recent=files[0]
age=(time.time()-recent.stat().st_mtime)/3600
if age > 36:sys.exit(f'FAIL: newest backup is {age:.1f} hours old')
with tempfile.TemporaryDirectory(prefix='shiloh-restore-drill-') as dirname:
    restored=pathlib.Path(dirname)/'restored.db'
    with sqlite3.connect('file:'+str(recent)+'?mode=ro',uri=True) as source,sqlite3.connect(restored) as dst:
        source.backup(dst)
    with sqlite3.connect(restored) as db:
        result=db.execute('PRAGMA integrity_check').fetchone()[0]
        if result!='ok':raise RuntimeError('Restored DB integrity check failed: '+result)
        fks=db.execute('PRAGMA foreign_key_check').fetchall()
        if fks:raise RuntimeError('Restored DB has '+str(len(fks))+' foreign-key violations')
        tables={r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        required={'Setting','Product','Order','OrderItem','PaymentAttempt','PaymentAudit','NotificationLog','InventoryVariant','InventoryHold','InventoryEvent'}
        if missing:=sorted(required-tables):raise RuntimeError('Required tables missing: '+','.join(missing))
        stats={table:db.execute('SELECT COUNT(*) FROM "'+table+'"').fetchone()[0] for table in ['Product','Order','PaymentAttempt','InventoryVariant']}
        if stats['Product']<1:raise RuntimeError('Missing product catalogue in restored backup')
        print('PASS: backup restored and verified:',recent.name,'ageHours:',round(age,2),'sizeBytes:',recent.stat().st_size,'counts:',stats)