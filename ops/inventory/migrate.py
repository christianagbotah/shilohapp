#!/usr/bin/env python3
"""Opt-in Shiloh stock tracking. Zero configured variants means legacy checkout is unaffected."""
import sqlite3, os, sys

SCHEMA = r'''
CREATE TABLE IF NOT EXISTS "InventoryVariant" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  productId TEXT NOT NULL REFERENCES "Product"(id),
  color TEXT NOT NULL,
  size TEXT NOT NULL,
  capStyle TEXT NOT NULL DEFAULT '',
  onHand INTEGER NOT NULL DEFAULT 0 CHECK(onHand >= 0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved >= 0 AND reserved <= onHand),
  lowStockAt INTEGER NOT NULL DEFAULT 3 CHECK(lowStockAt >= 0),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  createdAt INTEGER NOT NULL DEFAULT ((CAST(strftime('%s','now') AS INTEGER)*1000)),
  updatedAt INTEGER NOT NULL DEFAULT ((CAST(strftime('%s','now') AS INTEGER)*1000)),
  UNIQUE(productId, color, size, capStyle)
);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON "InventoryVariant"(productId);
CREATE TABLE IF NOT EXISTS "InventoryHold" (
  orderItemId TEXT PRIMARY KEY REFERENCES "OrderItem"(id) ON DELETE CASCADE,
  orderId TEXT NOT NULL REFERENCES "Order"(id) ON DELETE CASCADE,
  variantId INTEGER NOT NULL REFERENCES "InventoryVariant"(id),
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  state TEXT NOT NULL DEFAULT 'held' CHECK(state IN ('held','sold','released')),
  createdAt INTEGER NOT NULL DEFAULT ((CAST(strftime('%s','now') AS INTEGER)*1000)),
  changedAt INTEGER NOT NULL DEFAULT ((CAST(strftime('%s','now') AS INTEGER)*1000))
);
CREATE INDEX IF NOT EXISTS idx_inventory_hold_order ON "InventoryHold"(orderId,state);
CREATE TABLE IF NOT EXISTS "InventoryEvent" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  variantId INTEGER NOT NULL REFERENCES "InventoryVariant"(id),
  orderId TEXT,
  event TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  actor TEXT NOT NULL,
  detail TEXT,
  createdAt INTEGER NOT NULL DEFAULT ((CAST(strftime('%s','now') AS INTEGER)*1000))
);
CREATE INDEX IF NOT EXISTS idx_inventory_event_time ON "InventoryEvent"(createdAt);

DROP TRIGGER IF EXISTS shiloh_inventory_check_order_item;
CREATE TRIGGER IF NOT EXISTS shiloh_inventory_check_order_item
BEFORE INSERT ON "OrderItem"
WHEN EXISTS (
 SELECT 1 FROM "InventoryVariant" i WHERE i.productId=NEW.productId AND i.color=NEW.color
  AND i.size=NEW.size AND i.capStyle=COALESCE(NEW.capStyle,'')
)
BEGIN
 SELECT RAISE(ABORT,'SHILOH_OUT_OF_STOCK') WHERE EXISTS (
 SELECT 1 FROM "InventoryVariant" i WHERE i.productId=NEW.productId AND i.color=NEW.color
  AND i.size=NEW.size AND i.capStyle=COALESCE(NEW.capStyle,'')
  AND (i.enabled=0 OR (i.onHand-i.reserved) < NEW.quantity)
 );
END;

CREATE TRIGGER IF NOT EXISTS shiloh_inventory_reserve_order_item
AFTER INSERT ON "OrderItem"
WHEN EXISTS (
 SELECT 1 FROM "InventoryVariant" i WHERE i.productId=NEW.productId AND i.color=NEW.color
  AND i.size=NEW.size AND i.capStyle=COALESCE(NEW.capStyle,'') AND i.enabled=1
)
BEGIN
 INSERT INTO "InventoryHold" (orderItemId,orderId,variantId,quantity)
  SELECT NEW.id,NEW.orderId,i.id,NEW.quantity FROM "InventoryVariant" i
  WHERE i.productId=NEW.productId AND i.color=NEW.color AND i.size=NEW.size
  AND i.capStyle=COALESCE(NEW.capStyle,'') AND i.enabled=1;
 UPDATE "InventoryVariant" SET reserved=reserved+NEW.quantity,updatedAt=(CAST(strftime('%s','now') AS INTEGER)*1000)
  WHERE id=(SELECT variantId FROM "InventoryHold" WHERE orderItemId=NEW.id);
 INSERT INTO "InventoryEvent" (variantId,orderId,event,quantity,actor)
  SELECT variantId,NEW.orderId,'reserved',NEW.quantity,'checkout' FROM "InventoryHold" WHERE orderItemId=NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS shiloh_inventory_hold_transition
AFTER UPDATE OF state ON "InventoryHold"
WHEN NEW.state<>OLD.state AND OLD.state='held'
BEGIN
 UPDATE "InventoryVariant" SET reserved=reserved-OLD.quantity,
  onHand=onHand-CASE WHEN NEW.state='sold' THEN OLD.quantity ELSE 0 END,
  updatedAt=(CAST(strftime('%s','now') AS INTEGER)*1000) WHERE id=OLD.variantId;
 INSERT INTO "InventoryEvent"(variantId,orderId,event,quantity,actor)
 VALUES(OLD.variantId,OLD.orderId,CASE WHEN NEW.state='sold' THEN 'fulfilled' ELSE 'released' END,OLD.quantity,'order-status');
END;

CREATE TRIGGER IF NOT EXISTS shiloh_inventory_order_completed
AFTER UPDATE OF status ON "Order"
WHEN OLD.status<>NEW.status AND NEW.status='fulfilled'
BEGIN
 UPDATE "InventoryHold" SET state='sold',changedAt=(CAST(strftime('%s','now') AS INTEGER)*1000)
  WHERE orderId=NEW.id AND state='held';
END;

CREATE TRIGGER IF NOT EXISTS shiloh_inventory_order_cancelled
AFTER UPDATE OF status ON "Order"
WHEN OLD.status<>NEW.status AND NEW.status='cancelled'
BEGIN
 UPDATE "InventoryHold" SET state='released',changedAt=(CAST(strftime('%s','now') AS INTEGER)*1000)
  WHERE orderId=NEW.id AND state='held';
END;

CREATE TRIGGER IF NOT EXISTS shiloh_inventory_deleted_order_item
BEFORE DELETE ON "OrderItem"
BEGIN
 UPDATE "InventoryHold" SET state='released',changedAt=(CAST(strftime('%s','now') AS INTEGER)*1000)
  WHERE orderItemId=OLD.id AND state='held';
END;
'''

def apply(db_path):
    connection = sqlite3.connect(db_path, timeout=30)
    connection.execute('PRAGMA busy_timeout=30000')
    connection.execute('PRAGMA foreign_keys=ON')
    connection.executescript(SCHEMA)
    result=connection.execute('PRAGMA integrity_check').fetchone()[0]
    assert result == 'ok', result
    print('Inventory schema ready; tracked variants:',connection.execute('SELECT count(*) FROM InventoryVariant').fetchone()[0],'; db integrity:',result)
    connection.close()

if __name__=='__main__':
    assert len(sys.argv)==2, 'Usage: migrate.py /abs/path/to/db'
    apply(sys.argv[1])