#!/usr/bin/env python3
"""Usage: python3 apply_post_listing_patch.py post-listing.html
Writes post-listing.patched.html. Aborts without writing if any anchor is missing."""
import re, sys
src = open(sys.argv[1], encoding='utf-8').read()
bad = []
def rep(old, new, name):
    global src
    if src.count(old) != 1:
        bad.append(name); return
    src = src.replace(old, new)
def rex(pat, new, name):
    global src
    if len(re.findall(pat, src, re.S)) != 1:
        bad.append(name); return
    src = re.sub(pat, lambda m: new, src, flags=re.S)

# ---------- PIN: optional, map follows address ----------
rex(r'<div class="field">\s*<label>Pin the location.*?id="e-pin" role="alert"></div>\s*</div>',
r"""<div class="field">
        <label>Exact pin <span class="opt">optional</span></label>
        <div class="field-hint" style="margin:-2px 0 8px">The map moves to your area as you fill in the address. Add an exact pin if you want buyers to find the property more easily. An exact pin is visible to everyone.</div>
        <div class="map-tools"><button type="button" class="btn-alt dark" data-act="drop-pin">Pin exact location here</button><button type="button" class="btn-alt" data-act="gps">Use my GPS (be at the property)</button></div>
        <div class="map-frame"><div id="location-map" role="application" aria-label="Map"></div></div>
        <div class="pin-status" id="pin-status"></div>
        <button type="button" class="linkbtn" id="clear-pin" data-act="clear-pin" hidden>Remove pin</button>
      </div>""", 'pin html')
rep(r"""const pinOk=!!S.pin;if(!pinOk){ok=false;if(!quiet)$('e-pin').textContent='Place the pin on the map so buyers can find the property'}else $('e-pin').textContent='';""", '', 'validate pin')

NEWMAP = r"""function setPin(lat,lng,zoom){
  S.pin={lat,lng};
  if(map){
    if(!marker){marker=L.marker([lat,lng],{draggable:true}).addTo(map);
      marker.on('dragend',()=>{const p=marker.getLatLng();S.pin={lat:p.lat,lng:p.lng};pinText();saveDraft()})}
    else marker.setLatLng([lat,lng]);
    if(zoom)map.setView([lat,lng],zoom);
  }
  pinText();saveDraft();
}
function pinText(){
  const e=$('pin-status');e.className='pin-status'+(S.pin?' ok':'');
  e.textContent=S.pin?`Exact pin set (${S.pin.lat.toFixed(5)}, ${S.pin.lng.toFixed(5)}). Drag it to fine-tune.`
    :'No exact pin. Buyers will see the approximate area. Move the map to the spot and tap "Pin exact location here".';
  $('clear-pin').hidden=!S.pin;
}
function clearPin(){S.pin=null;if(marker){marker.remove();marker=null}pinText();saveDraft()}
function dropPin(){
  if(!map)return toast('The map is not available. Use GPS instead.','error');
  const c=map.getCenter();setPin(c.lat,c.lng,Math.max(map.getZoom(),16));toast('Pin placed. Drag it to the exact spot.','success');
}
function initMap(){
  if(!window.L){$('location-map').innerHTML='<p style="padding:24px;font-size:13px;color:var(--text-3);text-align:center">The map could not load. You can still continue; buyers will see the approximate area.</p>';pinText();return}
  map=L.map('location-map',{scrollWheelZoom:false}).setView([-0.5,37.5],6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:19}).addTo(map);
  map.on('click',e=>setPin(e.latlng.lat,e.latlng.lng));
  pinText();
}
/* map follows the address; never moves under a seller who already pinned */
const geoCache=new Map();let geoSeq=0;
async function geocodeQuery(q){
  if(geoCache.has(q))return geoCache.get(q);
  const r=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ke&q='+encodeURIComponent(q));
  const j=await r.json(),hit=j&&j[0]?{lat:parseFloat(j[0].lat),lng:parseFloat(j[0].lon)}:null;
  geoCache.set(q,hit);return hit;
}
async function areaCentroid(county,area){
  try{const {data}=await db.from('area_centroids').select('lat,lng').eq('county',county).eq('area',area).maybeSingle();
    if(data)return {lat:Number(data.lat),lng:Number(data.lng)}}catch(e){}return null;
}
async function followAddress(){
  if(!map||S.pin)return;
  const county=val('county'),area=areaName(),addr=val('address');if(!county)return;
  const seq=++geoSeq;let hit=null,zoom=10;
  try{
    if(addr.length>2){hit=await geocodeQuery([addr,area,county,'Kenya'].filter(Boolean).join(', '));if(hit)zoom=16}
    if(!hit&&area){hit=await areaCentroid(county,area)||await geocodeQuery(`${area}, ${county}, Kenya`);if(hit)zoom=14}
  }catch(e){}
  if(seq!==geoSeq||S.pin)return;
  if(hit)map.setView([hit.lat,hit.lng],zoom);
  else{const c=NK_COUNTY_COORDS[county];if(c)map.setView(c,10)}
}
const followSoon=nkDebounce(followAddress,900);
"""
rex(r'function setPin\(.*?(?=function gps\(\))', NEWMAP, 'map functions')
rex(r'async function geocode\(\)\{.*?\n\}\n(?=function suggestTitle)', '', 'old geocode')

rep("if(map)setTimeout(()=>map.invalidateSize(),120);", "if(map)setTimeout(()=>{map.invalidateSize();if(n===2)followAddress()},150);", 'show')
rep("case 'geocode':geocode();break;", "case 'drop-pin':dropPin();break;case 'clear-pin':clearPin();break;", 'switch')
rep("fillAreas(c);recenter();saveDraft()", "fillAreas(c);followSoon();saveDraft()", 'locate')
rep("if(t.id==='county'){fillAreas(t.value);recenter()}", "if(t.id==='county'){fillAreas(t.value);followSoon()}", 'county change')
rep("if(t.id==='area')areaChanged();", "if(t.id==='area'){areaChanged();followSoon()}", 'area change')
rep("if(t.id==='price')fmtPrice(t);", "if(t.id==='price')fmtPrice(t);\n  if(t.id==='address'||t.id==='area_custom')followSoon();", 'input')
rep("latitude:S.pin.lat,longitude:S.pin.lng,", "latitude:S.pin?S.pin.lat:null,longitude:S.pin?S.pin.lng:null,", 'payload pin')
rep("['Map pin',S.pin?'Set':'Not set']", "['Map pin',S.pin?'Exact pin set':'Approximate area only']", 'review pin')
rep("setTimeout(()=>map.invalidateSize(),300);", "setTimeout(()=>{if(map)map.invalidateSize()},300);", 'init map guard')
rep("Shown only to buyers who enquire. Cards and search show the area.", "This appears on your listing card and page, so use a street or landmark rather than a house number.", 'address hint')

# ---------- Duplicate listings: persist listing id in the draft ----------
rep("return {step:S.step,cat:S.cat,", "return {step:S.step,sub:{listingId:S.sub.listingId,unitsDone:S.sub.unitsDone,photosDone:S.sub.photosDone,videoLinked:S.sub.videoLinked},cat:S.cat,", 'collect sub')
rep("S.cat=NK_CATEGORIES[d.cat]?d.cat:'apartment';renderCats();", "if(d.sub&&d.sub.listingId)Object.assign(S.sub,{listingId:d.sub.listingId,unitsDone:!!d.sub.unitsDone,photosDone:!!d.sub.photosDone,videoLinked:!!d.sub.videoLinked});\n  S.cat=NK_CATEGORIES[d.cat]?d.cat:'apartment';renderCats();", 'apply sub')
rep("if(error)throw error;id=S.sub.listingId=row.id}", "if(error)throw error;id=S.sub.listingId=row.id;saveDraftNow()}", 'save id')
rep("S.sub.unitsDone=true}", "S.sub.unitsDone=true;saveDraftNow()}", 'units flag')
rep("S.sub.photosDone=true}", "S.sub.photosDone=true;saveDraftNow()}", 'photos flag')
rep("if(step===4){if(!S.photos.length){", "if(step===4){if(!S.photos.length&&!S.sub.photosDone){", 'validate photos')

# ---------- Photo retry mapping ----------
rep("if(!S.sub.urls[i]){", "if(!S.photos[i].uploadedUrl){", 'photo url 1')
rep("S.sub.urls[i]=db.storage", "S.photos[i].uploadedUrl=db.storage", 'photo url 2')
rep("url:S.sub.urls[i],is_cover", "url:p.uploadedUrl,is_cover", 'photo url 3')
rep("delete S.sub.urls[i];", "", 'photo url 4')

# ---------- Upload progress + failure stays on step 5 ----------
rep("const path=`${listingId}/${Date.now()}-${i}.jpg`;", "$('btn-submit').textContent=`Uploading photo ${i+1} of ${S.photos.length}…`;const path=`${listingId}/${Date.now()}-${i}.jpg`;", 'progress text')
rep("await uploadVideo(id);", "if(S.video)btn.textContent='Uploading video…';await uploadVideo(id);", 'video text')
rep("failed to upload. Check your connection", "failed to upload (see the red thumbnails on the Photos step). Check your connection", 'fail msg')
rep("S.busy=false;show(4,true);return}", "S.busy=false;$('submit-error').scrollIntoView({block:'center',behavior:'smooth'});return}", 'stay step 5')

# ---------- Phone/link check ----------
rep(r"const PHONE_IN_TEXT=/(\+?254|0)?[\s-]?[17]\d{2}[\s-]?\d{3}[\s-]?\d{3}|https?:\/\/|www\./i;",
    r"const PHONE_IN_TEXT=/(?:\+254|\b254|\b0)[\s-]?[17]\d{2}[\s-]?\d{3}[\s-]?\d{3}\b|https?:\/\/|www\./i;", 'phone regex')
rep("'Remove phone numbers and links. Contact details are collected in the last step'",
    "'Remove the phone number or link (\"'+((val('description').match(PHONE_IN_TEXT)||[''])[0].trim())+'\"). Contact details are collected in the last step'", 'phone msg')

# ---------- House rules ----------
rep('placeholder="No parties, no smoking indoors, quiet after 10PM"', 'placeholder="One rule per line, e.g.&#10;No parties&#10;Quiet after 10PM"', 'air rules ph')
rep('<div class="field" style="margin-top:18px;padding-top:16px;border-top:1px solid var(--border)">',
    '<div class="field" style="margin-top:18px"><label for="std_rules">House rules <span class="opt">optional, one per line</span></label><textarea id="std_rules" rows="3" maxlength="500" placeholder="No loud music&#10;Visitors leave by 10PM"></textarea></div>\n      <div class="field" style="margin-top:18px;padding-top:16px;border-top:1px solid var(--border)">', 'std rules html')
rep("'air_rules',", "'air_rules','std_rules',", 'field ids')
rep("security:num('std_security')})", "security:num('std_security'),house_rules:num('std_rules')})", 'std rules payload')

# ---------- Deposit ----------
rep("$('deposit-f').hidden=!(g==='standard'||g==='boarding'||g==='commercial');", "$('deposit-f').hidden=!(g==='standard'||g==='boarding'||g==='commercial')||freq()==='once';", 'deposit hide')
rep("if(t.id==='comm_lease_type')feeBox();", "if(t.id==='comm_lease_type'||t.id==='price_frequency'){$('deposit-f').hidden=freq()==='once'||group()==='airbnb';feeBox()}", 'deposit change')
rep('<option value="3">3 months</option></select>', '<option value="3">3 months</option><option value="4">4 months</option><option value="5">5 months</option><option value="6">6 months</option></select>', 'deposit opts')
rep("if(val('deposit')!=='')d.deposit_months", "if(val('deposit')!==''&&freq()!=='once')d.deposit_months", 'deposit payload')

# ---------- WhatsApp ----------
rep('<input type="tel" id="whatsapp" inputmode="tel"/></div>', '<input type="tel" id="whatsapp" inputmode="tel"/><div class="field-error" id="e-whatsapp" role="alert"></div></div>', 'wa err')
rep("ok=fail('phone',okPhone(val('phone'))?'':'Enter a valid phone number, e.g. 0712 345 678')&&ok;", "ok=fail('phone',okPhone(val('phone'))?'':'Enter a valid phone number, e.g. 0712 345 678')&&ok;\n  ok=fail('whatsapp',!val('whatsapp')||okPhone(val('whatsapp'))?'':'Enter a valid WhatsApp number or leave it blank')&&ok;", 'wa validate')
rep("phone:val('phone'),whatsapp:val('whatsapp')||val('phone')", "phone:nkNormalizePhone(val('phone')),whatsapp:nkNormalizePhone(val('whatsapp')||val('phone'))", 'wa payload')

# ---------- Units ----------
rep("if(g==='commercial'&&parseInt(val('comm_units'))>0)return [{label:'Unit Type 1',cap:'',price:priceVal(),qty:parseInt(val('comm_units'))}];return []}", "return []}", 'fake unit')
rep("if(g==='boarding'||unitsOn()){if(!validTiers().length){", "if(g==='boarding'||unitsOn()){const part=S.tiers.filter(t=>(t.label.trim()||t.price||t.qty)&&!(t.label.trim()&&parseFloat(t.price)>0&&parseInt(t.qty)>=1));if(part.length){ok=false;if(!quiet)toast('One type is only partly filled. Complete or remove it.','error')}else if(!validTiers().length){", 'partial tiers')

# ---------- Photos UX ----------
rep('<div class="photo-grid" id="photo-grid"></div>', '<div class="photo-grid" id="photo-grid"></div><div class="field-error" id="photo-skip" role="alert"></div>', 'skip el')
rep("if(skipped.length)toast('Skipped: '+skipped.join('; '),'error');", "$('photo-skip').textContent=skipped.length?'Skipped: '+skipped.join('; '):'';", 'skip inline')
rep("<br>The first photo is the cover.", "<br>Tap “Set cover” on any photo to choose the cover.", 'cover copy')
rep("const bmp=await createImageBitmap(file,{imageOrientation:'from-image'});", "let bmp;try{bmp=await createImageBitmap(file,{imageOrientation:'from-image'})}catch(e){bmp=await new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=no;im.src=URL.createObjectURL(file)})}", 'bitmap fallback')
rep("window.addEventListener('beforeunload',saveDraftNow);", "['dragover','drop'].forEach(v=>window.addEventListener(v,e=>e.preventDefault()));\nwindow.addEventListener('beforeunload',saveDraftNow);", 'drop guard')

# ---------- Small UX + cleanup ----------
rep("$('step-count').textContent=`Step ${S.step} of 5`;", "$('step-count').textContent=`Step ${S.step} of 5 · ${STEPS[S.step-1][0]}`;", 'step name')
rep("fillCounties();fillAreas('');renderCats();", "$('available_from').min=new Date().toISOString().slice(0,10);fillCounties();fillAreas('');renderCats();", 'date min')
rep("!$('success').hidden===false", "$('success').hidden", 'popstate')
rep("FIELD_IDS.forEach(id=>{if(id==='county')return;", "FIELD_IDS.forEach(id=>{if(id==='county'||(S.user&&id==='contact_email'))return;", 'draft email guard')
rep("$('video-hint').insertAdjacentHTML('afterbegin','');", "", 'dead code')

if bad:
    print('NOT WRITTEN. These anchors were not found exactly once:'); [print(' -', b) for b in bad]; sys.exit(1)
out = sys.argv[1].replace('.html', '') + '.patched.html'
open(out, 'w', encoding='utf-8').write(src)
print('OK, wrote', out)
