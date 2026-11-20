import { Database } from 'bun:sqlite';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const DB_FILE = process.env.SHILOH_DB_PATH || '';
if (!DB_FILE.startsWith('/')) throw Error('SHILOH_DB_PATH must be absolute');
const db = new Database(DB_FILE, { strict: true });
db.exec('PRAGMA busy_timeout=7000');
db.exec('PRAGMA foreign_keys=ON');
const HOST = 'shiloh.lightworldtech.com';
const PORT = Number(process.env.INVENTORY_PORT || 3066);
const KEY = Buffer.from(process.env.SHILOH_SETTINGS_ENCRYPTION_KEY || '', 'base64');
if (KEY.length !== 32) throw Error('Missing valid settings encryption key');
const fmt = (n) => new Intl.NumberFormat('en-GH').format(n);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const integer = (value, min = 0, max = 1_000_000) => {
  const v = String(value ?? '');
  if (!/^(0|[1-9]\d*)$/.test(v)) throw Error('Enter a whole-number stock quantity');
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw Error('Stock quantity is out of range');
  return n;
};
const headers = { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'private, no-store',
 'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY', 'Referrer-Policy':'same-origin',
 'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
};
const reply = (content,status=200,extra={})=>new Response(content,{status,headers:{...headers,...extra}});
const PAGE = '/backoffice/inventory';

function authorization(req) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/(?:^|;\s*)shiloh-admin-session=([A-Za-z0-9_-]{43})(?:;|$)/);
  if (!m) return null;
  const hash = createHash('sha256').update(m[1]).digest('hex');
  const row = db.query('SELECT expiresAt FROM AdminSession WHERE tokenHash=?').get(hash);
  if (!row || Number(row.expiresAt) <= Date.now()) return null;
  return {session:hash,csrf:createHmac('sha256',KEY).update(hash).digest('hex')};
}

function allVariants() {
  const products=db.query('SELECT id,name,type,active,colors,sizes,capStyles FROM Product ORDER BY sortOrder,name').all();
  const options=[];
  for(const p of products){
    if(!p.active) continue;
    let colors,sizes,capStyles;
    try {
      colors=JSON.parse(p.colors).map(c=>typeof c==='string'?c:c.name);
      sizes=JSON.parse(p.sizes);
      capStyles=p.type==='cap' && p.capStyles ? JSON.parse(p.capStyles):[''];
    } catch { continue; }
    if(!Array.isArray(colors)||!Array.isArray(sizes)||!Array.isArray(capStyles))continue;
    for(const color of colors)for(const size of sizes)for(const capStyle of capStyles){
      if (![color,size,capStyle].every(x=>typeof x==='string'&&x.length<=64)) continue;
      options.push({productId:p.id,product:p.name,color,size,capStyle});
    }
  }
  return options;
}

function trackedRows() {
 return db.query(`SELECT i.*,p.name AS productName,p.active AS productActive
  FROM InventoryVariant i JOIN Product p ON p.id=i.productId
  ORDER BY p.sortOrder, p.name, i.color,i.size,i.capStyle`).all();
}
function statusBadge(n,enabled,threshold){return !enabled?'Paused':n<=0?'Sold out':n<=threshold?'Low stock':'Available';}
function render(req,ctx,notice='',error='') {
 const rows=trackedRows(), options=allVariants();
 const trackedKey=new Set(rows.map(r=>JSON.stringify([r.productId,r.color,r.size,r.capStyle])));
 const untracked=options.filter(o=>!trackedKey.has(JSON.stringify([o.productId,o.color,o.size,o.capStyle])));
 const low=rows.filter(r=>r.enabled && r.onHand-r.reserved<=r.lowStockAt).length;
 const total=rows.filter(r=>r.enabled).reduce((n,r)=>n+r.onHand-r.reserved,0);
 const active=rows.filter(r=>r.enabled).length;
 const orderStats=db.query(`SELECT paymentStatus, COUNT(*) AS n FROM "Order"
  GROUP BY paymentStatus`).all();
 const messages = [notice && `<div class="notice" role="status">${esc(notice)}</div>`,
                   error && `<div class="error" role="alert">${esc(error)}</div>`].join('');
 const availableOptions=untracked.map(o=>{
   const v=JSON.stringify([o.productId,o.color,o.size,o.capStyle]);
   return `<option value="${esc(v)}">${esc(o.product)} · ${esc(o.color)} · ${esc(o.size)}${o.capStyle?' · '+esc(o.capStyle):''}</option>`;
 }).join('');
 const stockTable=rows.map(r=>{
   const free=r.onHand-r.reserved;
   const state=statusBadge(free,r.enabled,r.lowStockAt);
   const statusClass=!r.enabled?'paused':free<=r.lowStockAt?'low':'ok';
   return `<tr>
    <td><strong>${esc(r.productName)}</strong><span class="muted mobile-show">${esc(r.color)} / ${esc(r.size)} ${esc(r.capStyle)}</span></td>
    <td>${esc(r.color)}</td><td>${esc(r.size)}${r.capStyle?' · '+esc(r.capStyle):''}</td>
    <td class="num">${fmt(r.reserved)}</td>
    <td class="num"><strong>${fmt(free)}</strong></td>
    <td><span class="status ${statusClass}">${esc(state)}</span></td>
    <td><form class="edit" method="POST" action="${PAGE}">
      <input type="hidden" name="csrf" value="${ctx.csrf}"/>
      <input type="hidden" name="action" value="update"/>
      <input type="hidden" name="id" value="${r.id}"/>
      <label>On hand <input aria-label="On hand for ${esc(r.productName)}" name="onHand" type="number" inputmode="numeric" min="${r.reserved}" max="1000000" value="${r.onHand}" required/></label>
      <label>Alert at <input aria-label="Low-stock threshold" name="lowStockAt" type="number" inputmode="numeric" min="0" max="1000000" value="${r.lowStockAt}" required/></label>
      <button type="submit" name="enabled" value="1" class="btn btn-sm">Save</button>
      <button type="submit" name="enabled" value="0" class="btn btn-sm ghost">${r.enabled?'Pause':'Keep paused'}</button>
    </form></td>
   </tr>`;
 }).join('');
 const count=orderStats.map(s=>`${esc(s.paymentStatus)}: ${fmt(s.n)}`).join(' · ');
 const events=db.query(`SELECT e.*,p.name AS productName,i.color,i.size,i.capStyle FROM InventoryEvent e
  JOIN InventoryVariant i ON i.id=e.variantId
  JOIN Product p ON p.id=i.productId
  ORDER BY e.id DESC LIMIT 10`).all();
 const trail=events.map(e=>`<tr><td>${esc(new Date(e.createdAt).toISOString().slice(0,16).replace('T',' '))} UTC</td>
  <td>${esc(e.productName)} · ${esc(e.color)} · ${esc(e.size)}</td>
  <td>${esc(e.event)}</td><td class="num">${e.quantity>0?'+':''}${fmt(e.quantity)}</td></tr>`).join('');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
 <title>Inventory Control · Shiloh Back Office</title>
 <style>
 :root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Arial,sans-serif;color:#172d26;background:#f5f7f5}
 *{box-sizing:border-box}body{margin:0}a{color:inherit;text-decoration:none}
 .top{background:#123c31;color:white;padding:22px max(20px,calc((100vw - 1240px)/2));display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}
 .brand{display:flex;align-items:center;gap:12px}.brand .logo{display:grid;place-items:center;background:#fff2c7;color:#123c31;border-radius:13px;width:44px;height:44px;font-weight:900;font-size:21px}
 h1{font-size:22px;line-height:1.2;margin:0}h2{font-size:18px;margin:0 0 12px}.sub{font-size:13px;color:#becfc8;margin-top:3px}
 .back{padding:9px 14px;border:1px solid #709c8d;border-radius:10px;color:white;font-size:13px}
 main{max-width:1280px;padding:24px 18px 64px;margin:auto}
 .intro{margin:0 0 22px;line-height:1.55;color:#596d64;max-width:960px}
 .metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px}
 .metric{background:#fff;border:1px solid #dee7e1;padding:19px 20px;border-radius:15px;box-shadow:0 3px 13px #0c332306}
 .metric span{font-size:13px;color:#587268;display:block}.metric b{font-size:30px;display:block;letter-spacing:-.05em;margin-top:3px}
 .panel{background:#fff;border:1px solid #e1e8e4;border-radius:16px;margin:18px 0;padding:22px;box-shadow:0 3px 13px #0c332306}
 .panel .muted{display:block;color:#63766d;font-size:13px;margin:4px 0 14px}
 .notice,.error{padding:12px 16px;border-radius:11px;margin-bottom:14px}.notice{background:#e0f6e8;color:#115934}.error{background:#fff0f0;color:#a62323}
 input,select{background:white;border:1px solid #c8d7cd;border-radius:8px;padding:10px 11px;font:inherit;min-height:40px;width:100%;color:#233d32}
 label{font-size:12px;color:#586c62;display:block}label input{margin-top:5px}
 .new-form{display:grid;grid-template-columns:minmax(260px,3fr) minmax(95px,1fr) minmax(95px,1fr) auto;gap:12px;align-items:end}
 .btn{background:#186a46;color:#fff;border:0;border-radius:9px;min-height:39px;padding:10px 15px;cursor:pointer;font-weight:650;white-space:nowrap}
 .btn:hover{filter:brightness(1.09)}.btn:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #b6e8a9;outline-offset:1px}
 .ghost{background:#e9f0ed;color:#355044}.btn-sm{font-size:12px;padding:8px 11px;min-height:34px}
 .table-wrap{overflow:auto;width:100%}table{border-collapse:collapse;width:100%;font-size:13px}th{text-align:left;padding:12px;background:#f2f7f4;color:#557064;font-size:11px;text-transform:uppercase;letter-spacing:.035em;white-space:nowrap}
 td{padding:12px;border-bottom:1px solid #e7ede9;vertical-align:middle}td strong{font-weight:650}
 tr:last-child td{border-bottom:0}.num{font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
 .status{display:inline-block;border-radius:100px;padding:5px 8px;white-space:nowrap;font-weight:600;font-size:11px}
 .status.ok{background:#dcf5e7;color:#14613b}.status.low{background:#fff1d5;color:#966100}.status.paused{background:#edf0f2;color:#616e76}
 .edit{display:flex;align-items:end;gap:6px;min-width:310px}.edit label{width:72px}.edit input{padding:5px 6px;font-size:13px;min-height:34px}
 .muted{color:#6a7d71}.mobile-show{display:none}.table-title{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px}
 .table-title a{font-size:12px;color:#156a47;font-weight:650}footer{color:#6e8276;font-size:12px;margin-top:24px}
 @media(max-width:950px){.metrics{grid-template-columns:repeat(2,1fr)}.new-form{grid-template-columns:1fr 1fr}.new-form label:first-child{grid-column:1/-1}.new-form button{grid-column:1/-1}.top{padding:19px 18px}}
 @media(max-width:560px){h1{font-size:19px}main{padding:17px 12px}.metrics{gap:8px}.metric{padding:13px}.metric b{font-size:24px}.panel{padding:14px}.new-form{grid-template-columns:1fr 1fr}.edit{min-width:270px}.top .back{font-size:12px}.mobile-show{display:block;font-size:11px}.num{text-align:right}}
 </style></head>
 <body><header class="top"><div class="brand"><div class="logo">S</div><div><h1>Inventory control</h1><div class="sub">Shiloh 2026 · Back Office</div></div></div>
 <a href="/backoffice" class="back">← Back to orders & settings</a></header>
 <main>${messages}<p class="intro">Track each product, colour, size and cap style separately. Configured variants are automatically reserved when an order is placed, released on cancellation, and deducted at fulfillment. <strong>Unconfigured variants remain available without a quantity limit</strong> until you set their stock.</p>
 <section class="metrics"><div class="metric"><span>Stock-controlled variants</span><b>${fmt(active)}</b></div><div class="metric"><span>Available units</span><b>${fmt(total)}</b></div><div class="metric"><span>Low / sold-out variants</span><b>${fmt(low)}</b></div><div class="metric"><span>Untracked variants</span><b>${fmt(untracked.length)}</b></div></section>
 <section class="panel"><h2>Add a product variant</h2><span class="muted">Set an opening quantity for one exact combination. Previously placed orders are not retroactively reserved.</span>
 <form action="${PAGE}" method="POST" class="new-form">
 <input type="hidden" name="csrf" value="${ctx.csrf}"/><input type="hidden" name="action" value="create"/>
 <label>Product, colour, size and cap style<select name="variant" required>${availableOptions||'<option value="">All variants have been configured</option>'}</select></label>
 <label>On hand<input type="number" inputmode="numeric" name="onHand" value="0" min="0" max="1000000" required/></label>
 <label>Low-stock alert<input type="number" inputmode="numeric" name="lowStockAt" value="3" min="0" max="1000000" required/></label>
 <button class="btn" type="submit" ${untracked.length?'':'disabled'}>Start tracking</button></form></section>
 <section class="panel"><div class="table-title"><h2>Inventory by variant</h2><a href="${PAGE}/export.csv">Export stock CSV ↗</a></div>
 <span class="muted">Reserved units belong to placed but not yet completed/cancelled orders. You cannot reduce stock below reserved quantities. To stop purchases for a variant, pause it (if there are no outstanding reservations), or set on-hand equal to reserved quantity.</span>
 <div class="table-wrap"><table><thead><tr><th>Product</th><th>Colour</th><th>Size / Style</th><th class="num">Reserved</th><th class="num">Available</th><th>Status</th><th>Stock adjustment</th></tr></thead><tbody>${stockTable||'<tr><td colspan="7">No stock quantities configured yet. Add your first product above.</td></tr>'}</tbody></table></div></section>
 <section class="panel"><h2>Latest stock movements</h2><span class="muted">Verified inventory movements; no customer information is exposed in this view.</span>
 <div class="table-wrap"><table><thead><tr><th>Time</th><th>Variant</th><th>Event</th><th class="num">Units</th></tr></thead><tbody>${trail||'<tr><td colspan="4">No movements yet.</td></tr>'}</tbody></table></div></section>
 <footer>Order payment states · ${esc(count||'No orders yet')} · Inventory is a separate restricted Back Office module. For refunds, make a separate financial reconciliation before manually restocking returned merchandise.</footer></main></body></html>`;
}

function save(ctx,form) {
 const csrf=String(form.get('csrf')||'');
 if(!/^[a-f0-9]{64}$/.test(csrf) || !timingSafeEqual(Buffer.from(csrf),Buffer.from(ctx.csrf)))throw Error('Invalid security token. Reload and try again.');
 const action=String(form.get('action'));
 const onHand=integer(form.get('onHand'));
 const lowStockAt=integer(form.get('lowStockAt'));
 const enabled=String(form.get('enabled')||'1')==='0'?0:1;
 if(action==='create'){
  const value=JSON.parse(String(form.get('variant')||'null'));
  if(!Array.isArray(value)||value.length!==4)throw Error('Invalid product variation');
  const candidate=allVariants().find(o=>JSON.stringify([o.productId,o.color,o.size,o.capStyle])===JSON.stringify(value));
  if(!candidate)throw Error('Invalid or inactive product variation');
  db.transaction(()=>{
    const id=db.query('INSERT INTO InventoryVariant(productId,color,size,capStyle,onHand,lowStockAt) VALUES(?,?,?,?,?,?) RETURNING id').get(candidate.productId,candidate.color,candidate.size,candidate.capStyle,onHand,lowStockAt)?.id;
    db.query('INSERT INTO InventoryEvent(variantId,event,quantity,actor,detail) VALUES(?,?,?,?,?)').run(id,'stock_opened',onHand,'admin','Opening inventory');
  })();
  return 'Stock tracking enabled for the selected variant.';
 }
 if(action==='update'){
  const id=integer(form.get('id'),1);
  db.transaction(()=>{
   const previous=db.query('SELECT * FROM InventoryVariant WHERE id=?').get(id);
   if(!previous)throw Error('This variant no longer exists');
   if(onHand<previous.reserved)throw Error('Cannot set on-hand stock below the quantity reserved by customers');
   if(!enabled && previous.reserved>0)throw Error('Cannot pause stock tracking while customer orders have reserved units');
   db.query('UPDATE InventoryVariant SET onHand=?,lowStockAt=?,enabled=?,updatedAt=? WHERE id=?')
    .run(onHand,lowStockAt,enabled,Date.now(),id);
   if(onHand!==previous.onHand || enabled!==previous.enabled){
    db.query('INSERT INTO InventoryEvent(variantId,event,quantity,actor,detail) VALUES(?,?,?,?,?)')
     .run(id,'stock_adjusted',onHand-previous.onHand,'admin',
      'Previous: '+previous.onHand+'; current: '+onHand+'; active: '+enabled);
   }
  })();
  return 'Inventory updated.';
 }
 throw Error('Unsupported inventory action');
}

Bun.serve({
 hostname:'127.0.0.1',port:PORT,idleTimeout:30,
 async fetch(req){
  try{
   const url=new URL(req.url);
   const ctx=authorization(req);
   if(!ctx)return reply('<h1>Sign in required</h1><p>Please use the Shiloh Back Office login first.</p><a href="/backoffice">Back Office</a>',401);
   if(req.method==='GET'&&url.pathname===PAGE){
    const notice=url.searchParams.get('notice')==='saved'?'Stock changes saved successfully.':'';
    return reply(render(req,ctx,notice));
   }
   if(req.method==='GET'&&url.pathname===PAGE+'/export.csv'){
    const rows=trackedRows();
    const csvCell=(v)=>'"'+String(v??'').replaceAll('"','""')+'"';
    const csv=['Product,Colour,Size,CapStyle,OnHand,Reserved,Available,LowStockAt,Enabled',...rows.map(r=>[r.productName,r.color,r.size,r.capStyle,r.onHand,r.reserved,r.onHand-r.reserved,r.lowStockAt,r.enabled].map(csvCell).join(','))].join('\r\n');
    return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="shiloh-inventory.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
   }
   if(req.method==='POST'&&url.pathname===PAGE){
    if(req.headers.get('origin')!=='https://'+HOST) return reply('Cross-origin request blocked',403);
    const contentType=req.headers.get('content-type')||'';
    if(!contentType.startsWith('application/x-www-form-urlencoded'))return reply('Unsupported form',415);
    const content=await req.text();if(content.length>12000)return reply('Form too large',413);
    try{save(ctx,new URLSearchParams(content));}
    catch(err){return reply(render(req,ctx,'',err instanceof Error?err.message:'Could not update stock'),400);}
    return Response.redirect('https://'+HOST+PAGE+'?notice=saved',303);
   }
   return reply('Not found',404);
  }catch(err){
   console.error('Inventory UI error:',err instanceof Error?err.message:'unknown');
   return reply('Inventory service unavailable. No changes were applied.',500);
  }
 }
});
console.log('Shiloh Inventory admin running on localhost:'+PORT);