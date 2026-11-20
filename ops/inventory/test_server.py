#!/usr/bin/env python3
"""Exercise the inventory UI against an isolated snapshot; never writes live data."""
import subprocess,sqlite3,pathlib,urllib.parse,tempfile,hashlib,base64,secrets,time,urllib.request,urllib.error,os,json
from migrate import apply
envline=next(x for x in pathlib.Path('/etc/shiloh-store.env').read_text().splitlines() if x.startswith('DATABASE_URL='))
production=urllib.parse.unquote(urllib.parse.urlparse(envline.split('=',1)[1].strip().strip('"\'')).path)
service='/home/lightworld/services/shiloh-inventory'
with tempfile.TemporaryDirectory(prefix='shiloh-stock-web-uat-') as dirname:
    path=pathlib.Path(dirname)/'qa.db'
    with sqlite3.connect('file:'+production+'?mode=ro',uri=True) as src,sqlite3.connect(path) as dst:src.backup(dst)
    apply(str(path))
    session=base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip('=')
    c=sqlite3.connect(path)
    c.execute('INSERT INTO AdminSession(id,tokenHash,createdAt,expiresAt) VALUES(?,?,?,?)',('uat-session',hashlib.sha256(session.encode()).hexdigest(),int(time.time()*1000),int(time.time()*1000)+3600_000))
    c.commit();c.close()
    env=os.environ.copy();env.update({'SHILOH_DB_PATH':str(path),'SHILOH_SETTINGS_ENCRYPTION_KEY':base64.b64encode(secrets.token_bytes(32)).decode(),'INVENTORY_PORT':'3067'})
    p=subprocess.Popen(['/home/lightworld/.bun/bin/bun',service+'/server.mjs'],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    url='http://127.0.0.1:3067/backoffice/inventory'
    def request(method='GET',cookie=None,body=None,origin=None):
        h={}
        if cookie:h['Cookie']='shiloh-admin-session='+cookie
        if origin:h['Origin']=origin
        if body is not None:
            body=urllib.parse.urlencode(body).encode();h['Content-Type']='application/x-www-form-urlencoded'
        q=urllib.request.Request(url,data=body,method=method,headers=h)
        try:
            with urllib.request.urlopen(q,timeout=5) as r:return r.status,r.read().decode()
        except urllib.error.HTTPError as e:return e.code,e.read().decode()
    try:
        for i in range(30):
            if p.poll() is not None:raise RuntimeError('Process failed: '+str(p.stderr.read()))
            try:
                status,b=request()
                if status==401:break
            except Exception:time.sleep(.1)
        else:raise RuntimeError('App never started')
        assert (status,b.split('<',1)[0]) and status==401
        status,html=request(cookie=session)
        assert status==200,(status,html[:100])
        assert 'Inventory control' in html and 'Stock-controlled variants' in html
        import re
        token=re.search(r'name="csrf" value="([a-f0-9]{64})"',html).group(1)
        options=re.findall(r'<option value="([^"]+)"',html)
        assert options,'Missing product variant options'
        import html as htmlmod
        variant=htmlmod.unescape(options[0])
        payload={'csrf':token,'action':'create','variant':variant,'onHand':'5','lowStockAt':'2'}
        status,html=request(method='POST',cookie=session,body=payload)
        assert status==403,('Cross-origin POST succeeded!',status)
        status,html=request(method='POST',cookie=session,body=payload,origin='https://other.lightworldtech.com')
        assert status==403
        status,html=request(method='POST',cookie=session,body=payload,origin='https://shiloh.lightworldtech.com')
        # Browser follows redirect: test URL behind localhost won't resolve? urllib redirects public site. Check staging db instead.
        c=sqlite3.connect(path)
        n=c.execute('SELECT count(*) FROM InventoryVariant WHERE onHand=5').fetchone()[0]
        assert n==1,(status,html[:160])
        nEvents=c.execute('SELECT count(*) FROM InventoryEvent WHERE event="stock_opened"').fetchone()[0]
        assert nEvents==1
        c.close()
        assert p.poll() is None
        print('PASS: unauthenticated access rejected, admin session accepted, cross-origin mutation rejected, inventory form created variant, event audited')
    finally:
        p.terminate()
        try:p.wait(timeout=4)
        except subprocess.TimeoutExpired:p.kill()