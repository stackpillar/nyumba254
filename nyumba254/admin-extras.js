/* ═════════ EXTRAS: 16 upgrades — paste this whole block directly ABOVE the line
   /* ═════════ BOOT ═════════ */
(function(){
const X={sla_listing:24,sla_payment:12,sla_verification:48,reveal_thr:15,revN:0,mute:null,quiet:null};
const REJ_DEF=REJ.slice();
const hrs=iso=>iso?(Date.now()-new Date(iso).getTime())/36e5:0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fmtH=h=>h<1?Math.max(1,Math.round(h*60))+'m':h<48?Math.round(h)+'h':Math.floor(h/24)+'d';
const slaBadge=(iso,t)=>{if(!iso)return'—';const h=hrs(iso);return bd(fmtH(h)+(h>t?' · overdue':''),h>t?'bad':h>t*.75?'warn':'ok');};
const inChunks=async(table,sel,col,ids,mod)=>{const out=[];for(let i=0;i<ids.length;i+=80){let q=db.from(table).select(sel).in(col,ids.slice(i,i+80));if(mod)q=mod(q);const{data,error}=await q;if(error)throw error;out.push(...(data||[]));}return out;};
const fetchAll=async build=>{const out=[];for(let i=0;i<30000;i+=1000){const{data,error}=await build().range(i,i+999);if(error)throw error;out.push(...(data||[]));if((data||[]).length<1000)break;}return out;};
const dlBlob=(name,blob)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);};

/* ───── toast filter (lets undo-wrappers replace the plain success toast) ───── */
const _toast=ui.toast;
ui.toast=function(m,t,a){const s=String(m||'');if(X.mute&&X.mute.test(s)){X.mute=null;return;}if(X.quiet&&X.quiet.test(s))return;return _toast.call(ui,m,t,a);};

/* ───── 13. roles ───── */
const ROLES={
  super:{l:'Super admin',d:'Everything, including settings, pricing, deleting and team roles.',can:['*']},
  moderator:{l:'Moderator',d:'Approve, reject and edit listings; verification, reports, reviews, suspensions, messages. No pricing, deletes, payments or team.',can:['listing.moderate','seller.suspend','verify','report','review','message','email']},
  support:{l:'Support',d:'Chat, concierge, enquiries, reviews and individual emails. Read-only elsewhere.',can:['message','email','review']},
  finance:{l:'Finance',d:'Payments, reconciliation, refunds, plans, revenue and data export. Read-only elsewhere.',can:['payment.confirm','plan.grant','refund.record','data.export','email']}
};
const role=()=>ROLES[S.me&&S.me.admin_role]?S.me.admin_role:'super';
const can=a=>{const c=ROLES[role()].can;return c.includes('*')||c.includes(a);};
const need=(a,fn)=>function(...args){if(!can(a))throw new Error(`Your role (${ROLES[role()].l}) can’t do this.`);return fn.apply(this,args);};
['approve','approveFlow','reject','rejectFlow','feature','unfeature','activate','deactivate','occupied','free','extend','recycle','recycleRaw','restore','edit','post'].forEach(k=>{if(LA[k])LA[k]=need('listing.moderate',LA[k]);});
LA.upgrade=need('payment.confirm',LA.upgrade);LA.del=need('listing.delete',LA.del);LA.cascade=need('listing.delete',LA.cascade);
confirmPayment=need('payment.confirm',confirmPayment);rejectPayment=need('payment.confirm',rejectPayment);
grantPlan=need('plan.grant',grantPlan);deleteSeller=need('seller.delete',deleteSeller);
suspendSeller=need('seller.suspend',suspendSeller);reinstateSeller=need('seller.suspend',reinstateSeller);
emailSeller=need('email',emailSeller);setReport=need('report',setReport);requestExtraDocs=need('verify',requestExtraDocs);

/* ───── 14. undo for suspend / reject / deactivate ───── */
const refreshNow=()=>{try{ui.active&&ui.active.reload&&ui.active.reload();}catch{}refreshBadges();};
const _sus=suspendSeller;
suspendSeller=async function(u){X.mute=/^Account suspended$/;let r;try{r=await _sus(u);}finally{X.mute=null;}
  if(r!==false)ui.toast('Account suspended','',{label:'Undo',fn:async()=>{try{await reinstateSeller(u);refreshNow();}catch(e){ui.toast(e.message,'err');}}});return r;};
const _rej=LA.rejectFlow;
LA.rejectFlow=async function(l){X.mute=/^Listing rejected$/;let r;try{r=await _rej(l);}finally{X.mute=null;}
  if(r!==false)ui.toast('Listing rejected','',{label:'Undo',fn:async()=>{try{await LA.set(l,{status:'pending',disabled_reason:null},'Rejection undone — back in the queue','undo_reject_listing');refreshNow();}catch(e){ui.toast(e.message,'err');}}});return r;};
const _deact=LA.deactivate;
LA.deactivate=async function(l){X.mute=/^Listing deactivated$/;let r;try{r=await _deact(l);}finally{X.mute=null;}
  if(r!==false)ui.toast('Listing deactivated','',{label:'Undo',fn:async()=>{try{await LA.activate(l);refreshNow();}catch(e){ui.toast(e.message,'err');}}});return r;};

/* ───── settings loader: SLA targets, reveal threshold, canned reasons (2, 4, 10) ───── */
async function loadX(){
  const{data}=await db.from('platform_settings').select('key,value');const m={};(data||[]).forEach(r=>m[r.key]=r.value);
  const n=(k,d)=>{const v=Number(m[k]);return m[k]!==undefined&&m[k]!==''&&isFinite(v)&&v>0?v:d;};
  X.sla_listing=n('sla_listing_hours',24);X.sla_payment=n('sla_payment_hours',12);X.sla_verification=n('sla_verification_hours',48);X.reveal_thr=n('reveal_alert_threshold',15);
  const r=String(m.rejection_reasons||'').split('\n').map(s=>s.trim()).filter(Boolean);
  REJ.length=0;REJ.push(...(r.length?r:REJ_DEF));
}
const _ls=loadSettings;
loadSettings=async function(){await _ls();try{await loadX();}catch(e){console.error(e);}};

/* ───── 12. email delivery log ───── */
const _nbe=notifyByEmail;
notifyByEmail=async function(type,payload,meta){
  const r=await _nbe(type,payload);
  try{db.from('email_log').insert({type,recipient:String((payload&&(payload.sellerEmail||payload.buyerEmail||payload.to||payload.email))||'admin team'),subject:(payload&&payload.subject)||null,status:r.ok?'sent':'failed',error:r.ok?null:String((r.body&&(r.body.error||(r.body.failedRecipients&&r.body.failedRecipients[0]&&r.body.failedRecipients[0].error)))||('HTTP '+r.status)).slice(0,300),payload:payload||{},resent_of:(meta&&meta.resentOf)||null,created_by:S.user?S.user.id:null}).then(()=>{},()=>{});}catch{}
  return r;
};

/* ───── 4. stale-listing tab + 1. saved views / my queue ───── */
const _lt=listingTab;
listingTab=function(q,tab){if(tab==='stale')return q.eq('status','pending').lte('created_at',new Date(Date.now()-X.sla_listing*36e5).toISOString());return _lt(q,tab);};

const svKey=()=>'nk-views-'+(S.user?S.user.id:'');
const svGet=()=>{try{const v=JSON.parse(localStorage.getItem(svKey())||'null');return Array.isArray(v)?v:[{n:'Pending past SLA',h:'#/listings?tab=stale'}];}catch{return[];}};
const svSet=v=>localStorage.setItem(svKey(),JSON.stringify(v));
function paintSaved(){
  const nav=$('#sb nav');if(!nav)return;let g=$('#svg',nav);
  if(!g){g=document.createElement('div');g.className='ng';g.id='svg';nav.insertBefore(g,nav.firstChild);}
  g.innerHTML=`<small>My work</small><a class="ni" href="#" data-myq>${icon('clock')}My queue<span class="n z" data-b="myq">0</span></a>${svGet().map((x,i)=>`<a class="ni ${x.h===location.hash?'on':''}" href="${esc(x.h)}">${icon('star',15)}<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.n)}</span><button type="button" class="btn ghost icon sm" data-rm="${i}" aria-label="Remove saved view" style="color:inherit;min-height:22px;width:22px">×</button></a>`).join('')}`;
  g.onclick=e=>{const rm=e.target.closest('[data-rm]');if(rm){e.preventDefault();const a=svGet();a.splice(+rm.dataset.rm,1);svSet(a);paintSaved();return;}if(e.target.closest('[data-myq]')){e.preventDefault();myQueue();}};
}
async function saveView(){
  const h=location.hash||'#/overview';
  const n=await ui.ask({title:'Save this view',message:'Pins this page, with its current tab, search and filters, to “My work” in the sidebar.',label:'Name',type:'text',value:($('#title')?$('#title').textContent:'View'),confirm:'Save view'});
  if(n===null)return;const a=svGet().filter(x=>x.h!==h);a.push({n,h});svSet(a);paintSaved();ui.toast('View saved to the sidebar','ok');
}
function topBtn(){
  const th=$('#theme');if(!th||$('#svb'))return;const b=document.createElement('button');b.id='svb';b.className='btn ghost icon';b.title='Save this view to the sidebar';b.setAttribute('aria-label','Save this view');b.innerHTML=icon('star',18);th.before(b);b.onclick=saveView;
}
window.addEventListener('hashchange',()=>{$$('#svg a.ni[href^="#/"]').forEach(a=>a.classList.toggle('on',a.getAttribute('href')===location.hash));});
async function myQueue(){
  const w=ui.open(`<div class="modal wide" role="dialog" aria-modal="true" aria-label="My queue"><div class="mh"><h3>My queue — most overdue first</h3><button class="btn ghost icon" data-x aria-label="Close">${icon('x')}</button></div><div class="mb" id="mq"><div class="sk"></div></div></div>`);
  const close=()=>{w.remove();document.removeEventListener('keydown',k,true);};
  const k=e=>{if(e.key==='Escape'&&w===ov().lastElementChild){e.stopPropagation();close();}};document.addEventListener('keydown',k,true);
  w.addEventListener('mousedown',e=>{if(e.target===w)close();});w.addEventListener('click',e=>{if(e.target.closest('[data-x]'))close();});
  const[l,p,v]=await Promise.all([db.from('listings').select('id,title,created_at,area').eq('status','pending').eq('recycle_bin',false).order('created_at').limit(40),db.from('payments').select('id,amount,reference,created_at').in('status',['pending','pending_verification']).order('created_at').limit(40),db.from('profiles').select('id,full_name,email,verification_submitted_at').eq('verification_status','pending').neq('role','admin').order('verification_submitted_at').limit(40)]);
  const items=[...(l.data||[]).map(x=>({t:'Listing',n:x.title+(x.area?' — '+x.area:''),at:x.created_at,sla:X.sla_listing,go:()=>go('listings',{tab:'pending',q:x.title})})),
    ...(p.data||[]).map(x=>({t:'Payment',n:`${KES(x.amount)} · ${x.reference||'no reference'}`,at:x.created_at,sla:X.sla_payment,go:()=>go('payments',{tab:'pending',q:x.reference||''})})),
    ...(v.data||[]).map(x=>({t:'Verification',n:x.full_name||x.email||'Seller',at:x.verification_submitted_at,sla:X.sla_verification,go:()=>go('verification',{q:x.email||''})}))].sort((a,b)=>hrs(b.at)/b.sla-hrs(a.at)/a.sla);
  const box=$('#mq',w);if(!box)return;
  box.innerHTML=items.length?items.map((x,i)=>`<div class="row" style="cursor:pointer" data-i="${i}"><span>${bd(x.t,'info')} ${esc(x.n)}</span>${slaBadge(x.at,x.sla)}</div>`).join(''):'<div class="empty"><h4>Queue is clear ✓</h4><p>Nothing is waiting on you.</p></div>';
  box.onclick=e=>{const r=e.target.closest('[data-i]');if(r){close();items[+r.dataset.i].go();}};
}

/* ───── 8. seller risk score ───── */
async function addRisk(rows){
  if(!rows.length)return rows;
  const ids=rows.map(r=>r.id),ls=await inChunks('listings','id,seller_id,title,area,status','seller_id',ids),lid=ls.map(l=>l.id).slice(0,400);
  const[rs,rl,sus]=await Promise.all([inChunks('reports','target_id','target_id',ids,q=>q.eq('target_type','seller')).catch(()=>[]),lid.length?inChunks('reports','target_id','target_id',lid,q=>q.eq('target_type','listing')).catch(()=>[]):[],inChunks('admin_logs','target_id','target_id',ids.map(String),q=>q.eq('action','suspend_profile')).catch(()=>[])]);
  const L={},rep={},rej={},dup={},sn={},seen={};ls.forEach(l=>L[l.id]=l);
  rs.forEach(r=>rep[r.target_id]=(rep[r.target_id]||0)+1);
  rl.forEach(r=>{const s=L[r.target_id]&&L[r.target_id].seller_id;if(s)rep[s]=(rep[s]||0)+1;});
  sus.forEach(r=>sn[r.target_id]=(sn[r.target_id]||0)+1);
  ls.forEach(l=>{if(l.status==='rejected')rej[l.seller_id]=(rej[l.seller_id]||0)+1;const k=l.seller_id+'|'+(l.title||'').trim().toLowerCase()+'|'+(l.area||'');if(seen[k])dup[l.seller_id]=(dup[l.seller_id]||0)+1;else seen[k]=1;});
  rows.forEach(u=>{
    const c={reports:rep[u.id]||0,rejected:rej[u.id]||0,dups:dup[u.id]||0,susp:sn[u.id]||0},age=(Date.now()-new Date(u.created_at).getTime())/864e5;
    let s=Math.min(45,c.reports*15)+Math.min(24,c.rejected*8)+Math.min(20,c.dups*10)+Math.min(20,c.susp*20)+(u.is_disabled?15:0)+(age<7?10:age<30?5:0)-(u.verification_status==='verified'?15:0);
    u._risk={s:Math.max(0,Math.min(100,s)),c,age:Math.round(age)};
  });
  return rows;
}
const riskCell=u=>{const r=u._risk;if(!r)return'—';const tone=r.s>=60?'bad':r.s>=30?'warn':'ok',tip=`Reports ${r.c.reports} · Rejected ${r.c.rejected} · Duplicates ${r.c.dups} · Suspensions ${r.c.susp} · Account ${r.age}d old`;return `<span class="bd ${tone}" title="${esc(tip)}">Risk ${r.s}</span>`;};

/* ───── 3. duplicate and fraud flags (review queue) ───── */
function aHash(url){return new Promise(res=>{const im=new Image();im.crossOrigin='anonymous';const to=setTimeout(()=>res(null),8000);
  im.onload=()=>{clearTimeout(to);try{const c=document.createElement('canvas');c.width=c.height=8;const g=c.getContext('2d');g.drawImage(im,0,0,8,8);const d=g.getImageData(0,0,8,8).data,gr=[];for(let i=0;i<64;i++)gr.push(d[i*4]*.299+d[i*4+1]*.587+d[i*4+2]*.114);const m=gr.reduce((a,b)=>a+b,0)/64;let bits='';gr.forEach(v=>bits+=v>m?'1':'0');let hex='';for(let i=0;i<64;i+=4)hex+=parseInt(bits.slice(i,i+4),2).toString(16);res(/^(0+|f+)$/.test(hex)?null:hex);}catch{res(null);}};
  im.onerror=()=>{clearTimeout(to);res(null);};im.src=url;});}
async function photoDup(l){
  const hs=[];for(const p of (l.listing_photos||[]).slice(0,6)){let h=p.phash;if(!h){h=await aHash(p.url);if(h){p.phash=h;db.from('listing_photos').update({phash:h}).eq('id',p.id).then(()=>{},()=>{});}}if(h)hs.push(h);}
  if(!hs.length)return[];
  const{data,error}=await db.from('listing_photos').select('listing_id,listings(title,status,profiles(full_name,is_disabled))').in('phash',[...new Set(hs)]).neq('listing_id',l.id).limit(10);
  if(error)return[];const seen=new Set();
  return(data||[]).filter(x=>x.listings&&!seen.has(x.listing_id)&&seen.add(x.listing_id)).map(x=>`Photo matches “${x.listings.title}” (${x.listings.status}) — ${(x.listings.profiles&&x.listings.profiles.full_name)||'another seller'}${x.listings.profiles&&x.listings.profiles.is_disabled?' · SUSPENDED seller':''}`);
}
async function fraudPanel(l,w,still){
  const flags=[],ids=new Set(),pr=l.profiles||{},sid=l.seller_id,qs=[];
  const lf=(q,t,label)=>q.then(r=>(r.data||[]).forEach(x=>{if(ids.has(x.id))return;ids.add(x.id);flags.push({t:(x.profiles&&x.profiles.is_disabled)?'bad':t,m:`${label} “${x.title}” (${x.status}) — ${(x.profiles&&x.profiles.full_name)||'another seller'}${x.profiles&&x.profiles.is_disabled?' · SUSPENDED seller':''}`});}));
  const sel='id,title,status,profiles(full_name,is_disabled)';
  qs.push(lf(db.from('listings').select(sel).neq('id',l.id).eq('title',l.title).limit(5),'bad','Same title as'));
  if(l.area&&l.price!=null)qs.push(lf(db.from('listings').select(sel).neq('id',l.id).eq('area',l.area).eq('price',l.price).eq('category',l.category).limit(5),'warn','Same area, price and category as'));
  const p9=n=>String(n||'').replace(/\D/g,'').slice(-9),mine=p9(pr.phone);
  if(mine.length===9&&sid)qs.push(db.from('profiles').select('id,full_name,is_disabled').neq('id',sid).ilike('phone','%'+mine).limit(5).then(r=>(r.data||[]).forEach(x=>flags.push({t:x.is_disabled?'bad':'warn',m:`Seller phone is also used by ${x.full_name||'another account'}${x.is_disabled?' (SUSPENDED)':''}`}))));
  const nums=[...new Set((((l.description||'')+' '+(l.title||'')).match(/(?:\+?254|0)[\s-]?[17](?:[\s-]?\d){8}/g)||[]).map(p9))].filter(x=>x.length===9&&x!==mine).slice(0,3);
  nums.forEach(n=>qs.push(db.from('profiles').select('id,full_name,is_disabled').ilike('phone','%'+n).limit(3).then(r=>(r.data||[]).forEach(x=>flags.push({t:x.is_disabled?'bad':'warn',m:`A number in the listing text (${n.slice(0,3)}…${n.slice(-3)}) belongs to ${x.full_name||'another account'}${x.is_disabled?' (SUSPENDED)':''}`})))));
  if(sid){
    qs.push(db.from('listings').select('id',{count:'exact',head:true}).eq('seller_id',sid).eq('status','rejected').then(r=>{if((r.count||0)>=2)flags.push({t:'warn',m:`Seller has ${r.count} previously rejected listings`});}));
    qs.push(db.from('admin_logs').select('id',{count:'exact',head:true}).eq('target_id',String(sid)).eq('action','suspend_profile').then(r=>{if(r.count)flags.push({t:'bad',m:'This seller has been suspended before'});}));
  }
  qs.push(photoDup(l).then(m=>m.forEach(x=>flags.push({t:'bad',m:x}))));
  await Promise.all(qs.map(p=>p.catch(()=>{})));
  if(!still())return;const host=$('#rqb',w)&&$('#rqb',w).lastElementChild;if(!host)return;
  const old=$('#rqf',host);if(old)old.remove();
  const el=document.createElement('div');el.id='rqf';el.style.marginBottom='12px';
  el.innerHTML=flags.length?flags.map(f=>`<div style="background:var(--${f.t==='bad'?'redl':'goldl'});color:var(--${f.t==='bad'?'red':'gold'});padding:8px 10px;border-radius:8px;margin-bottom:6px;font-weight:600">⚠ ${esc(f.m)}</div>`).join(''):'<small style="color:var(--g)">✓ No duplicate or fraud flags found</small>';
  host.prepend(el);
}
window.__nkFraudPanel=fraudPanel;

/* ───── table patches: SLA columns, risk, timeline, role guards ───── */
const guardActs=(cfg,perm,pick)=>{const oa=cfg.actions;cfg.actions=r=>oa(r).map(a=>a.fn&&(!pick||pick(a))?{...a,fn:need(perm,a.fn)}:a);};
const guardBulk=(cfg,perm)=>{if(cfg.bulk)cfg.bulk=cfg.bulk.map(b=>({...b,fn:need(perm,b.fn)}));};
function patch(cfg){
  const after=(label,col)=>{const i=cfg.columns.findIndex(c=>c.label===label);cfg.columns.splice(i<0?cfg.columns.length:i+1,0,col);};
  const PEND=['pending','pending_verification'];
  if(cfg.route==='listings'){
    cfg.tabs.splice(2,0,{id:'stale',label:'Past SLA'});
    const oc=cfg.tabCounts;cfg.tabCounts=async st=>{const c=await oc(st);const r=await listingTab(db.from('listings').select('id',{count:'exact',head:true}).eq('recycle_bin',false),'stale');c.stale=r.count||0;return c;};
    cfg.columns.push({label:'SLA',render:l=>slaBadge(l.status==='pending'?l.created_at:null,X.sla_listing)});
    cfg.rowClass=l=>l.status==='pending'&&hrs(l.created_at)>X.sla_listing?'urgent':'';
    guardBulk(cfg,'listing.moderate');
  }else if(cfg.route==='payments'){
    after('Status',{label:'Waiting',render:r=>slaBadge(PEND.includes(r.status)?r.created_at:null,X.sla_payment)});
    cfg.rowClass=r=>PEND.includes(r.status)&&hrs(r.created_at)>X.sla_payment?'urgent':'';
    const oa=cfg.actions;cfg.actions=r=>[...oa(r).map(a=>a.fn?{...a,fn:need('payment.confirm',a.fn)}:a),{label:'Record refund / credit',hide:r.status!=='confirmed',fn:need('refund.record',()=>adjustForm({payment:r}))}];
  }else if(cfg.route==='verification'){
    cfg.columns.push({label:'Waiting',render:u=>slaBadge(u.verification_status==='pending'?u.verification_submitted_at:null,X.sla_verification)});
    cfg.rowClass=u=>u.verification_status==='pending'&&hrs(u.verification_submitted_at)>X.sla_verification?'urgent':'';
    guardActs(cfg,'verify');
  }else if(cfg.route==='sellers'){
    const i=cfg.columns.findIndex(c=>c.label==='Chat');cfg.columns.splice(i<0?cfg.columns.length:i,0,{label:'Risk',render:riskCell});
    const of=cfg.fetch;cfg.fetch=async st=>{const r=await of(st);try{r.rows=await addRisk(r.rows);}catch(e){console.error(e);}return r;};
    const oa=cfg.actions;cfg.actions=u=>{const a=oa(u);a.splice(2,0,{label:'Timeline',primary:true,fn:()=>{go('seller',{id:u.id});return false;}});return a;};
    guardBulk(cfg,'seller.suspend');
  }else if(cfg.route==='premium'){guardActs(cfg,'plan.grant',a=>!/^(Message|Open)/.test(a.label));}
  else if(cfg.route==='reports'){guardActs(cfg,'report',a=>!/^Review/.test(a.label));guardBulk(cfg,'report');}
  else if(cfg.route==='reviews'){guardActs(cfg,'review');}
}
const _Table=Table;
Table=function(cfg){try{patch(cfg);}catch(e){console.error(e);}return _Table(cfg);};

/* ───── 2, 4, 10. Settings card: reasons, SLA targets, reveal threshold ───── */
const _sm=VIEWS.settings.mount;
VIEWS.settings.mount=async function(el,...a){
  await _sm.call(this,el,...a);const host=$('#sv',el);if(!host)return;
  const card=document.createElement('div');card.className='card';card.style.cssText='padding:18px;margin-bottom:16px';
  card.innerHTML=`<h3>Admin workflow</h3><p class="intro" style="margin:2px 0 12px"><small>Canned reasons, waiting-time targets and alert thresholds. Saved on their own button, separate from pricing.</small></p>
  <div class="fld"><label for="x_rr">Canned rejection reasons <small>one per line — they appear as one-click chips in every reject box</small></label><textarea class="in" id="x_rr" rows="7">${esc(REJ.join('\n'))}</textarea></div>
  <div class="g2"><div class="fld"><label for="x_s1">Listing SLA (hours)</label><input class="in" type="number" min="1" id="x_s1" value="${X.sla_listing}"></div><div class="fld"><label for="x_s2">Payment SLA (hours)</label><input class="in" type="number" min="1" id="x_s2" value="${X.sla_payment}"></div><div class="fld"><label for="x_s3">Verification SLA (hours)</label><input class="in" type="number" min="1" id="x_s3" value="${X.sla_verification}"></div><div class="fld"><label for="x_s4">Contact-reveal alert (reveals per 24h)</label><input class="in" type="number" min="1" id="x_s4" value="${X.reveal_thr}"></div></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" id="x_sv" type="button">Save workflow settings</button><button class="btn" id="x_df" type="button">Reset reasons to defaults</button><button class="btn" id="x_nt" type="button">Enable desktop alerts</button></div>`;
  host.before(card);
  $('#x_df',card).onclick=()=>{$('#x_rr',card).value=REJ_DEF.join('\n');};
  $('#x_nt',card).onclick=async()=>{if(!('Notification' in window))return ui.toast('This browser does not support desktop alerts','err');const r=await Notification.requestPermission();ui.toast(r==='granted'?'Desktop alerts enabled':'Desktop alerts were not allowed',r==='granted'?'ok':'err');};
  $('#x_sv',card).onclick=async()=>{
    const v=i=>Math.max(1,Math.round(Number($('#x_s'+i,card).value)||0));
    const reasons=$('#x_rr',card).value.split('\n').map(s=>s.trim()).filter(Boolean).join('\n'),now=new Date().toISOString();
    const rows=[['rejection_reasons',reasons],['sla_listing_hours',v(1)],['sla_payment_hours',v(2)],['sla_verification_hours',v(3)],['reveal_alert_threshold',v(4)]].map(([key,value])=>({key,value:String(value),updated_at:now,updated_by:S.user.id}));
    const{error}=await db.from('platform_settings').upsert(rows,{onConflict:'key'});if(error)return ui.toast('Could not save: '+error.message,'err');
    logAction('update_settings','settings','workflow','reasons, SLA and alert settings');await loadX();ui.toast('Workflow settings saved','ok');
  };
};

/* ───── dashboard: past-SLA card ───── */
const _om=VIEWS.overview.mount;
VIEWS.overview.mount=async function(el,...a){
  await _om.call(this,el,...a);
  try{
    const iso=h=>new Date(Date.now()-h*36e5).toISOString(),c=async(t,f)=>(await f(db.from(t).select('id',{count:'exact',head:true}))).count||0;
    const[l,p,v]=await Promise.all([c('listings',q=>q.eq('status','pending').eq('recycle_bin',false).lte('created_at',iso(X.sla_listing))),c('payments',q=>q.in('status',['pending','pending_verification']).lte('created_at',iso(X.sla_payment))),c('profiles',q=>q.neq('role','admin').eq('verification_status','pending').lte('verification_submitted_at',iso(X.sla_verification)))]);
    const d=document.createElement('div');d.className='card';d.style.cssText='padding:18px;margin-top:16px';
    const item=(n,t,h)=>`<a class="att ${n?'hot':''}" href="${h}"><b>${n}</b><span>${t}</span><i>›</i></a>`;
    d.innerHTML=`<h4 style="margin-bottom:10px">Past your targets</h4><div class="grid4" style="margin-bottom:0">${item(l,`Listings waiting over ${X.sla_listing}h`,'#/listings?tab=stale')}${item(p,`Payments waiting over ${X.sla_payment}h`,'#/payments?tab=pending')}${item(v,`Verifications waiting over ${X.sla_verification}h`,'#/verification')}</div>`;
    el.appendChild(d);
  }catch(e){console.error(e);}
};

/* ───── 5. payment reconciliation ───── */
const CODE=/\b(?=[A-Z0-9]*[A-Z])(?=[A-Z0-9]*\d)[A-Z0-9]{10}\b/;
const codeOf=ref=>{const m=String(ref||'').toUpperCase().match(CODE);return m?m[0]:String(ref||'').trim().toUpperCase();};
function parseStmt(text){
  const out=[];
  for(const line of String(text||'').split(/\r?\n/)){
    if(!line.trim())continue;const m=line.toUpperCase().match(CODE);if(!m)continue;
    const rest=line.replace(new RegExp(m[0],'i'),' ').replace(/\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}:\d{2}(:\d{2})?/g,' ');
    const nums=(rest.match(/\d[\d,]*(?:\.\d+)?/g)||[]).map(x=>parseFloat(x.replace(/,/g,''))).filter(n=>isFinite(n));
    out.push({code:m[0],nums,line:line.trim()});
  }
  return out;
}
window.__nkParseStmt=parseStmt;
VIEWS.reconcile={title:'Reconcile payments',async mount(el){
  el.innerHTML=`<div class="two" style="align-items:start"><div class="card" style="padding:18px"><h3 style="margin-bottom:6px">M-Pesa statement</h3><p class="intro"><small>Upload the statement as CSV/TXT (export from Excel if needed) or paste the rows. A row matches when its M-Pesa receipt code equals the payment reference and the amount appears on the same row.</small></p><input type="file" id="rf" accept=".csv,.txt,.tsv,text/plain,text/csv" class="in" style="margin-bottom:10px"><textarea class="in" id="rt2" rows="9" placeholder="Receipt No., Completion Time, Details, Status, Paid In, Withdrawn, Balance"></textarea><div style="margin-top:10px;display:flex;gap:8px"><button class="btn pri" id="rm" type="button">Match to pending payments</button><button class="btn" id="rc" type="button">Clear</button></div></div>
  <div class="card" style="padding:18px"><h3 style="margin-bottom:6px">What you get</h3><div class="row"><span>Exact match</span><span>code and amount agree — ticked for you</span></div><div class="row"><span>Amount differs</span><span>code found, amount not on the row</span></div><div class="row"><span>Already used</span><span>a confirmed payment has this code</span></div><div class="row"><span>Not in statement</span><span>pending payment with no matching row</span></div></div></div><div id="rr" style="margin-top:16px"></div>`;
  $('#rf',el).onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{$('#rt2',el).value=String(r.result||'');};r.readAsText(f);};
  $('#rc',el).onclick=()=>{$('#rt2',el).value='';$('#rf',el).value='';$('#rr',el).innerHTML='';};
  async function run(){
    const rows=parseStmt($('#rt2',el).value);if(!rows.length)return ui.toast('No M-Pesa receipt codes found in that text','err');
    const box=$('#rr',el);box.innerHTML='<div class="card empty"><div class="spin" style="margin:auto"></div></div>';
    const{data:P,error}=await db.from('payments').select('*, listings(title,seller_id)').in('status',['pending','pending_verification']).order('created_at').limit(1000);if(error)throw error;
    const stm={};rows.forEach(r=>{(stm[r.code]=stm[r.code]||r);});
    const codes=[...new Set((P||[]).map(p=>codeOf(p.reference||p.mpesa_ref)).filter(Boolean))];
    const used=codes.length?await inChunks('payments','id,reference','reference',codes,q=>q.eq('status','confirmed')).catch(()=>[]):[];
    const usedSet=new Set(used.map(x=>codeOf(x.reference)));const hit=new Set();
    const res=(P||[]).map(p=>{const c=codeOf(p.reference||p.mpesa_ref),s=stm[c];let k='missing';if(s){hit.add(c);k=usedSet.has(c)?'used':s.nums.some(n=>Math.abs(n-Number(p.amount))<0.005)?'exact':'amount';}return{p,c,s,k};});
    const extra=rows.filter(r=>!hit.has(r.code)).length,cnt=k=>res.filter(x=>x.k===k).length;
    const tone={exact:'ok',amount:'warn',used:'bad',missing:'mute'},lab={exact:'Exact match',amount:'Amount differs',used:'Already used',missing:'Not in statement'};
    box.innerHTML=`<div class="grid4"><div class="card kpi"><small>Exact matches</small><b>${cnt('exact')}</b></div><div class="card kpi"><small>Amount differs</small><b>${cnt('amount')}</b></div><div class="card kpi"><small>Already confirmed elsewhere</small><b>${cnt('used')}</b></div><div class="card kpi"><small>Pending, not in statement</small><b>${cnt('missing')}</b></div><div class="card kpi"><small>Statement rows with no pending payment</small><b>${extra}</b></div></div>
    <div class="card"><div class="tw"><table><thead><tr><th class="c-sel"><input type="checkbox" id="ra" checked aria-label="Select all exact matches"></th><th>Payment</th><th>Reference</th><th>Amount</th><th>Statement row</th><th>Result</th></tr></thead><tbody>${res.length?res.map((x,i)=>`<tr style="cursor:default"><td class="c-sel">${x.k==='exact'?`<input type="checkbox" data-s="${i}" checked aria-label="Select">`:''}</td><td>${esc((x.p.listings&&x.p.listings.title)||String(x.p.type||'—').replace(/_/g,' '))}</td><td><code>${esc(x.c||'—')}</code></td><td><b style="color:var(--tx)">${KES(x.p.amount)}</b></td><td><small style="display:block;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.s?x.s.line:'—')}</small></td><td>${bd(lab[x.k],tone[x.k])}</td></tr>`).join(''):'<tr><td colspan="6"><div class="empty"><h4>No pending payments</h4></div></td></tr>'}</tbody></table></div><div class="pager"><span id="rcn"></span><button class="btn pri" id="rok" type="button">Confirm selected</button></div></div>`;
    const sync=()=>{const n=$$('[data-s]:checked',box).length;$('#rcn',box).textContent=`${n} selected`;$('#rok',box).disabled=!n;};
    box.onchange=e=>{if(e.target.id==='ra')$$('[data-s]',box).forEach(c=>c.checked=e.target.checked);sync();};sync();
    $('#rok',box).onclick=async()=>{
      const sel=$$('[data-s]:checked',box).map(c=>res[+c.dataset.s]);if(!sel.length)return;
      if(!await ui.confirm({title:`Confirm ${sel.length} payment(s)?`,message:`Total <b>${KES(sel.reduce((s,x)=>s+Number(x.p.amount),0))}</b>. Each listing or plan goes live and the seller is notified. Only continue if the statement is genuine.`,confirm:'Confirm all'}))return;
      const b=$('#rok',box);b.disabled=true;let ok=0,bad=0;X.quiet=/^Payment confirmed$/;
      try{for(const x of sel){b.textContent=`Confirming ${ok+bad+1} of ${sel.length}…`;try{await confirmPayment(x.p);ok++;}catch(e){bad++;ui.toast(`${x.c}: ${e.message}`,'err');}}}finally{X.quiet=null;}
      logAction('reconcile_confirm','payment','multiple',`${ok} confirmed, ${bad} failed`);ui.toast(`${ok} confirmed${bad?`, ${bad} failed`:''}`,bad?'err':'ok');refreshBadges();run().catch(e=>ui.toast(e.message,'err'));
    };
  }
  $('#rm',el).onclick=()=>run().catch(e=>ui.toast(e.message,'err'));
}};

/* ───── 7. refund and credit log ───── */
async function adjustForm(pre){
  const p=pre&&pre.payment;
  const r=await ui.form({title:'Record refund / credit',wide:true,submit:'Record',intro:p?`Against payment <code>${esc(p.reference||'—')}</code> (${KES(p.amount)}). This is an audit entry — it does not move money.`:'This is an audit entry — it does not move money. Link it to a payment reference, a seller, or both.',fields:[
    {id:'kind',label:'Type',type:'select',value:'refund',options:[{v:'refund',l:'Refund — money returned to the seller'},{v:'credit',l:'Credit — applied to a future fee'}]},
    {id:'amount',label:'Amount (KES)',type:'number',value:p?p.amount:null,required:true},
    ...(p?[]:[{id:'ref',label:'Original M-Pesa reference (optional)',value:''},{id:'who',label:'Seller email or phone (if no reference)',value:''}]),
    {id:'reason',label:'Reason',type:'textarea',rows:3,required:true},{id:'method',label:'Refund method or credit note',value:'M-Pesa'},{id:'refref',label:'Refund transaction reference (optional)',value:''},
    {id:'notify',label:'Notify the seller in-app',type:'checkbox',value:true}]});
  if(!r)return false;
  if(!(r.amount>0))throw new Error('Enter an amount above zero');
  let pid=p?p.id:null,sid=p?(p.seller_id||(p.listings&&p.listings.seller_id)||null):null,orig=p?Number(p.amount):null,pref=p?(p.reference||null):null;
  if(!p&&r.ref){const{data}=await db.from('payments').select('id,amount,seller_id,reference,listings(seller_id)').eq('reference',r.ref.trim()).limit(1);const x=data&&data[0];if(!x)throw new Error('No payment found with that reference');pid=x.id;sid=x.seller_id||(x.listings&&x.listings.seller_id)||null;orig=Number(x.amount);pref=x.reference;}
  if(!sid&&r.who){const k=safe(r.who);const{data}=await db.from('profiles').select('id').or(`email.eq.${k},phone.eq.${k}`).limit(1);sid=data&&data[0]?data[0].id:null;if(!sid)throw new Error('No seller found with that email or phone');}
  if(!pid&&!sid)throw new Error('Link it to a payment reference or a seller');
  if(pid!=null&&r.kind==='refund'&&orig!=null){const{data:prev}=await db.from('payment_adjustments').select('amount').eq('payment_id',String(pid)).eq('kind','refund');const done=(prev||[]).reduce((s,x)=>s+Number(x.amount),0);if(done+r.amount>orig+0.001)throw new Error(`Refunds would total ${KES(done+r.amount)}, above the original ${KES(orig)}`);}
  const{error}=await db.from('payment_adjustments').insert({kind:r.kind,payment_id:pid!=null?String(pid):null,payment_ref:pref,seller_id:sid||null,amount:r.amount,reason:r.reason,method:r.method||null,reference:r.refref||null,created_by:S.user.id,created_by_name:(S.me&&S.me.full_name)||'Admin'});
  if(error)throw error;
  logAction('record_'+r.kind,'payment',pid!=null?pid:sid,`${KES(r.amount)} — ${r.reason}`);
  if(sid&&r.notify)notifyInApp(sid,'payment',r.kind==='refund'?'Refund recorded':'Credit recorded',`${r.kind==='refund'?'A refund':'A credit'} of ${KES(r.amount)} was recorded on your account: ${r.reason}`,'/dashboard.html');
  ui.toast(`${r.kind==='refund'?'Refund':'Credit'} recorded`,'ok');
}
VIEWS.refunds={title:'Refunds & credits',mount(el,p){
  return Table({route:'refunds',params:p,id:r=>r.id,sort:{key:'created_at',dir:'desc'},search:'Search reason or reference…',
    tabs:[{id:'all',label:'All'},{id:'refund',label:'Refunds'},{id:'credit',label:'Credits'}],
    async fetch(st){let q=db.from('payment_adjustments').select('*',{count:'exact'});if(st.tab!=='all')q=q.eq('kind',st.tab);const s=safe(st.q);if(s)q=q.or(`reason.ilike.%${s}%,reference.ilike.%${s}%,payment_ref.ilike.%${s}%,created_by_name.ilike.%${s}%`);
      const{data,error,count}=await q.order('created_at',{ascending:false}).range(st.page*st.size,st.page*st.size+st.size-1);if(error)throw error;
      const ids=[...new Set((data||[]).map(r=>r.seller_id).filter(Boolean))],ps=ids.length?await inChunks('profiles','id,full_name,email','id',ids):[];(data||[]).forEach(r=>r._s=ps.find(x=>x.id===r.seller_id));return{rows:data,count};},
    async header(){const d=await fetchAll(()=>db.from('payment_adjustments').select('kind,amount').order('id'));const s=k=>d.filter(x=>x.kind===k).reduce((a,x)=>a+Number(x.amount),0);return `<div class="grid4"><div class="card kpi"><small>Total refunded</small><b>${KES(s('refund'))}</b></div><div class="card kpi"><small>Total credits issued</small><b>${KES(s('credit'))}</b></div></div>`;},
    columns:[{label:'Date',sort:'created_at',render:r=>dtt(r.created_at)},{label:'Type',render:r=>bd(r.kind,r.kind==='refund'?'bad':'info')},{label:'Amount',render:r=>`<b style="color:var(--tx)">${KES(r.amount)}</b>`},{label:'Seller',nl:1,render:r=>r._s?`<b style="color:var(--tx)">${esc(r._s.full_name||'—')}</b><br><small>${esc(r._s.email||'')}</small>`:'—'},{label:'Payment ref',render:r=>`<code>${esc(r.payment_ref||'—')}</code>`},{label:'Reason',render:r=>`<span style="display:block;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.reason||'')}">${esc(r.reason||'—')}</span>`},{label:'Logged by',render:r=>esc(r.created_by_name||'—')}],
    toolbar:[{label:'+ Record refund / credit',cls:'pri',fn:async T=>{try{if(await adjustForm()!==false)T.reload();}catch(e){ui.toast(e.message,'err');}}}],
    csv:{name:'nyumba254-refunds-credits',headers:['Date','Type','Amount','Seller','Seller email','Payment ref','Method','Refund ref','Reason','Logged by'],row:r=>[r.created_at,r.kind,r.amount,r._s&&r._s.full_name,r._s&&r._s.email,r.payment_ref,r.method,r.reference,r.reason,r.created_by_name]},
    empty:['No refunds or credits logged','Entries are append-only so the history stays auditable.']
  }).mount(el);
}};

/* ───── 6. revenue dashboard ───── */
const TYPE_L={listing_fee:'Listing fees',featured_upgrade:'Featured upgrades',premium_subscription:'Premium',elite_subscription:'Elite',bnb_subscription:'BNB plans',bnb_property_renewal:'BNB renewals'};
VIEWS.revenue={title:'Revenue',async mount(el){
  el.innerHTML='<div class="card empty"><div class="spin" style="margin:auto"></div></div>';
  const pays=await fetchAll(()=>db.from('payments').select('amount,type,created_at,listings(county)').eq('status','confirmed').order('id'));
  const adj=await fetchAll(()=>db.from('payment_adjustments').select('kind,amount,created_at').order('id')).catch(()=>[]);
  const{data:subs}=await db.from('profiles').select('id,full_name,email,phone,subscription_tier,subscription_plan,subscription_expires_at,bnb_plan,bnb_expires_at').neq('role','admin').or('subscription_tier.neq.none,bnb_plan.not.is.null').limit(2000);
  const S_=subs||[],now=new Date(),mkey=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  const months=[];for(let i=11;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months.push({k:mkey(d),l:d.toLocaleString('en-KE',{month:'short'})+(d.getMonth()===0||i===11?' '+String(d.getFullYear()).slice(2):''),v:0,r:0});}
  const MI=Object.fromEntries(months.map((m,i)=>[m.k,i]));
  pays.forEach(p=>{const i=MI[mkey(new Date(p.created_at))];if(i!=null)months[i].v+=Number(p.amount);});
  adj.filter(a=>a.kind==='refund').forEach(a=>{const i=MI[mkey(new Date(a.created_at))];if(i!=null)months[i].r+=Number(a.amount);});
  const sum=a=>a.reduce((s,x)=>s+Number(x.amount),0),gross=sum(pays),refunded=sum(adj.filter(a=>a.kind==='refund')),thisM=months[11].v,lastM=months[10].v,chg=lastM?Math.round((thisM-lastM)/lastM*100):null;
  const exp=u=>{const rent=u.subscription_tier&&u.subscription_tier!=='none';const x=rent?u.subscription_expires_at:u.bnb_expires_at;return x?new Date(x):null;};
  const plan=u=>(u.subscription_tier&&u.subscription_tier!=='none'?(u.subscription_plan==='elite'?'Elite':'Premium')+' '+u.subscription_tier:'')+(u.bnb_plan?(u.subscription_tier&&u.subscription_tier!=='none'?' + ':'')+String(u.bnb_plan).replace(/_/g,' '):'');
  const dd=u=>{const e=exp(u);return e?Math.ceil((e-now)/864e5):null;};
  const active=S_.filter(u=>{const d=dd(u);return d===null||d>=0;}),due=S_.filter(u=>{const d=dd(u);return d!==null&&d>=0&&d<=14;}).sort((a,b)=>dd(a)-dd(b)),lapsed=S_.filter(u=>{const d=dd(u);return d!==null&&d<0&&d>=-30;}).sort((a,b)=>dd(b)-dd(a));
  const churn=active.length+lapsed.length?Math.round(lapsed.length/(active.length+lapsed.length)*100):0;
  el.innerHTML=`<div class="grid4"><div class="card kpi"><small>Revenue this month</small><b>${KES(thisM)}</b><small>${chg===null?'no previous month':(chg>=0?'▲ ':'▼ ')+Math.abs(chg)+'% vs last month'}</small></div><div class="card kpi"><small>Gross, all time</small><b>${KES(gross)}</b></div><div class="card kpi"><small>Refunded</small><b>${KES(refunded)}</b></div><div class="card kpi"><small>Net, all time</small><b>${KES(gross-refunded)}</b></div></div>
  <div class="card" style="padding:18px;margin-bottom:16px"><h4 style="margin-bottom:12px">Revenue by month <small>(last 12 months, gross)</small></h4><div id="rmc" style="display:flex;align-items:flex-end;gap:6px;height:200px"></div></div>
  <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px"><label for="rp">Period for the breakdowns</label><select class="in" id="rp" style="max-width:180px"><option value="3">Last 3 months</option><option value="6">Last 6 months</option><option value="12" selected>Last 12 months</option><option value="0">All time</option></select></div>
  <div class="two" style="margin-bottom:16px"><div class="card" style="padding:18px" id="rbp"></div><div class="card" style="padding:18px" id="rbc"></div></div>
  <div class="grid4"><div class="card kpi"><small>Active subscribers</small><b>${active.length}</b></div><div class="card kpi"><small>Renewals due in 14 days</small><b>${due.length}</b></div><div class="card kpi"><small>Lapsed in the last 30 days</small><b>${lapsed.length}</b></div><div class="card kpi"><small>30-day churn</small><b>${churn}%</b></div></div>
  <div class="two"><div class="card" style="padding:18px"><h4 style="margin-bottom:10px">Renewals due</h4><div id="rdue"></div></div><div class="card" style="padding:18px"><h4 style="margin-bottom:10px">Recently lapsed — win-back list</h4><div id="rlap"></div></div></div>`;
  const mx=Math.max(1,...months.map(m=>m.v));
  $('#rmc',el).innerHTML=months.map(m=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0"><small>${m.v?(m.v>=1000?Math.round(m.v/1000)+'k':Math.round(m.v)):''}</small><div title="${esc(m.l)}: ${KES(m.v)}" style="width:70%;max-width:38px;height:${Math.max(2,m.v/mx*140)}px;background:var(--g);border-radius:5px 5px 0 0"></div><small>${esc(m.l)}</small></div>`).join('');
  const bars=(rows,title)=>{const m=Math.max(1,...rows.map(r=>r[1]));return `<h4 style="margin-bottom:10px">${title}</h4>${rows.length?rows.map(([k,v])=>`<div style="margin-bottom:8px"><div class="row" style="border:0;padding:0"><span>${esc(k)}</span><b>${KES(v)}</b></div><div class="bar"><i style="width:${v/m*100}%"></i></div></div>`).join(''):'<small>No payments in this period</small>'}`;};
  const draw=()=>{const n=Number($('#rp',el).value),from=n?new Date(now.getFullYear(),now.getMonth()-(n-1),1):new Date(0),sel=pays.filter(p=>new Date(p.created_at)>=from),by={},co={};
    sel.forEach(p=>{const t=TYPE_L[p.type]||String(p.type||'Other').replace(/_/g,' ');by[t]=(by[t]||0)+Number(p.amount);const c=(p.listings&&p.listings.county)||'Plans (no county)';co[c]=(co[c]||0)+Number(p.amount);});
    $('#rbp',el).innerHTML=bars(Object.entries(by).sort((a,b)=>b[1]-a[1]),'By plan / payment type');$('#rbc',el).innerHTML=bars(Object.entries(co).sort((a,b)=>b[1]-a[1]).slice(0,10),'By county (top 10)');};
  $('#rp',el).onchange=draw;draw();
  const list=(arr)=>arr.length?arr.slice(0,25).map(u=>`<div class="row"><span><b style="color:var(--tx)">${esc(u.full_name||'—')}</b><br><small>${esc(plan(u))} · ${exp(u)?dt(exp(u)):'no expiry'}</small></span><span style="display:flex;gap:6px;align-items:center"><button class="btn sm" data-m="${u.id}" type="button">Message</button><button class="btn sm" data-t="${u.id}" type="button">Timeline</button></span></div>`).join(''):'<small>None</small>';
  $('#rdue',el).innerHTML=list(due);$('#rlap',el).innerHTML=list(lapsed);
  el.onclick=e=>{const m=e.target.closest('[data-m]'),t=e.target.closest('[data-t]');if(m)go('support',{seller:m.dataset.m});if(t)go('seller',{id:t.dataset.t});};
}};

/* ───── 9. seller timeline ───── */
VIEWS.seller={title:'Seller timeline',async mount(el,p,ctx){
  const id=p.id;if(!id){el.innerHTML='<div class="card empty"><h4>No seller selected</h4><p>Open a seller from the Sellers list and choose Timeline.</p></div>';return;}
  el.innerHTML='<div class="card empty"><div class="spin" style="margin:auto"></div></div>';
  const{data:u,error}=await db.from('profiles').select('*').eq('id',id).single();if(error||!u)throw new Error('Seller not found');
  const listings=await fetchAll(()=>db.from('listings').select('id,title,status,payment_status,price,price_type,area,created_at,is_disabled,disabled_reason').eq('seller_id',id).order('id'));
  const lids=listings.map(l=>l.id),LM=Object.fromEntries(listings.map(l=>[l.id,l])),L4=lids.slice(0,400);
  const sp=async pr=>{try{const r=await pr;return r.data||[];}catch{return[];}};
  const[pay,payL,adj,vlog,logP,logL,repS,repL,enq,sess]=await Promise.all([
    sp(db.from('payments').select('id,amount,type,status,reference,created_at,listing_id').eq('seller_id',id).limit(300)),
    L4.length?inChunks('payments','id,amount,type,status,reference,created_at,listing_id','listing_id',L4).catch(()=>[]):[],
    sp(db.from('payment_adjustments').select('*').eq('seller_id',id).limit(200)),
    sp(db.from('verification_activity_log').select('*').eq('seller_id',id).limit(100)),
    sp(db.from('admin_logs').select('*').eq('target_id',String(id)).limit(200)),
    L4.length?inChunks('admin_logs','*','target_id',L4.map(String)).catch(()=>[]):[],
    sp(db.from('reports').select('*').eq('target_type','seller').eq('target_id',id).limit(100)),
    L4.length?inChunks('reports','*','target_id',L4,q=>q.eq('target_type','listing')).catch(()=>[]):[],
    L4.length?inChunks('enquiries','id,listing_id,buyer_name,message,created_at','listing_id',L4.slice(0,200)).catch(()=>[]):[],
    sp(db.from('chat_sessions').select('id,topic').eq('seller_id',id).limit(50))]);
  const msgs=sess.length?await inChunks('chat_messages','id,session_id,sender,body,created_at','session_id',sess.map(s=>s.id)).catch(()=>[]):[];
  const ev=[];const add=(at,type,title,detail,tone)=>{if(at)ev.push({at,type,title,detail:detail||'',tone:tone||'mute'});};
  listings.forEach(l=>add(l.created_at,'Listing','Listing posted: '+l.title,`${priceOf({...l,listing_units:[]})} · ${l.area||'—'} · now ${l.is_disabled?'disabled':l.status}`,'info'));
  const seenP=new Set();[...pay,...payL].forEach(x=>{if(seenP.has(x.id))return;seenP.add(x.id);add(x.created_at,'Payment',`${KES(x.amount)} — ${String(x.type||'payment').replace(/_/g,' ')}`,`${x.status} · ref ${x.reference||'—'}${x.listing_id&&LM[x.listing_id]?' · '+LM[x.listing_id].title:''}`,x.status==='confirmed'?'ok':x.status==='rejected'?'bad':'warn');});
  adj.forEach(x=>add(x.created_at,'Payment',`${x.kind==='refund'?'Refund':'Credit'} recorded: ${KES(x.amount)}`,`${x.reason||''} · by ${x.created_by_name||'admin'}`,'bad'));
  enq.forEach(x=>add(x.created_at,'Message','Buyer enquiry'+(LM[x.listing_id]?' on '+LM[x.listing_id].title:''),`${x.buyer_name||'Buyer'}: ${String(x.message||'').slice(0,140)}`,'info'));
  msgs.forEach(x=>add(x.created_at,'Message',x.sender==='admin'?'Support reply sent':'Support message from seller',String(x.body||'').slice(0,160),'info'));
  [...repS,...repL].forEach(x=>add(x.created_at,'Report',`Report (${REASON[x.reason]||x.reason}) — ${x.status}`,`${x.details||''}${x.target_type==='listing'&&LM[x.target_id]?' · '+LM[x.target_id].title:''}`,'bad'));
  vlog.forEach(x=>add(x.created_at,'Verification',String(x.action||'').replace(/_/g,' '),x.detail,x.action==='approved'?'ok':x.action==='rejected'||x.action==='revoked'?'bad':'warn'));
  const seenL=new Set();[...logP,...logL].forEach(x=>{if(seenL.has(x.id))return;seenL.add(x.id);add(x.created_at,'Admin',String(x.action||'').replace(/_/g,' '),`${x.details||''} · ${x.admin_name||'admin'}${x.target_type==='listing'&&LM[x.target_id]?' · '+LM[x.target_id].title:''}`,'pur');});
  ev.sort((a,b)=>new Date(b.at)-new Date(a.at));
  try{await addRisk([u]);}catch{}
  const types=['All',...new Set(ev.map(e=>e.type))],paid=[...pay,...payL].filter((x,i,a)=>a.findIndex(y=>y.id===x.id)===i&&x.status==='confirmed').reduce((s,x)=>s+Number(x.amount),0);
  let flt='All',lim=150;
  const paintEv=()=>{const rows=ev.filter(e=>flt==='All'||e.type===flt).slice(0,lim);let day='';
    $('#tl',el).innerHTML=rows.length?rows.map(e=>{const d=dt(e.at),h=d!==day?(day=d,`<div class="sec">${esc(d)}</div>`):'';return h+`<div class="row"><span>${bd(e.type,e.tone)} <b style="color:var(--tx)">${esc(e.title)}</b>${e.detail?`<br><small>${esc(e.detail)}</small>`:''}</span><small>${new Date(e.at).toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'})}</small></div>`;}).join('')+(ev.filter(e=>flt==='All'||e.type===flt).length>lim?'<div style="text-align:center;margin-top:12px"><button class="btn" id="tmo" type="button">Show more</button></div>':''):'<div class="empty"><h4>No events</h4></div>';};
  const paint=()=>{el.innerHTML=`<div class="card" style="padding:18px;margin-bottom:16px"><div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><div class="av" style="width:44px;height:44px">${esc(initials(u.full_name))}</div><div style="flex:1;min-width:200px"><h3>${esc(u.full_name||'—')}</h3><small>${esc(u.email||'')}${u.phone?' · '+esc(u.phone):''} · joined ${dt(u.created_at)}</small><div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">${u.is_disabled?bd('suspended','bad'):bd('active','ok')}${bd(u.verification_status||'unverified')}${u.subscription_tier&&u.subscription_tier!=='none'?bd((u.subscription_plan==='elite'?'Elite ':'Premium ')+u.subscription_tier,'pur'):''}${riskCell(u)}</div></div><div style="display:flex;gap:8px;flex-wrap:wrap">${u.is_disabled?'<button class="btn ok" data-a="re" type="button">Reinstate</button>':'<button class="btn bad" data-a="su" type="button">Suspend</button>'}<button class="btn" data-a="em" type="button">Email</button><button class="btn" data-a="ms" type="button">Message</button><button class="btn" data-a="li" type="button">Listings</button></div></div></div>
    <div class="grid4"><div class="card kpi"><small>Listings</small><b>${listings.length}</b></div><div class="card kpi"><small>Confirmed payments</small><b>${KES(paid)}</b></div><div class="card kpi"><small>Reports against</small><b>${u._risk?u._risk.c.reports:0}</b></div><div class="card kpi"><small>Rejected listings</small><b>${u._risk?u._risk.c.rejected:0}</b></div></div>
    <div class="card" style="padding:18px"><div class="chips">${types.map(t=>`<button class="btn sm ${t===flt?'ok':''}" data-f="${esc(t)}" type="button">${esc(t)}${t==='All'?' ('+ev.length+')':' ('+ev.filter(e=>e.type===t).length+')'}</button>`).join('')}</div><div id="tl"></div></div>`;paintEv();};
  paint();
  el.onclick=async e=>{
    const f=e.target.closest('[data-f]');if(f){flt=f.dataset.f;lim=150;paintEv();$$('[data-f]',el).forEach(b=>b.classList.toggle('ok',b.dataset.f===flt));return;}
    if(e.target.id==='tmo'){lim+=150;paintEv();return;}
    const a=e.target.closest('[data-a]');if(!a)return;
    try{const k=a.dataset.a;
      if(k==='su'){if(await suspendSeller(u)!==false){VIEWS.seller.mount(el,p,ctx);}}
      else if(k==='re'){await reinstateSeller(u);VIEWS.seller.mount(el,p,ctx);}
      else if(k==='em')await emailSeller(u);else if(k==='ms')go('support',{seller:id});else if(k==='li')go('listings',{seller:id});
    }catch(err){ui.toast(err.message,'err');}
  };
}};

/* ───── 10. contact-reveal alerts (while the panel is open) ───── */
let revBusy=false;
const desk=(t,b)=>{try{if('Notification' in window&&Notification.permission==='granted')new Notification(t,{body:b});}catch{}};
async function revPoll(){
  if(revBusy)return;revBusy=true;
  try{
    const{data,error}=await db.rpc('get_contact_reveal_summary',{p_hours:24});if(error)throw error;
    const hot=(data||[]).filter(d=>d.reveals>=X.reveal_thr&&!d.is_blocked);X.revN=hot.length;
    let seen={};try{seen=JSON.parse(localStorage.getItem('nk-revseen')||'{}');}catch{}const now=Date.now();Object.keys(seen).forEach(k=>{if(now-seen[k]>864e5)delete seen[k];});
    const fresh=hot.filter(d=>!seen[d.device_id]);fresh.forEach(d=>seen[d.device_id]=now);localStorage.setItem('nk-revseen',JSON.stringify(seen));
    if(fresh.length){const m=`${fresh.length} device${fresh.length>1?'s':''} passed ${X.reveal_thr} contact reveals in 24h`;ui.toast(m,'err',{label:'Review',fn:()=>go('reveals')});desk('Contact-reveal alert',m);}
    const b=$('[data-b="reveals"]');if(b){b.textContent=X.revN>99?'99+':X.revN;b.classList.toggle('z',!X.revN);}
  }catch(e){console.error(e);}
  revBusy=false;
}
const _rb=refreshBadges;
refreshBadges=async function(){
  const b=await _rb();b.reveals=X.revN||0;b.myq=(b.pending||0)+(b.payments||0)+(b.verification||0);
  $$('[data-b]').forEach(el=>{const k=el.dataset.b;if(k==='reveals'||k==='myq'){const n=b[k]||0;el.textContent=n>99?'99+':n;el.classList.toggle('z',!n);}});
  return b;
};

/* ───── 11. segmented + scheduled broadcasts ───── */
async function audience(seg){
  const cols='id,full_name,email,is_disabled,verification_status,subscription_tier,subscription_plan,bnb_plan';
  let rows=await fetchAll(()=>{let q=db.from('profiles').select(cols).neq('role','admin');
    if(seg.base==='verified')q=q.eq('verification_status','verified');
    else if(seg.base==='premium')q=q.neq('subscription_tier','none');
    else if(seg.base==='elite')q=q.eq('subscription_plan','elite').neq('subscription_tier','none');
    else if(seg.base==='bnb')q=q.not('bnb_plan','is',null);
    return q.order('id');});
  rows=rows.filter(r=>!r.is_disabled);
  if(seg.base==='free')rows=rows.filter(r=>(!r.subscription_tier||r.subscription_tier==='none')&&!r.bnb_plan);
  if(seg.county||seg.category||seg.base==='active_listings'){
    const sids=new Set((await fetchAll(()=>{let q=db.from('listings').select('seller_id').eq('status','active').eq('recycle_bin',false);if(seg.county)q=q.eq('county',seg.county);if(seg.category)q=q.eq('category',seg.category);return q.order('id');})).map(x=>x.seller_id));
    rows=rows.filter(r=>sids.has(r.id));
  }
  return rows;
}
async function sendBroadcast(b,onProg){
  const rows=await audience(b.segment||{}),first=r=>(r.full_name||'there').split(' ')[0],fill=(t,r)=>String(t).replace(/\{name\}/gi,first(r));
  let sent=0,failed=0,inapp=0;
  if(b.send_inapp){for(let i=0;i<rows.length;i+=100){const{error}=await db.from('notifications').insert(rows.slice(i,i+100).map(r=>({seller_id:r.id,type:'platform_update',title:fill(b.title,r),body:fill(b.message,r).slice(0,500),link:b.link||null})));if(!error)inapp+=Math.min(100,rows.length-i);}}
  if(b.send_email){let k=0;for(const r of rows){k++;if(!r.email)continue;const url=b.link?(/^https?:/.test(b.link)?b.link:location.origin+b.link):'';const res=await notifyByEmail('admin_seller_notice',{audience:'seller',noticeType:'custom',subject:fill(b.title,r),message:fill(b.message,r)+(url?'\n\n'+url:''),sellerName:r.full_name,sellerEmail:r.email});res.ok?sent++:failed++;if(onProg)onProg(k,rows.length);await sleep(120);}}
  const row={title:b.title,message:b.message,link:b.link||null,category:'general',audience:(b.segment&&b.segment.base)||'all',recipient_count:rows.length,emails_sent:sent,emails_failed:failed,trigger_source:'manual',created_by:S.user.id};
  let r1=await db.from('platform_announcements').insert(row);if(r1.error){r1=await db.from('platform_announcements').insert({title:b.title,category:'general',audience:'all',recipient_count:rows.length,emails_sent:sent,emails_failed:failed,trigger_source:'manual'});}
  logAction('send_targeted_broadcast','announcement','segment',`${b.title} → ${rows.length} sellers`);
  return{recipients:rows.length,sent,failed,inapp};
}
async function runDue(){
  if(!can('broadcast.send'))return;
  try{
    const{data}=await db.from('scheduled_broadcasts').select('*').eq('status','scheduled').lte('send_at',new Date().toISOString()).limit(3);
    for(const b of data||[]){
      const{data:c}=await db.from('scheduled_broadcasts').update({status:'sending'}).eq('id',b.id).eq('status','scheduled').select();if(!c||!c.length)continue;
      try{const res=await sendBroadcast(b);await db.from('scheduled_broadcasts').update({status:'sent',sent_at:new Date().toISOString(),result:res}).eq('id',b.id);ui.toast(`Scheduled broadcast “${b.title}” sent to ${res.recipients} sellers`,'ok');}
      catch(e){await db.from('scheduled_broadcasts').update({status:'failed',result:{error:e.message}}).eq('id',b.id);ui.toast('Scheduled broadcast failed: '+e.message,'err');}
    }
  }catch(e){}
}
VIEWS.broadcasts={title:'Targeted broadcasts',async mount(el){
  el.innerHTML=`<div class="two" style="align-items:start"><div class="card" style="padding:18px">
  <div class="fld"><label for="bt">Title</label><input class="in" id="bt" maxlength="120"></div>
  <div class="fld"><label for="bm">Message <small>use {name} for the seller’s first name</small></label><textarea class="in" id="bm" rows="6" maxlength="2000"></textarea></div>
  <div class="fld"><label for="bl">Link (optional)</label><input class="in" id="bl" placeholder="/pricing.html or https://…"></div>
  <div class="g2"><div class="fld"><label for="ba">Who</label><select class="in" id="ba"><option value="all">All sellers</option><option value="verified">Verified sellers</option><option value="premium">Premium and Elite</option><option value="elite">Elite only</option><option value="bnb">BNB plan holders</option><option value="free">Sellers with no paid plan</option><option value="active_listings">Sellers with an active listing</option></select></div>
  <div class="fld"><label for="bco">County (active listings)</label><select class="in" id="bco"><option value="">Any county</option>${NK_COUNTIES.map(c=>`<option>${esc(c)}</option>`).join('')}</select></div></div>
  <div class="g2"><div class="fld"><label for="bca">Listing category</label><select class="in" id="bca"><option value="">Any category</option>${Object.entries(CAT).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('')}</select></div>
  <div class="fld"><label for="bw">Send at (optional)</label><input class="in" type="datetime-local" id="bw"><small>Leave empty to send now.</small></div></div>
  <label class="chk"><input type="checkbox" id="bi" checked> In-app notification</label><label class="chk"><input type="checkbox" id="be" checked> Email</label>
  <button class="btn pri" id="bs" type="button">Send</button> <small id="bc"></small></div>
  <div class="card" style="padding:18px"><h3 style="margin-bottom:6px">Scheduled and recent</h3><p class="intro"><small>Scheduled sends go out while any admin has this panel open (checked every minute).</small></p><div id="bq"></div></div></div>`;
  const seg=()=>({base:$('#ba',el).value,county:$('#bco',el).value||null,category:$('#bca',el).value||null});
  const count=debounce(async()=>{const c=$('#bc',el);if(!c)return;c.textContent='Counting…';try{c.textContent=`≈ ${(await audience(seg())).length} seller(s) match`;}catch{c.textContent='';}},300);
  ['ba','bco','bca'].forEach(i=>$('#'+i,el).onchange=count);count();
  async function list(){
    const{data,error}=await db.from('scheduled_broadcasts').select('*').order('send_at',{ascending:false}).limit(15);const q=$('#bq',el);if(!q)return;
    if(error){q.innerHTML='<small>Run the setup SQL to create the scheduled_broadcasts table.</small>';return;}
    const tone={scheduled:'warn',sending:'info',sent:'ok',failed:'bad',cancelled:'mute'};
    q.innerHTML=(data||[]).length?data.map(b=>`<div class="row"><span><b style="color:var(--tx)">${esc(b.title)}</b><br><small>${dtt(b.send_at)}${b.result&&b.result.recipients!=null?' · '+b.result.recipients+' sellers':''}</small></span><span style="display:flex;gap:8px;align-items:center">${bd(b.status,tone[b.status])}${b.status==='scheduled'?`<button class="btn sm bad" data-cx="${b.id}" type="button">Cancel</button>`:''}</span></div>`).join(''):'<small>Nothing scheduled yet</small>';
  }
  list();
  el.onclick=async e=>{const c=e.target.closest('[data-cx]');if(!c)return;await db.from('scheduled_broadcasts').update({status:'cancelled'}).eq('id',c.dataset.cx).eq('status','scheduled');ui.toast('Cancelled');list();};
  $('#bs',el).onclick=async()=>{
    try{
      const title=$('#bt',el).value.trim(),message=$('#bm',el).value.trim();if(!title||!message)return ui.toast('Title and message are required','err');
      if(!$('#bi',el).checked&&!$('#be',el).checked)return ui.toast('Pick at least one channel','err');
      if(/\[[^\]]+\]/.test(title+message)&&!await ui.confirm({title:'Placeholders still in the text',message:'Your message still contains [bracketed placeholders]. Send anyway?',confirm:'Send anyway',danger:true}))return;
      const b={title,message,link:$('#bl',el).value.trim()||null,segment:seg(),send_email:$('#be',el).checked,send_inapp:$('#bi',el).checked},when=$('#bw',el).value;
      const n=(await audience(b.segment)).length;if(!n)return ui.toast('No sellers match that audience','err');
      if(when){const at=new Date(when);if(!(at>new Date()))return ui.toast('Pick a time in the future','err');
        if(!await ui.confirm({title:`Schedule for ${n} seller(s)?`,message:`<b>${esc(title)}</b><br>Sends ${esc(at.toLocaleString('en-KE'))} (while an admin has the panel open).`,confirm:'Schedule'}))return;
        const{error}=await db.from('scheduled_broadcasts').insert({...b,send_at:at.toISOString(),status:'scheduled',created_by:S.user.id});if(error)throw error;
        logAction('schedule_broadcast','announcement','segment',title);ui.toast('Broadcast scheduled','ok');list();return;}
      if(!await ui.confirm({title:`Send to ${n} seller(s) now?`,message:`<b>${esc(title)}</b><br>This sends immediately and can’t be recalled.`,confirm:'Send now'}))return;
      const btn=$('#bs',el);btn.disabled=true;
      try{const r=await sendBroadcast(b,(k,t)=>{btn.textContent=`Sending ${k} of ${t}…`;});ui.toast(`Sent to ${r.recipients} sellers — ${r.sent} email(s) delivered${r.failed?`, ${r.failed} failed`:''}`,r.failed?'err':'ok');}
      finally{btn.disabled=false;btn.textContent='Send';}
    }catch(e){ui.toast(e.message,'err');}
  };
}};

/* ───── 12. email log view ───── */
VIEWS.emails={title:'Email log',mount(el,p){
  const resend=async r=>{const res=await notifyByEmail(r.type,r.payload||{},{resentOf:r.id});if(!res.ok)throw new Error('Resend failed: '+((res.body&&res.body.error)||'HTTP '+res.status));ui.toast('Email resent','ok');};
  return Table({route:'emails',params:p,id:r=>r.id,sort:{key:'created_at',dir:'desc'},search:'Search recipient, type or subject…',
    tabs:[{id:'all',label:'All'},{id:'failed',label:'Failed'},{id:'sent',label:'Sent'}],
    async fetch(st){let q=db.from('email_log').select('*',{count:'exact'});if(st.tab!=='all')q=q.eq('status',st.tab);const s=safe(st.q);if(s)q=q.or(`recipient.ilike.%${s}%,type.ilike.%${s}%,subject.ilike.%${s}%`);const{data,error,count}=await q.order('created_at',{ascending:false}).range(st.page*st.size,st.page*st.size+st.size-1);if(error)throw error;return{rows:data,count};},
    async tabCounts(){const c=f=>f(db.from('email_log').select('id',{count:'exact',head:true})).then(r=>r.count||0);const[a,b,s]=await Promise.all([c(q=>q),c(q=>q.eq('status','failed')),c(q=>q.eq('status','sent'))]);return{all:a,failed:b,sent:s};},
    columns:[{label:'When',sort:'created_at',render:r=>dtt(r.created_at)},{label:'Type',render:r=>esc(String(r.type||'').replace(/_/g,' '))},{label:'Recipient',nl:1,render:r=>esc(r.recipient||'—')},{label:'Subject',render:r=>`<span style="display:block;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.subject||'—')}</span>`},{label:'Status',render:r=>bd(r.status,r.status==='failed'?'bad':'ok')+(r.resent_of?' '+bd('resend','info'):'')},{label:'Error',render:r=>r.error?`<small title="${esc(r.error)}" style="display:block;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.error)}</small>`:'—'}],
    actions:r=>[{label:'Resend',primary:r.status==='failed',cls:'ok',fn:()=>resend(r)}],
    bulk:[{label:'Resend selected',fn:async rows=>{let ok=0;for(const r of rows){try{await resend(r);ok++;}catch(e){ui.toast(e.message,'err');}}ui.toast(`${ok} resent`,'ok');}}],
    csv:{name:'nyumba254-email-log',headers:['When','Type','Recipient','Subject','Status','Error'],row:r=>[r.created_at,r.type,r.recipient,r.subject,r.status,r.error]},
    empty:['No emails logged yet','Every email sent from this panel from now on is recorded here.']
  }).mount(el);
}};

/* ───── 13. team & roles ───── */
VIEWS.team={title:'Team & roles',mount(el,p){
  el.innerHTML=`<p class="intro">To add someone: open them under <b>Sellers → Manage profile</b>, set Role to Admin, then give them a role here. Admins without a role are treated as Super admins.</p><div class="grid4">${Object.values(ROLES).map(r=>`<div class="card kpi"><b style="font-size:16px">${esc(r.l)}</b><small>${esc(r.d)}</small></div>`).join('')}</div><div id="tm"></div>`;
  return Table({route:'team',params:p,id:r=>r.id,local:true,search:'Search admins…',
    async fetch(){const{data,error}=await db.from('profiles').select('id,full_name,email,phone,admin_role,created_at').eq('role','admin').order('created_at');if(error)throw error;return data;},
    searchText:u=>`${u.full_name} ${u.email}`,
    columns:[{label:'Admin',nl:1,render:u=>`<b style="color:var(--tx)">${esc(u.full_name||'—')}</b>${u.id===S.user.id?' '+bd('you','info'):''}<br><small>${esc(u.email||'')}</small>`},{label:'Role',render:u=>bd((ROLES[u.admin_role]||ROLES.super).l,(u.admin_role&&u.admin_role!=='super'&&ROLES[u.admin_role])?'info':'pur')},{label:'Joined',render:u=>dt(u.created_at)}],
    actions:u=>Object.entries(ROLES).map(([k,v])=>({label:'Set role: '+v.l,hide:(ROLES[u.admin_role]?u.admin_role:'super')===k,fn:need('team.manage',async()=>{
      if(u.id===S.user.id)throw new Error('You can’t change your own role — ask another Super admin.');
      const cur=ROLES[u.admin_role]?u.admin_role:'super';
      if(cur==='super'&&k!=='super'){const{data}=await db.from('profiles').select('id,admin_role').eq('role','admin');if((data||[]).filter(x=>(ROLES[x.admin_role]?x.admin_role:'super')==='super').length<=1)throw new Error('At least one Super admin is required.');}
      if(!await ui.confirm({title:`Make ${esc(u.full_name||'this admin')} a ${v.l}?`,message:esc(v.d),confirm:'Change role'}))return false;
      const{error}=await db.from('profiles').update({admin_role:k}).eq('id',u.id);if(error)throw error;logAction('set_admin_role','profile',u.id,k);ui.toast('Role updated','ok');})})),
    empty:['No admins found','Make a seller an admin first.']
  }).mount($('#tm',el));
}};
const _os=openSeller;
openSeller=function(u,T){_os(u,T);if(!can('team.manage')){const s=$('#p_r');if(s)s.disabled=true;}};

/* ───── 15 + 16. health panel and backup ───── */
async function pingFn(n){
  const url=`${EDGE}/${n}`;
  try{const r=await fetch(url,{method:'GET',headers:{apikey:SUPABASE_KEY}});if(r.status===404)throw new Error('Not deployed (404)');return{msg:`responding (HTTP ${r.status})`,warn:r.status>=500&&'HTTP '+r.status+' to an empty request — check function logs if sends fail'};}
  catch(e){if(/Not deployed/.test(e.message))throw e;try{await fetch(url,{method:'GET',mode:'no-cors'});return{msg:'reachable (status hidden by CORS)'};}catch{throw new Error('Unreachable — network or CORS failure');}}
}
async function health(quick){
  const out=[],jobs=[];
  const t=(g,n,fn,soft)=>jobs.push((async()=>{const s=performance.now();try{const d=await fn()||{};out.push({g,n,ok:d.warn?'warn':true,ms:Math.round(performance.now()-s),d:d.warn||d.msg||'OK'});}catch(e){out.push({g,n,ok:soft?'warn':false,ms:Math.round(performance.now()-s),d:(soft?'Run the setup SQL — ':'')+String(e.message||e).slice(0,160)});}})());
  t('Auth','Admin session',async()=>{const{data:{session}}=await db.auth.getSession();if(!session)throw new Error('No active session');return{msg:`token expires in ${Math.round((session.expires_at*1000-Date.now())/60000)} min (auto-refreshes)`};});
  ['listings','profiles','payments','platform_settings','admin_logs','reports','enquiries','messages','chat_sessions','notifications','listing_photos'].forEach(tb=>t('Tables',tb,async()=>{const{error}=await db.from(tb).select('*',{count:'exact',head:true});if(error)throw error;}));
  ['email_log','payment_adjustments','scheduled_broadcasts'].forEach(tb=>t('Extras',tb,async()=>{const{error}=await db.from(tb).select('*',{count:'exact',head:true});if(error)throw error;},true));
  t('Extras','profiles.admin_role',async()=>{const{error}=await db.from('profiles').select('admin_role').limit(1);if(error)throw error;},true);
  t('Extras','listing_photos.phash',async()=>{const{error}=await db.from('listing_photos').select('phash').limit(1);if(error)throw error;},true);
  t('RPC','get_sellers_with_stats',async()=>{const{error}=await db.rpc('get_sellers_with_stats',{p_search:null,p_limit:1,p_offset:0});if(error)throw error;});
  t('RPC','get_contact_reveal_summary',async()=>{const{error}=await db.rpc('get_contact_reveal_summary',{p_hours:1});if(error)throw error;});
  t('RPC','get_blocked_devices',async()=>{const{error}=await db.rpc('get_blocked_devices');if(error)throw error;});
  ['listing-photos','verification-docs'].forEach(b=>t('Storage',b,async()=>{const{error}=await db.storage.from(b).list('',{limit:1});if(error)throw error;}));
  if(!quick){
    ['send-notification-email','send-sms-alert','send-platform-announcement','social-post','admin-auth-actions'].forEach(n=>t('Edge functions',n,()=>pingFn(n)));
    t('Realtime','Subscription',()=>new Promise((res,rej)=>{const c=db.channel('hc-'+Date.now()),to=setTimeout(()=>{db.removeChannel(c);rej(new Error('Timed out after 5s'));},5000);c.subscribe(s=>{if(s==='SUBSCRIBED'){clearTimeout(to);db.removeChannel(c);res({msg:'connected'});}else if(s==='CHANNEL_ERROR'||s==='TIMED_OUT'){clearTimeout(to);db.removeChannel(c);rej(new Error(s));}});}));
  }
  await Promise.all(jobs);
  return out.sort((a,b)=>(a.g+a.n).localeCompare(b.g+b.n));
}
async function snapshot(tables,fmt,say){
  const stamp=new Date().toISOString().slice(0,10),all={exported_at:new Date().toISOString(),tables:{}};
  for(const tb of tables){
    say(`Fetching ${tb}…`);const rows=await fetchAll(()=>db.from(tb).select('*').order(tb==='platform_settings'?'key':'id'));
    if(fmt==='json')all.tables[tb]=rows;
    else if(rows.length){const heads=[...new Set(rows.flatMap(r=>Object.keys(r)))];csvDownload(`nyumba254-${tb}-${stamp}.csv`,heads,rows.map(r=>heads.map(h=>{const v=r[h];return v&&typeof v==='object'?JSON.stringify(v):v;})));await sleep(400);}
  }
  if(fmt==='json')dlBlob(`nyumba254-backup-${stamp}.json`,new Blob([JSON.stringify(all)],{type:'application/json'}));
  logAction('snapshot_export','system','all',`${fmt}: ${tables.join(', ')}`);
}
VIEWS.health={title:'Health & backup',async mount(el,p,ctx){
  el.innerHTML=`<div class="card" style="padding:18px;margin-bottom:16px"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:6px"><h3 style="margin-right:auto">System health</h3><button class="btn pri" id="hr" type="button">Run all checks</button></div><p class="intro"><small>Edge functions get a harmless GET with no data. An error status to that is normal — only “Not deployed” and “Unreachable” are real problems. Items marked Extras need the setup SQL.</small></p><div class="tw"><table><thead><tr><th>Group</th><th>Check</th><th>Status</th><th>Time</th><th>Detail</th></tr></thead><tbody id="hb"><tr><td colspan="5"><small>Running…</small></td></tr></tbody></table></div></div>
  <div class="card" style="padding:18px;margin-bottom:16px"><h3 style="margin-bottom:6px">Backup</h3><p class="intro"><small>Downloads straight to your computer. The files contain personal data, so store them somewhere safe. JSON is one file; CSV is one file per table (your browser may ask to allow multiple downloads).</small></p>
  <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:10px">${[['listings','Listings'],['profiles','Sellers'],['payments','Payments'],['payment_adjustments','Refunds & credits'],['admin_logs','Activity log'],['platform_settings','Settings']].map(([k,l])=>`<label class="chk" style="margin:0"><input type="checkbox" data-t="${k}" ${k!=='admin_logs'?'checked':''}> ${l}</label>`).join('')}</div>
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><select class="in" id="bf" style="max-width:140px"><option value="json">JSON</option><option value="csv">CSV</option></select><button class="btn pri" id="bk" type="button">Download backup</button><small id="bs"></small></div></div>
  <div class="card" style="padding:18px"><h3 style="margin-bottom:6px">Photo fingerprints</h3><p class="intro"><small>Powers the duplicate-photo warning in the review queue. Photos are fingerprinted automatically when a listing is reviewed; this backfills older ones, 50 at a time.</small></p><button class="btn" id="fp" type="button">Fingerprint next 50 photos</button> <small id="fs"></small></div>`;
  const paint=rows=>{const tone={true:'ok',warn:'warn',false:'bad'},lab={true:'OK',warn:'Check',false:'Failing'};$('#hb',el).innerHTML=rows.map(r=>`<tr style="cursor:default"><td>${esc(r.g)}</td><td><code>${esc(r.n)}</code></td><td>${bd(lab[r.ok],tone[r.ok])}</td><td>${r.ms} ms</td><td><small>${esc(r.d)}</small></td></tr>`).join('');};
  const run=async()=>{const b=$('#hr',el);b.disabled=true;b.textContent='Checking…';try{paint(await health(false));}finally{b.disabled=false;b.textContent='Run all checks';}};
  $('#hr',el).onclick=run;run();
  $('#bk',el).onclick=async()=>{
    if(!can('data.export'))return ui.toast(`Your role (${ROLES[role()].l}) can’t export data.`,'err');
    const tbs=$$('[data-t]:checked',el).map(c=>c.dataset.t);if(!tbs.length)return ui.toast('Pick at least one table','err');
    const b=$('#bk',el);b.disabled=true;try{await snapshot(tbs,$('#bf',el).value,m=>{$('#bs',el).textContent=m;});$('#bs',el).textContent='Done ✓';}catch(e){ui.toast('Backup failed: '+e.message,'err');$('#bs',el).textContent='';}b.disabled=false;
  };
  $('#fp',el).onclick=async()=>{
    const b=$('#fp',el);b.disabled=true;
    try{const{data,error}=await db.from('listing_photos').select('id,url').is('phash',null).limit(50);if(error)throw error;let n=0;
      for(let i=0;i<(data||[]).length;i+=5){await Promise.all(data.slice(i,i+5).map(async ph=>{const h=await aHash(ph.url);if(h){await db.from('listing_photos').update({phash:h}).eq('id',ph.id);n++;}}));$('#fs',el).textContent=`${Math.min(i+5,data.length)} of ${data.length} checked…`;}
      const r=await db.from('listing_photos').select('id',{count:'exact',head:true}).is('phash',null);$('#fs',el).textContent=`${n} fingerprinted · ${r.count||0} photos still without one`;
    }catch(e){ui.toast(e.message,'err');}
    b.disabled=false;
  };
}};

/* ───── navigation, role-based visibility, shell hooks ───── */
NAV[1].i.push(['reconcile','Reconcile payments','card'],['refunds','Refunds & credits','card']);
NAV[4].i.unshift(['revenue','Revenue','chart']);
NAV[5].i.splice(1,0,['broadcasts','Targeted broadcasts','bell'],['emails','Email log','msg']);
NAV[5].i.push(['team','Team & roles','users'],['health','Health & backup','life']);
{const rv=NAV[3].i.find(i=>i[0]==='reveals');if(rv)rv[3]='reveals';}
const NAVNEED={reconcile:'payment.confirm',refunds:'refund.record',revenue:'payment.confirm',settings:'settings.edit',team:'team.manage',broadcasts:'broadcast.send',updates:'broadcast.send'};
Object.entries(NAVNEED).forEach(([id,perm])=>{const v=VIEWS[id];if(!v)return;const m=v.mount;v.mount=function(el,...a){if(!can(perm)){el.innerHTML='<div class="card empty"><h4>No access</h4><p>Your role doesn’t include this area. Ask a Super admin.</p></div>';return;}return m.call(this,el,...a);};});
let bgOn=false;
function bg(){
  if(bgOn)return;bgOn=true;revPoll();setInterval(revPoll,120000);setInterval(runDue,60000);runDue();
  setTimeout(async()=>{try{const r=await health(true),bad=r.filter(x=>x.ok===false);if(bad.length)ui.toast(`${bad.length} health check${bad.length>1?'s':''} failing: ${bad.slice(0,2).map(x=>x.n).join(', ')}${bad.length>2?'…':''}`,'err',{label:'View',fn:()=>go('health')});}catch(e){console.error(e);}},4000);
}
const _bs=buildShell;
buildShell=function(){
  _bs();
  Object.entries(NAVNEED).forEach(([id,perm])=>{if(!can(perm)){const a=$(`#sb .ni[data-v="${id}"]`);if(a)a.remove();}});
  const f=$('.sbf small');if(f)f.textContent=ROLES[role()].l;
  paintSaved();topBtn();setTimeout(bg,1500);
};
loadX().catch(()=>{});
})();
