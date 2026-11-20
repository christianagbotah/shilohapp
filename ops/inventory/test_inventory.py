#!/usr/bin/env python3
import sqlite3, tempfile, shutil, pathlib, urllib.parse, os, sys, uuid
from migrate import apply
line=next(x for x in pathlib.Path('/etc/shiloh-store.env').read_text().splitlines() if x.startswith('DATABASE_URL='))
production=urllib.parse.unquote(urllib.parse.urlparse(line.split('=',1)[1].strip().strip('"\'')).path)
with tempfile.TemporaryDirectory(prefix='shiloh-inventory-uat-') as d:
 p=pathlib.Path(d)/'uat.db'
 with sqlite3.connect('file:'+production+'?mode=ro',uri=True) as src, sqlite3.connect(p) as dest:src.backup(dest)
 apply(str(p))
 c=sqlite3.connect(p);c.execute('PRAGMA foreign_keys=ON')
 product=c.execute('SELECT id,name,colors,sizes,type,ageGroup,price FROM Product WHERE active=1 AND type="tshirt" LIMIT 1').fetchone();assert product
 import json
 color=json.loads(product[2])[0]['name']; size=json.loads(product[3])[0]
 c.execute('INSERT INTO InventoryVariant(productId,color,size,capStyle,onHand,lowStockAt) VALUES(?,?,?,"",2,1)',(product[0],color,size)); c.commit()
 def order(quantity):
  ident=str(uuid.uuid4()).replace('-','')[:22]; code='TEST-'+ident[:9]
  c.execute('BEGIN')
  try:
   c.execute('INSERT INTO "Order"(id,code,fullName,phone,subtotal,total,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?)',(ident,code,'Sandbox Only','0000000000',quantity*product[6],quantity*product[6],0,0))
   c.execute('INSERT INTO "OrderItem"(id,orderId,productId,productName,productType,ageGroup,color,size,capStyle,unitPrice,quantity) VALUES (?,?,?,?,?,?,?,?,?,?,?)',(ident+'I',ident,product[0],product[1],product[4],product[5],color,size,None,product[6],quantity))
   c.commit();return ident
  except:
   c.rollback();raise
 def totals():return c.execute('SELECT onHand,reserved FROM InventoryVariant').fetchone()
 a=order(1);assert totals()==(2,1),totals()
 try:order(2);raise AssertionError('oversell accepted')
 except sqlite3.IntegrityError as e:assert 'SHILOH_OUT_OF_STOCK' in str(e),e
 assert totals()==(2,1)
 c.execute('UPDATE "Order" SET status="cancelled" WHERE id=?',(a,));c.commit();assert totals()==(2,0)
 assert c.execute('SELECT state FROM InventoryHold WHERE orderId=?',(a,)).fetchone()[0]=='released'
 b=order(1);assert totals()==(2,1)
 c.execute('UPDATE "Order" SET status="fulfilled" WHERE id=?',(b,));c.commit();assert totals()==(1,0)
 c.execute('UPDATE "Order" SET status="fulfilled" WHERE id=?',(b,));c.commit();assert totals()==(1,0)
 c.execute('UPDATE "Order" SET status="cancelled" WHERE id=?',(b,));c.commit();assert totals()==(1,0),totals()
 try: order(2);raise AssertionError('Oversell after fulfillment accepted')
 except sqlite3.IntegrityError:pass
 c.execute('UPDATE InventoryVariant SET enabled=0');c.commit()
 try:order(1);raise AssertionError('Paused variant was sold')
 except sqlite3.IntegrityError:pass
 c.execute('UPDATE InventoryVariant SET enabled=1');c.commit()
 assert c.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
 print('PASS: reserve, oversell rollback, cancel release, fulfill consumption, idempotent updates, no re-stock on post-fulfillment cancellation')
 print('Inventory events:',list(c.execute('SELECT event,quantity FROM InventoryEvent ORDER BY id')))