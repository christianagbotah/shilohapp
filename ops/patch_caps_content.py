#!/usr/bin/env python3
"""Idempotent opt-in cap-name/content-copy corrections for Shiloh production.

Preserves historical OrderItem rows and all credentials, applies no schema DDL.
Creates a SQLite online snapshot before editing (unless --dry-run).
"""
import sqlite3, argparse, pathlib, json, datetime
p=argparse.ArgumentParser()
p.add_argument('db_path')
p.add_argument('--backup-dir',default='/home/lightworld/data/shiloh-store/backups')
p.add_argument('--dry-run',action='store_true')
args=p.parse_args()
src=pathlib.Path(args.db_path).resolve(strict=True)
db=sqlite3.connect(str(src),timeout=25)
db.row_factory=sqlite3.Row
caps=db.execute("SELECT id,name,capStyles FROM Product WHERE type='cap' AND active=1").fetchall()
before=[(r['name'],r['capStyles']) for r in caps]
items=db.execute("SELECT COUNT(*) FROM OrderItem WHERE productType='cap'").fetchone()[0]
print('Cap products:',before,'historical cap order items:',items)
changes=[]
for row in caps:
    current=json.loads(row['capStyles']) if row['capStyles'] else []
    new=[]
    for style in current:
        value='Net' if style.lower() == 'soft' else style
        if value not in new and value in ['Hard','Net']:
            new.append(value)
    for required in ['Hard','Net']:
        if required not in new:new.append(required)
    normalized=['Hard','Net']
    if current != normalized:changes.append((row['id'],json.dumps(normalized,separators=(',',':'))))
content=db.execute("SELECT key,value FROM Setting WHERE key LIKE 'content_%'").fetchall()
copy_changes=[]
for row in content:
    try:
        obj=json.loads(row['value'])
    except json.JSONDecodeError:continue
    if row['key']=='content_shop' and isinstance(obj,dict) and obj.get('title')=='Shop the for Shiloh':
        obj['title']='Shop the Shiloh Collection'
        copy_changes.append((row['key'],json.dumps(obj,ensure_ascii=False,separators=(',',':'))))
print('Cap updates:',len(changes),'content corrections:',len(copy_changes))
if not args.dry_run and (changes or copy_changes):
    backup_dir=pathlib.Path(args.backup_dir);backup_dir.mkdir(parents=True,exist_ok=True)
    backup=backup_dir/('pre-cap-copy-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.db')
    with sqlite3.connect(str(backup)) as target:
        db.backup(target)
        assert target.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
    backup.chmod(0o600)
    print('Backup:',backup.name)
    with db:
        for item in changes:
            db.execute("UPDATE Product SET capStyles=? WHERE id=?",(item[1],item[0]))
        for item in copy_changes:
            db.execute("UPDATE Setting SET value=? WHERE key=?",(item[1],item[0]))
    assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
    print('Confirmed production cap styles:',[r['capStyles'] for r in db.execute("SELECT capStyles FROM Product WHERE type='cap' AND active=1")])
db.close()
