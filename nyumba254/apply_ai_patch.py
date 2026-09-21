#!/usr/bin/env python3
"""Usage: python3 apply_ai_patch.py YOUR-FILE.html
Edits the file in place and saves a backup as YOUR-FILE.html.bak"""
import re, sys
import os, shutil
path = sys.argv[1]
if not os.path.exists(path) and os.path.exists(path + '.html'): path += '.html'
src = open(path, encoding='utf-8').read(); bad = []
def rep(o, n, name):
    global src
    if src.count(o) != 1: bad.append(name); return
    src = src.replace(o, n)
def rex(p, n, name):
    global src
    if len(re.findall(p, src, re.S)) != 1: bad.append(name); return
    src = re.sub(p, lambda m: n, src, flags=re.S)

rep('<button type="button" class="linkbtn" data-act="suggest-title">Suggest a title</button>',
    '<button type="button" class="linkbtn" id="ai-title-btn" data-act="ai-title">✨ Enhance with AI</button>', 'title btn')
rep('<div class="field-hint">Specific titles get more enquiries.</div>',
    '<div class="field-hint">Specific titles get more enquiries. Enhance with AI polishes yours using the details you entered.</div><div class="field-hint" id="ai-note-title"></div>', 'title note')
rep('<div class="field"><label for="description">Description <span class="req">*</span></label>',
    '<div class="field"><div class="row"><label for="description">Description <span class="req">*</span></label><button type="button" class="linkbtn" id="ai-desc-btn" data-act="ai-desc">✨ Enhance with AI</button></div>', 'desc btn')
rep('<div class="field-error" id="e-description" role="alert"></div>',
    '<div class="field-hint" id="ai-note-description"></div><div class="field-error" id="e-description" role="alert"></div>', 'desc note')
rex(r"case 'locate':.*?;break;", "case 'locate':useMyLocation();break;", 'locate case')
rep("case 'signin':signIn();break;", "case 'signin':signIn();break;case 'ai-title':aiEnhance('title');break;case 'ai-desc':aiEnhance('description');break;case 'ai-undo':aiUndo(t.dataset.f);break;", 'cases')

NEW = r"""/* ═══ AI ENHANCE ═══ */
const aiPrev={};let aiBusy=false;
function aiContext(){
  const g=group(),c={category:NK_CATEGORIES[S.cat].label,county:val('county')&&nkCountyLabel(val('county')),area:areaName(),listing_for:freq()==='once'?'sale':'rent'};
  const add=(k,v)=>{if(v!==''&&v!=null&&v!==undefined)c[k]=v};
  if(g==='standard'){add('bedrooms',val('std_bedrooms')==='0'?'Studio':val('std_bedrooms'));add('bathrooms',val('std_bathrooms'));add('floor_area_m2',val('std_size'));add('furnished',LABEL.furnished[val('std_furnished')]);add('parking',LABEL.parking[val('std_parking')]);add('security',LABEL.security[val('std_security')])}
  if(g==='airbnb'){add('guests',val('air_guests'));add('bedrooms',val('air_bedrooms'));add('bathrooms',val('air_bathrooms'))}
  if(g==='boarding'){add('residents',val('board_gender'));add('nearest_institution',val('board_institution'))}
  if(g==='commercial'){add('type',val('comm_type'));add('floor_area_m2',val('comm_size'));add('fit_out',val('comm_condition'))}
  c.amenities=[...NK_AMENITIES.filter(a=>S.amen.has(a.key)).map(a=>a.label),...S.custom];return c;
}
async function aiEnhance(kind){
  const id=kind==='title'?'title':'description',btn=$(kind==='title'?'ai-title-btn':'ai-desc-btn'),text=val(id);
  if(aiBusy)return;
  if(kind==='description'&&text.length<10)return toast('Write a few words about the property first, then tap Enhance with AI.','error');
  if(kind==='title'&&!text&&!val('county'))return toast('Choose the county and area first, or type a rough title.','error');
  if(navigator.onLine===false)return toast('You are offline. Try again when you have a connection.','error');
  aiBusy=true;const old=btn.textContent;btn.disabled=true;btn.textContent='Enhancing…';
  try{
    const r=await fetch(`${EDGE_URL}/enhance-listing-text`,{method:'POST',headers:{'Content-Type':'application/json',apikey:SUPABASE_KEY},body:JSON.stringify({kind,text,context:aiContext()})});
    const j=await r.json();if(!r.ok||!j.text)throw new Error(j.error||'failed');
    aiPrev[id]=$(id).value;$(id).value=j.text;fail(id,'');
    if(id==='description')$('desc-count').textContent=`${val('description').length} / 30 minimum`;
    $('ai-note-'+id).innerHTML=`Improved by AI. Please check the details are correct. <button type="button" class="linkbtn" data-act="ai-undo" data-f="${id}">Undo</button>`;
    saveDraft();
  }catch(e){toast(e.message==='rate_limited'?'Too many AI requests. Try again in a while.':"AI enhance isn't available right now. Your own text is kept.",'error')}
  finally{aiBusy=false;btn.disabled=false;btn.textContent=old}
}
function aiUndo(id){
  if(aiPrev[id]==null)return;$(id).value=aiPrev[id];delete aiPrev[id];$('ai-note-'+id).innerHTML='';
  if(id==='description')$('desc-count').textContent=`${val('description').length} / 30 minimum`;saveDraft();
}

/* ═══ USE MY LOCATION: county, area, address and map in one tap ═══ */
async function useMyLocation(){
  if(!navigator.geolocation)return toast('Location is not available on this device','error');
  toast('Finding your location…');
  navigator.geolocation.getCurrentPosition(async p=>{
    const lat=p.coords.latitude,lng=p.coords.longitude;let a={};
    try{const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=en&lat=${lat}&lon=${lng}`);a=(await r.json()).address||{}}catch(e){}
    const nc=s=>String(s||'').toLowerCase().replace(/\bcounty\b|\bcity\b/g,'').replace(/[^a-z]/g,'');
    let county=null;
    for(const f of [a.county,a.state,a.state_district,a.region,a.city]){if(!f)continue;county=NK_COUNTIES.find(c=>nc(c)&&nc(c)===nc(f));if(county)break}
    county=county||nkFindNearestCounty(lat,lng);
    if(!county)return toast('Could not work out your county. Please choose it manually.','error');
    $('county').value=county;fillAreas(county);
    const list=NK_AREAS_BY_COUNTY[county]||[],nk=s=>String(s).toLowerCase().replace(/\(.*?\)/g,'').replace(/[^a-z0-9]/g,'');
    const cands=[a.suburb,a.neighbourhood,a.quarter,a.city_district,a.residential,a.village,a.hamlet,a.town,a.city].filter(Boolean);
    let area=null;
    for(const c of cands){area=list.find(x=>nk(x)===nk(c));if(area)break}
    if(!area)for(const c of cands){area=list.find(x=>nk(x).length>4&&nk(c).length>4&&(nk(c).includes(nk(x))||nk(x).includes(nk(c))));if(area)break}
    if(area){$('area').value=area}
    else if(cands.length){$('area').value='__other__';areaChanged();$('area_custom').value=cands[0]}
    areaChanged();
    if(!val('address')){const road=a.road||a.pedestrian||a.footway||'',near=a.suburb||a.neighbourhood||'';
      const addr=[road,near&&near!==road?near:''].filter(Boolean).join(', ');if(addr)$('address').value=addr}
    ['county','area','area_custom','address'].forEach(i=>fail(i,''));
    if(map)map.setView([lat,lng],16);
    saveDraft();
    toast(`Filled ${[area||cands[0],nkCountyLabel(county)].filter(Boolean).join(', ')}. Please check it. Tap "Pin exact location here" if you're at the property.`,'success');
  },()=>toast('Could not get your location. You can choose the county and area manually.','error'),{enableHighAccuracy:true,timeout:10000});
}

"""
rep('function suggestTitle(){', NEW + 'function suggestTitle(){', 'insert js')
if bad:
    print('NOT WRITTEN. Anchors not found exactly once:'); [print(' -', b) for b in bad]; sys.exit(1)
shutil.copyfile(path, path + '.bak')
open(path, 'w', encoding='utf-8').write(src)
print('OK, updated', path, '(backup:', path + '.bak)')
