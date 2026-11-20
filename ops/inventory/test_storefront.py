#!/usr/bin/env python3
"""Full POST /api/orders UAT on a private SQLite snapshot and isolated Next instance."""
import os, pathlib, sqlite3, urllib.parse, tempfile, subprocess, json, time, urllib.request, urllib.error
v=next(x.split('=',1)[1] for x in pathlib.Path('/etc/shiloh-store.env').read_text().splitlines() if x.startswith('DATABASE_URL='))
source=urllib.parse.unquote(urllib.parse.urlparse(v.strip().strip('"\'')).path)
release='/home/lightworld/webapps/shiloh-store/releases/inventory-20261120'
with tempfile.TemporaryDirectory(prefix='shiloh-storefront-order-uat-') as wd:
    dbpath=str(pathlib.Path(wd)/'order-test.db')
    with sqlite3.connect('file:'+source+'?mode=ro',uri=True) as src,sqlite3.connect(dbpath) as dst:src.backup(dst)
    c=sqlite3.connect(dbpath)
    c.execute("UPDATE Setting SET value='0' WHERE key IN ('notify_customer_sms','notify_admin_sms','notify_admin_email')")
    r=c.execute("SELECT id,colors,sizes FROM Product WHERE active=1 AND type='tshirt' LIMIT 1").fetchone()
    pId=r[0];color=json.loads(r[1])[0]['name'];size=json.loads(r[2])[0]
    c.execute('INSERT INTO InventoryVariant(productId,color,size,capStyle,onHand,lowStockAt) VALUES(?,?,?,\'\',1,1)',(pId,color,size))
    c.commit();c.close()
    env=os.environ.copy()
    env.update({'NODE_ENV':'production','PORT':'3068','HOSTNAME':'127.0.0.1','DATABASE_URL':'file:'+dbpath,'SHILOH_DB_PATH':dbpath,
      'SHILOH_PAYMENTS_ENABLED':'false','NEXT_PUBLIC_SITE_URL':'http://127.0.0.1:3068'})
    proc=subprocess.Popen(['/home/lightworld/.bun/bin/bun','server.js'],cwd=release,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        for n in range(100):
            if proc.poll() is not None:raise AssertionError('QA application quit unexpectedly')
            try:
                with urllib.request.urlopen('http://127.0.0.1:3068/api/products',timeout=1) as rs:
                    if rs.status==200:break
            except Exception: time.sleep(.15)
        else: raise AssertionError('QA application did not start')
        def post(qty):
            body=json.dumps({'fullName':'Sandbox Customer','phone':'0240000000','address':'Staging only', 'items':[{'productId':pId,'color':color,'size':size,'quantity':qty}]}).encode()
            request=urllib.request.Request('http://127.0.0.1:3068/api/orders',data=body,headers={'Content-Type':'application/json'},method='POST')
            try:
                with urllib.request.urlopen(request,timeout=9) as rs:return rs.status,json.load(rs)
            except urllib.error.HTTPError as e:return e.code,json.loads(e.read())
        bad,body=post(2)
        assert bad==409,(bad,str(body)[:210])
        assert 'sold out' in body.get('error',''),body
        ok,body=post(1)
        assert ok==201,(ok,str(body)[:220])
        orderId=body['order']['id']
        c=sqlite3.connect(dbpath)
        assert c.execute('SELECT reserved FROM InventoryVariant').fetchone()[0]==1
        bad,body=post(1);assert bad==409,(bad,body)
        c.execute('UPDATE "Order" SET status="cancelled" WHERE id=?',(orderId,));c.commit()
        assert c.execute('SELECT reserved FROM InventoryVariant').fetchone()[0]==0
        ok,body=post(1);assert ok==201,(ok,str(body)[:220])
        assert c.execute('SELECT reserved FROM InventoryVariant').fetchone()[0]==1
        assert c.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
        c.close()
        print('PASS: isolated real Next API checks: 409 oversell, 201 valid order, 409 unavailable, cancel releases stock, 201 next order')
    finally:
        proc.terminate()
        try:proc.wait(timeout=5)
        except subprocess.TimeoutExpired:proc.kill()