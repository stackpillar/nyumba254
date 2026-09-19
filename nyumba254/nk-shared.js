/* ============================================================
   nk-shared.js
   Single source of truth for Nyumba254's index.html and
   listings.html. Load with `defer` after the Supabase UMD
   script tag on both pages.

   Fixes applied here (see analysis doc, sections A/B):
   - A5  county/area duplicates: NK_AREAS_BY_COUNTY stays the
         source of truth for *display grouping*, but every query
         now filters on listings.county (see nkCountyQueryFilter)
         instead of matching area name strings across counties.
   - A2  escHtml() is the only string->HTML escaping helper used
         by both pages; every seller-supplied field must go
         through it before being interpolated into innerHTML.
   - A3  no more onclick="fn('...')" built from seller/county
         strings containing apostrophes — use data-* + delegation
         (see nkDelegate helper and its call sites in each page).
   - A4  nkSanitizeSearchTerm() strips characters that break
         PostgREST's .or(...ilike...) filter syntax.
   - A6  nk_recent_viewed is the ONE localStorage key for
         recently-viewed listings (array of IDs, newest first).
         Both pages read fresh price/status from Supabase by ID
         rather than trusting cached HTML/price.
   - B1  nkBuildListingsUrl() / nkParseListingsParams() are the
         single URL contract described in the doc.
   - B2  county/area/category data, the Supabase client, escHtml,
         formatPrice, data-saver, session/nav-swap and page-view
         tracking all live here once instead of twice.
   - B3  nkBuildCard() is the one card template, with a `compact`
         option for the homepage's simpler card.
   ============================================================ */

/* ---------- Supabase client ---------- */
const SUPABASE_URL = 'https://vliuuloyfhyxcsuchpss.supabase.co';
const SUPABASE_KEY = 'sb_publishable_oIIcecf3wzKMual5K24Z8Q_zmxVfgsx';
const EDGE_URL = `${SUPABASE_URL}/functions/v1`;
const { createClient } = supabase;

const nkAuthStorage = {
  getItem: (key) => (localStorage.getItem('ny_remember') === '0' ? sessionStorage : localStorage).getItem(key),
  setItem: (key, value) => (localStorage.getItem('ny_remember') === '0' ? sessionStorage : localStorage).setItem(key, value),
  removeItem: (key) => { localStorage.removeItem(key); sessionStorage.removeItem(key); }
};

const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage: nkAuthStorage, persistSession: true, autoRefreshToken: true }
});

const nkSessionPromise = db.auth.getSession();

/* ---------- Category / frequency labels (unified) ---------- */
const NK_CATEGORIES = {
  apartment:  { label: 'Apartment', group: 'standard' },
  house:      { label: 'House',     group: 'standard' },
  boarding:   { label: 'Boarding House', group: 'boarding' },
  airbnb:     { label: 'Airbnb / Holiday Rental', group: 'airbnb' },
  commercial: { label: 'Shops & offices', group: 'commercial' },
};
const NK_FREQ_LABEL = { month: '/mo', night: '/night', week: '/week', term: '/term', once: '' };
const NK_FREQ_TAG_LABEL = { month: 'Monthly', night: 'Nightly', week: 'Weekly', term: 'Per term', once: 'One-time (sale)' };

const NK_AMENITIES = [
  { key:'has_water', label:'Water supply' },
  { key:'has_electricity', label:'Electricity' },
  { key:'has_security', label:'Security' },
  { key:'has_solar', label:'Solar power' },
  { key:'has_wifi', label:'WiFi' },
  { key:'has_parking', label:'Parking' },
  { key:'has_balcony', label:'Balcony' },
  { key:'has_private_bathroom', label:'Private bathroom' },
  { key:'has_shared_bathroom', label:'Shared bathroom' },
  { key:'has_study_area', label:'Study area' },
  { key:'has_gym', label:'Gym' },
  { key:'has_pool', label:'Swimming pool' },
  { key:'has_pets_allowed', label:'Pets allowed' },
  { key:'has_backup_power', label:'Backup power' },
];

/* ---------- Counties / areas ----------
   NK_AREAS_BY_COUNTY is used for DISPLAY GROUPING ONLY (which
   areas to list under a county in the UI). It must never be used
   again to decide which *listings* belong to a county — several
   area names repeat across counties (Milimani, Pangani, Pipeline,
   Huruma, Manyatta, Kabati, Nyahururu, Elgon View), so filtering
   listings via `.in('area', areasForCounty)` silently mixes
   counties together. Every listings query below filters on the
   row's own `county` column instead (see nkCountyEq/nkCountyIn). */
const NK_COUNTIES = [
  "Mombasa","Kwale","Kilifi","Tana River","Lamu","Taita-Taveta","Garissa","Wajir","Mandera",
  "Marsabit","Isiolo","Meru","Tharaka-Nithi","Embu","Kitui","Machakos","Makueni","Nyandarua",
  "Nyeri","Kirinyaga","Murang'a","Kiambu","Turkana","West Pokot","Samburu","Trans Nzoia",
  "Uasin Gishu","Elgeyo-Marakwet","Nandi","Baringo","Laikipia","Nakuru","Narok","Kajiado",
  "Kericho","Bomet","Kakamega","Vihiga","Bungoma","Busia","Siaya","Kisumu","Homa Bay",
  "Migori","Kisii","Nyamira","Nairobi"
].sort();

const NK_AREAS_BY_COUNTY = {
  "Kisumu": ["Ahero","Car Wash","Dunga","Elgon View","Kanyakwar","Kibos","Kibuye","Kisumu CBD","Kombewa","Kondele","Luanda","Mamboleo","Manyatta","Maseno","Matibabu","Migosi","Milimani","Nyalenda","Nyamasaria","Obunga","Otonglo","Riat Hills","Sega"],
  "Nairobi": ["Nairobi CBD","Westlands","Parklands","Highridge","Kangemi","Kitisuru","Runda","Loresho","Muthaiga","Gigiri","Spring Valley","Nyari","Rosslyn","Thome","Garden Estate","Ridgeways","Kilimani","Kileleshwa","Lavington","Kawangware","Hurlingham","Upper Hill","Adams Arcade","Karen","Langata","South B","South C","Nairobi West","Madaraka","Otiende","Kibera","Woodley","Roysambu","Zimmerman","Kahawa West","Githurai","Mirema","Kasarani","Mwiki","Njiru","Ruaraka","Baba Dogo","Mathare","Huruma","Pipeline","Imara Daima","Nyayo Estate","Dandora","Kariobangi","Kayole","Komarock","Utawala","Tassia","Umoja","Buruburu","Donholm","Makadara","Eastleigh","Ngara","Pangani"],
  "Mombasa": ["Mombasa CBD (Old Town)","Nyali","Bamburi","Kizingo","Tudor","Likoni","Changamwe","Kisauni","Shanzu","Mkomani","Bombolulu","Kiembeni","Port Reitz","Miritini","Chaani","Migadini","Kongowea","Junda","Mwakirunge","Mtopanga","Jomvu","Magongo"],
  "Nakuru": ["Nakuru CBD","Milimani","Section 58","Langalanga","Pangani","Shabab","Bangladesh","Lanet","Free Area","Freehold","Ngata","Bahati","London","Afraha","Naka","Kiamunyi","White House","Pipeline","Kaptembwa","Rhoda","Menengai","Naivasha"],
  "Uasin Gishu": ["Eldoret CBD","Kapsoya","Langas","Kimumu","Huruma","Elgon View","Pioneer","Annex","Rupa Village","Hazina","Kamukunji","Munyaka","West Indies"],
  "Kiambu": ["Thika CBD","Landless","Makongeni","Section 9","Blue Post","Thika Greens","Kiganjo","Tora","Ngoingwa","Bahati Ridge","Kisii Estate","Ruiru","Membley","Kamakis","Juja","Kiambu Town","Kikuyu","Limuru"],
  "Kilifi": ["Kilifi Town","Malindi CBD","Kisumu Ndogo","Majengo (Malindi)","Silversands","Watamu","Mtwapa","Mariakani","Kaloleni","Mazeras","Magarini"],
  "Machakos": ["Machakos CBD","Mua Hills","Kalama","Mitaboni","Athi River","Mlolongo","Syokimau","Katani","Kangundo Road","Kola"],
  "Kakamega": ["Kakamega CBD","Amalemba","Milimani","Shirere","Lurambi","Mahiakalo","Sudi","Mumias","Butere","Malava","Lugari"],
  "Meru": ["Meru CBD","Makutano","Kinoru","Ntharene","Nkubu","Maua","Timau","Laare","Mikinduri","Kianjai"],
  "Nyeri": ["Nyeri CBD","Ring Road","Mountain View Estate","Garden Estate","Kamakwa","Ruring'u","Majengo","Karatina","Othaya Town","Mukurweini Town","Naromoru"],
  "Kericho": ["Kericho CBD","Kapsoit","Ainamoi","Litein","Kipkelion","Fort Ternan","Sosiot","Chepseon","Kedowa","Cheborge"],
  "Trans Nzoia": ["Kitale CBD","Milimani","Mitume","Matisi","Tuwan","Endebess","Kiminini","Kwanza","Saboti","Cherangany"],
  "Kwale": ["Kwale Town","Diani","Ukunda","Tiwi","Msambweni","Lunga Lunga","Matuga","Kinango","Waa","Shimoni","Mackinon Road","Vanga"],
  "Tana River": ["Hola","Garsen","Bura","Galole","Wenje","Kipini","Madogo","Chewele","Bangale","Wayu"],
  "Lamu": ["Lamu Town","Mokowe","Faza","Matondoni","Mpeketoni","Witu","Hindi","Kizingitini","Shela","Kiunga"],
  "Taita-Taveta": ["Voi","Taveta","Wundanyi","Mwatate","Mgange","Wesu","Bura (Taita)","Mbale (Taveta)","Tausa","Werugha"],
  "Garissa": ["Garissa Town","Dadaab","Balambala","Fafi","Ijara","Lagdera","Modogashe","Bura (Garissa)","Sankuri","Hulugho"],
  "Wajir": ["Wajir Town","Habaswein","Griftu","Eldas","Tarbaj","Bute","Buna","Diif","Elnur","Khorof Harar"],
  "Mandera": ["Mandera Town","Rhamu","Banissa","Lafey","Takaba","El Wak","Kotulo","Fino","Arabia","Warankara"],
  "Marsabit": ["Marsabit Town","Moyale","Loiyangalani","North Horr","Laisamis","Sololo","Turbi","Maikona","Illeret","Dukana"],
  "Isiolo": ["Isiolo Town","Garbatulla","Merti","Kinna","Oldonyiro","Burat","Bulapesa","Wabera","Chari","Cherab"],
  "Tharaka-Nithi": ["Chuka","Marimanti","Kathwana","Chogoria","Gatunga","Nkondi","Igambang'ombe","Muthambi","Mitheru","Tunyai"],
  "Embu": ["Embu Town","Runyenjes","Manyatta","Siakago","Ishiara","Kiritiri","Kyeni","Karurumo","Kirimari","Gaturi"],
  "Kitui": ["Kitui Town","Mwingi","Mutomo","Mutitu","Migwani","Zombe","Kabati","Ikutha","Mutha","Kanyangi"],
  "Makueni": ["Wote","Emali","Sultan Hamud","Kibwezi","Kilome","Mbooni","Kaiti","Nunguni","Makindu","Tawa"],
  "Nyandarua": ["Ol Kalou","Engineer","Njabini","Nyahururu","Ndaragwa","Ol Joro Orok","North Kinangop","South Kinangop","Kipipiri","Shamata"],
  "Kirinyaga": ["Kerugoya","Kutus","Sagana","Kagio","Wang'uru","Baricho","Kianyaga","Kimbimbi","Mwea","Kutus Town"],
  "Murang'a": ["Murang'a Town","Kenol","Kangema","Maragua","Kandara","Kigumo","Gatanga","Kiria-ini","Kabati","Makuyu"],
  "Turkana": ["Lodwar","Kakuma","Lokichogio","Lokitaung","Kalokol","Lokichar","Kainuk","Todonyang","Kibish","Katilu"],
  "West Pokot": ["Kapenguria","Makutano (Pokot)","Chepareria","Kacheliba","Sigor","Alale","Chepnyal","Lomut","Ortum","Kongelai"],
  "Samburu": ["Maralal","Baragoi","Wamba","Archer's Post","Suguta Marmar","Kirisia","South Horr","Poro","Loosuk","Kisima"],
  "Elgeyo-Marakwet": ["Iten","Tambach","Kapsowar","Chepkorio","Kapyego","Kapsait","Chesoi","Kaptarakwa","Kamogoi","Kabiemit"],
  "Nandi": ["Kapsabet","Nandi Hills","Mosoriot","Kabiyet","Kaptumo","Kobujoi","Kapsisiywa","Kapsabet Town","Chepterit","Kilibwoni"],
  "Baringo": ["Kabarnet","Eldama Ravine","Marigat","Kabartonjo","Mogotio","Kimalel","Kabernet Town","Loruk","Kampi ya Samaki","Mochongoi"],
  "Laikipia": ["Nanyuki","Nyahururu","Rumuruti","Dol Dol","Kinamba","Ngobit","Sipili","Marmanet","Mukogodo","Salama"],
  "Narok": ["Narok Town","Kilgoris","Ololulunga","Suswa","Ewaso Ngiro","Nairagie Enkare","Naikarra","Ntulele","Melili","Lolgorian"],
  "Kajiado": ["Kajiado Town","Ngong","Kitengela","Ongata Rongai","Kiserian","Loitokitok","Namanga","Isinya","Bissil","Mashuuru"],
  "Bomet": ["Bomet Town","Sotik","Longisa","Mulot","Chepalungu","Silibwet","Sigor (Bomet)","Chebunyo","Kaplong","Mogogosiek"],
  "Vihiga": ["Mbale","Luanda (Vihiga)","Chavakali","Majengo (Vihiga)","Emuhaya","Sabatia","Hamisi","Wodanga","Bunyore","Gisambai"],
  "Bungoma": ["Bungoma CBD","Kanduyi","Sikata","Webuye","Kimilili","Chwele","Bumula","Sirisia","Naitiri","Malakisi"],
  "Busia": ["Busia Town","Malaba","Nambale","Funyula","Budalangi","Amagoro","Port Victoria","Matayos","Alupe","Angurai"],
  "Siaya": ["Siaya Town","Bondo","Ugunja","Yala","Ukwala","Usenge","Sega (Siaya)","Nyang'oma Kogelo","Uranga","Yenga"],
  "Homa Bay": ["Homa Bay Central","Asego","Arujo","Kalanya","Kanyabala","Katuma","Posta/Bonde","Oyugis","Kendu Bay","Rangwe","Ndhiwa","Mbita","Sindo","Kabondo","Kasipul","Karachuonyo"],
  "Migori": ["Migori Town","Rongo","Awendo","Isebania","Kehancha","Macalder","Muhuru Bay","Uriri","Ntimaru","Suna"],
  "Kisii": ["Kisii CBD","Milimani","Nyanchwa","Nyamataro","Daraja Mbili","Mwembe","Jogoo","Nyamage","Nyakoe","Nyangena","Gesonso"],
  "Nyamira": ["Nyamira Town","Keroka","Ekerenyo","Nyansiongo","Manga","Ikonge","Magwagwa","Nyamaiya","Bomwagamo","Ainapngetuny"]
};
const NK_TIER1 = ["Kisumu", "Nairobi", "Mombasa"];

/* Kept ONLY as a display fallback (e.g. showing "which county is this
   area probably in" before a listing's own county is known) — never
   used to filter listings anymore. */
const NK_AREA_TO_COUNTY_GUESS = {};
Object.entries(NK_AREAS_BY_COUNTY).forEach(([county, areas]) => {
  areas.forEach(area => { if (!(area in NK_AREA_TO_COUNTY_GUESS)) NK_AREA_TO_COUNTY_GUESS[area] = county; });
});

const NK_COUNTY_LABEL = {
  "Uasin Gishu": "Uasin Gishu (Eldoret)",
  "Trans Nzoia": "Trans Nzoia (Kitale)",
  "Kiambu": "Kiambu (Thika)",
  "Kilifi": "Kilifi (Malindi)",
  "Kwale": "Kwale (Diani)",
  "Taita-Taveta": "Taita-Taveta (Voi)",
  "West Pokot": "West Pokot (Kapenguria)",
  "Vihiga": "Vihiga (Mbale)",
  "Nyandarua": "Nyandarua (Ol Kalou)",
  "Turkana": "Turkana (Lodwar)",
  "Samburu": "Samburu (Maralal)",
  "Elgeyo-Marakwet": "Elgeyo-Marakwet (Iten)",
  "Nandi": "Nandi (Kapsabet)",
  "Baringo": "Baringo (Kabarnet)",
  "Laikipia": "Laikipia (Nanyuki)",
  "Tharaka-Nithi": "Tharaka-Nithi (Chuka)",
  "Kirinyaga": "Kirinyaga (Kerugoya)",
  "Makueni": "Makueni (Wote)"
};
function nkCountyLabel(county) { return NK_COUNTY_LABEL[county] || county; }
function nkAreaCountFor(county) { return (NK_AREAS_BY_COUNTY[county] || []).length; }

/* ---------- Escaping / formatting (used everywhere seller data is rendered) ---------- */
function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function nkTitleCase(s) { if (!s) return ''; return String(s).replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()); }

function formatPrice(listing, opts) {
  const meta = NK_CATEGORIES[listing.category] || { group: 'standard' };
  const prefix = (opts && opts.showFromPrefix && meta.group === 'boarding') ? 'From ' : '';
  const suffix = NK_FREQ_LABEL[listing.price_frequency] || '';
  const p = Number(listing.price || 0).toLocaleString('en-KE');
  return `${prefix}KES ${p}${suffix ? `<span>${suffix}</span>` : ''}`;
}

/* ---------- A4: sanitize free-text search so it can't break PostgREST's .or(...) filter ---------- */
function nkSanitizeSearchTerm(q) {
  return String(q || '').replace(/[,()%_\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

/* ---------- A9: numeric bedroom filter helper.
   details is jsonb; comparing via `details->bedrooms` (no `->>`) keeps
   the value as jsonb so Postgres compares it numerically instead of
   comparing "10" and "4" as text. ---------- */
function nkApplyBedroomFilter(query, bedsVal) {
  if (bedsVal === '' || bedsVal === undefined || bedsVal === null) return query;
  if (bedsVal === '4') return query.gte('details->bedrooms', 4);
  return query.eq('details->bedrooms', Number(bedsVal));
}

/* ---------- A5: filter listings by county using the row's own county
   column, never by matching area-name lists across counties. ---------- */
function nkCountyEq(query, county) {
  return county ? query.eq('county', county) : query;
}

/* ---------- B1: one URL contract shared by index and listings ---------- */
const NK_URL_KEYS = ['category','freq','county','area','minPrice','maxPrice','beds','furn','amen','q','sort','page','view'];
function nkBuildListingsUrl(f) {
  const p = new URLSearchParams();
  NK_URL_KEYS.forEach(k => {
    const v = f[k];
    if (v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && !v.length)) {
      p.set(k, Array.isArray(v) ? v.join(',') : v);
    }
  });
  const qs = p.toString();
  return '/listings' + (qs ? '?' + qs : '');
}
function nkParseListingsParams(search) {
  const p = new URLSearchParams(search || window.location.search);
  const out = {};
  NK_URL_KEYS.forEach(k => { const v = p.get(k); if (v !== null) out[k] = v; });
  if (out.area) out.area = out.area.split(',').filter(Boolean);
  if (out.amen) out.amen = out.amen.split(',').filter(Boolean);
  return out;
}
/* Writes the current filter state into the address bar without adding
   history entries, so Back/reload/shareable links all work. */
function nkSyncUrl(f) {
  try {
    const url = nkBuildListingsUrl(f);
    if (window.location.pathname + window.location.search !== url) {
      history.replaceState(history.state, '', url);
    }
  } catch (e) { /* ignore in environments without a real address bar */ }
}

/* ---------- A6: recently-viewed — one key, IDs only ---------- */
const NK_RECENT_KEY = 'nk_recent_viewed';
function nkGetRecentViewedIds() {
  try { const v = JSON.parse(localStorage.getItem(NK_RECENT_KEY) || '[]'); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
function nkTrackRecentViewed(id) {
  if (!id) return;
  let ids = nkGetRecentViewedIds().filter(x => x !== id);
  ids.unshift(id);
  ids = ids.slice(0, 10);
  try { localStorage.setItem(NK_RECENT_KEY, JSON.stringify(ids)); } catch (e) {}
}
async function nkFetchRecentlyViewed() {
  const ids = nkGetRecentViewedIds();
  if (!ids.length) return [];
  const { data, error } = await db.from('listings').select('*, listing_photos(*)').in('id', ids).in('status', ['active', 'occupied']);
  if (error || !data) return [];
  const byId = Object.fromEntries(data.map(l => [l.id, l]));
  return ids.map(id => byId[id]).filter(Boolean);
}
/* Delegated click tracking: any element with data-listing-id inside a
   container wired up via this call records a recently-viewed hit. */
function nkBindRecentViewedTracking(rootEl) {
  if (!rootEl || rootEl.dataset.rvBound) return;
  rootEl.dataset.rvBound = '1';
  rootEl.addEventListener('click', e => {
    const card = e.target.closest('[data-listing-id]');
    if (card) nkTrackRecentViewed(card.dataset.listingId);
  });
}

/* ---------- Data Saver (shared, both pages) ---------- */
function nkApplyDataSaver(on) {
  document.body.classList.toggle('nk-datasaver', on);
  const banner = document.getElementById('nk-datasaver-banner');
  if (banner) banner.classList.toggle('visible', on);
  try { localStorage.setItem('nk_datasaver', on ? '1' : '0'); } catch (e) {}
  document.dispatchEvent(new CustomEvent('nk:datasaver', { detail: { on } }));
}
function nkToggleDataSaver() { nkApplyDataSaver(!document.body.classList.contains('nk-datasaver')); }
function nkInitDataSaver() {
  const stored = (() => { try { return localStorage.getItem('nk_datasaver'); } catch { return null; } })();
  if (stored === '1') { nkApplyDataSaver(true); return; }
  if (stored === '0') { nkApplyDataSaver(false); return; }
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn && (conn.saveData || ['slow-2g', '2g'].includes(conn.effectiveType))) nkApplyDataSaver(true);
}

/* ---------- Debounce ---------- */
function nkDebounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ---------- Session / "My Account" nav swap (shared) ---------- */
function nkInitAccountNav(ids) {
  nkSessionPromise.then(({ data }) => {
    const session = data && data.session;
    if (!session) return;
    (ids || []).forEach(id => {
      const link = document.getElementById(id);
      if (!link) return;
      link.textContent = 'My Account';
      link.href = '/dashboard';
      link.style.fontWeight = '600';
      link.style.color = 'var(--green)';
    });
  });
}

/* ---------- Page-view tracking (shared) ---------- */
function nkTrackPageView() {
  let sid;
  try { sid = localStorage.getItem('nk_sid'); } catch { sid = null; }
  if (!sid) {
    sid = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2));
    try { localStorage.setItem('nk_sid', sid); } catch (e) {}
  }
  db.from('page_views').insert({
    path: location.pathname,
    referrer: document.referrer || null,
    user_agent: navigator.userAgent,
    session_id: sid
  }).then(() => {}, () => {});
}

/* ---------- B6: record zero-result searches as demand signal.
   Requires a `search_events` table (see README note at bottom of this
   file for the suggested schema) — wrapped defensively so it never
   breaks the page if that table isn't provisioned yet. ---------- */
function nkRecordZeroResultSearch(filters) {
  try {
    db.from('search_events').insert({
      filters: filters,
      path: location.pathname,
      created_at: new Date().toISOString()
    }).then(() => {}, () => {});
  } catch (e) { /* table may not exist yet — non-fatal */ }
}

/* ---------- Phone normalisation (Kenyan numbers -> +254...) ---------- */
function nkNormalizePhone(raw) {
  let s = String(raw || '').replace(/[^\d+]/g, '');
  if (!s) return '';
  if (s.startsWith('+254')) return s;
  if (s.startsWith('254')) return '+' + s;
  if (s.startsWith('0')) return '+254' + s.slice(1);
  if (s.startsWith('7') || s.startsWith('1')) return '+254' + s;
  return s;
}

/* ---------- Global "buyer profile" (B7 / Contacting sellers item 1) ----------
   Name + phone are now stored once, globally, rather than duplicated
   per-listing, so the second enquiry a buyer ever sends on the site is
   pre-filled without them retyping anything. */
const NK_BUYER_PROFILE_KEY = 'nk_buyer_profile';
function nkGetBuyerProfile() {
  try { return JSON.parse(localStorage.getItem(NK_BUYER_PROFILE_KEY) || '{}'); } catch { return {}; }
}
function nkSaveBuyerProfile(profile) {
  try {
    const existing = nkGetBuyerProfile();
    localStorage.setItem(NK_BUYER_PROFILE_KEY, JSON.stringify({ ...existing, ...profile }));
  } catch (e) {}
}

/* ---------- B3: one shared card template, with a `compact` mode for the homepage ---------- */
function nkCardCoverPhoto(listing) {
  const photos = listing.listing_photos && listing.listing_photos.length
    ? [...listing.listing_photos].sort((a, b) => (a.position || 0) - (b.position || 0))
    : [];
  return photos.find(p => p.is_cover) || photos[0] || null;
}

function nkBuildVerifiedBadge(listing) {
  if (listing?.profiles?.verification_status !== 'verified') return '';
  return `<span class="card-verified-badge" title="This seller has been identity-verified by Nyumba254"><svg viewBox="0 0 24 24"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><polyline points="9 12 11 14 15 10"/></svg>Verified</span>`;
}

function nkImgSrc(url, width) {
  if (!url) return '';
  if (!width) return url;
  // Supabase Storage image transforms (only applies to Supabase-hosted URLs; harmless no-op otherwise).
  return url.includes('?') ? `${url}&width=${width}` : `${url}?width=${width}`;
}

/**
 * nkBuildCard(listing, opts)
 * opts.compact   -> homepage-style card (simpler, no compare/inquire)
 * opts.imgWidth  -> passed to nkImgSrc for responsive image sizing
 */
function nkBuildCard(listing, opts) {
  const o = opts || {};
  const compact = !!o.compact;
  const cover = nkCardCoverPhoto(listing);
  const safeTitle = escHtml(listing.title);
  const meta = NK_CATEGORIES[listing.category] || { label: escHtml(listing.category), group: 'standard' };
  const subText = listing.address
    ? listing.address
    : (listing.county ? `${listing.area || ''}${listing.area ? ', ' : ''}${nkCountyLabel(listing.county)}` : (listing.area || 'Kenya'));
  const href = `/listing?id=${String(listing.listing_number).padStart(6, '0')}`;
  const isNew = listing.created_at && (Date.now() - new Date(listing.created_at).getTime()) < 3 * 24 * 60 * 60 * 1000;
  const isOccupied = listing.status === 'occupied';
  const occLabel = listing.price_frequency === 'once' ? 'Sold' : 'Occupied';

  const imgUrl = cover ? nkImgSrc(cover.url, o.imgWidth) : '';
  const imgHtml = cover
    ? `<img src="${escHtml(imgUrl)}" alt="${safeTitle}" loading="lazy" width="${compact ? 400 : 360}" height="${compact ? 300 : 240}"/>`
    : `<div class="card-img-placeholder">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
         <span style="font-size:12px">No photo yet</span>
       </div>`;

  const topBadge = isOccupied
    ? `<span class="badge-new" style="background:#C53030">${occLabel}</span>`
    : (listing.is_featured
        ? '<span class="badge-featured">Featured</span>'
        : (isNew ? '<span class="badge-new">New</span>' : ''));

  const heart = (typeof NKSaved !== 'undefined' && NKSaved.buildHeartBtn) ? NKSaved.buildHeartBtn(listing.id) : '';
  const verifiedBadge = nkBuildVerifiedBadge(listing);

  return `
    <a class="card" href="${href}" aria-label="${safeTitle}" data-listing-id="${escHtml(listing.id)}" style="${isOccupied ? 'opacity:.7' : ''}">
      <div class="card-img">
        ${imgHtml}
        ${topBadge}
        <div class="nk-heart-overlay">${heart}</div>
        <span class="badge-cat ${escHtml(listing.category)}">${meta.label}</span>
      </div>
      <div class="card-body">
        <div class="card-area">${escHtml(listing.area)} ${verifiedBadge}</div>
        <div class="card-title">${safeTitle}</div>
        <div class="card-sub">${escHtml(subText)}</div>
        <div class="card-price">${formatPrice(listing, { showFromPrefix: !compact })}</div>
      </div>
    </a>`;
}

/* ---------- Event delegation helper (A3: no more onclick="fn('name-with-apostrophe')") ---------- */
function nkDelegate(container, selector, handler) {
  if (!container) return;
  container.addEventListener('click', e => {
    const el = e.target.closest(selector);
    if (el && container.contains(el)) handler(el, e);
  });
}

/* ---------- Simple accessible modal helpers (E: focus trap / Escape / focus return) ---------- */
function nkOpenModal(overlayEl) {
  if (!overlayEl) return;
  overlayEl._nkReturnFocus = document.activeElement;
  overlayEl.classList.add('open');
  document.body.style.overflow = 'hidden';
  document.body.classList.add('nk-modal-open');
  const focusable = overlayEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable.length) focusable[0].focus();
  if (!overlayEl._nkTrapBound) {
    overlayEl._nkTrapBound = true;
    overlayEl.addEventListener('keydown', e => {
      if (e.key === 'Escape') { nkCloseModal(overlayEl); return; }
      if (e.key !== 'Tab') return;
      const items = [...overlayEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled && el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }
}
function nkCloseModal(overlayEl) {
  if (!overlayEl) return;
  overlayEl.classList.remove('open');
  document.body.style.overflow = '';
  document.body.classList.remove('nk-modal-open');
  if (overlayEl._nkReturnFocus && overlayEl._nkReturnFocus.focus) overlayEl._nkReturnFocus.focus();
}

/* ---------- Lightweight natural-language search parser (C: search section) ----------
   Best-effort only — recognises bedrooms, price-under-N, and a handful
   of category keywords, and returns a filter object the caller can
   merge into its own filter state. Never throws. */
function nkParseSearchIntent(raw) {
  const q = String(raw || '').toLowerCase();
  const out = {};
  const bedMatch = q.match(/(\d+)\s*(?:bed|bedroom|br)\b/);
  if (bedMatch) out.beds = bedMatch[1];
  if (/\bbedsitter\b|\bstudio\b/.test(q)) out.beds = '0';
  if (/\bhostel\b|\bboarding\b/.test(q)) out.cat = 'boarding';
  else if (/\bshop\b|\boffice\b|\bcommercial\b/.test(q)) out.cat = 'commercial';
  else if (/\bairbnb\b|\bholiday\b|\bshort\s*stay\b/.test(q)) out.cat = 'airbnb';
  else if (/\bhouse\b/.test(q)) out.cat = 'house';
  else if (/\bapartment\b|\bflat\b/.test(q)) out.cat = 'apartment';
  const underMatch = q.match(/under\s*(?:kes\s*)?([\d,]+)k?/);
  if (underMatch) {
    let n = parseFloat(underMatch[0].includes('k') && !/\d,\d/.test(underMatch[1]) ? underMatch[1] : underMatch[1].replace(/,/g, ''));
    if (/\d+k\b/.test(underMatch[0]) && n < 1000) n *= 1000;
    out.maxPrice = Math.round(n);
  }
  const areaGuess = Object.keys(NK_AREA_TO_COUNTY_GUESS).find(a => q.includes(a.toLowerCase()));
  if (areaGuess) out.area = areaGuess;
  return out;
}

/* ---------- "Near me" geolocation (shared by index + listings, B4) ---------- */
const NK_COUNTY_COORDS = {
  "Mombasa": [-4.0435, 39.6682], "Kwale": [-4.1747, 39.4520], "Kilifi": [-3.6305, 39.8499],
  "Tana River": [-1.0167, 40.1167], "Lamu": [-2.2717, 40.9020], "Taita-Taveta": [-3.3968, 38.5637],
  "Garissa": [-0.4569, 39.6583], "Wajir": [1.7471, 40.0629], "Mandera": [3.9366, 41.8670],
  "Marsabit": [2.3284, 37.9899], "Isiolo": [0.3556, 37.5820], "Meru": [0.0470, 37.6556],
  "Tharaka-Nithi": [-0.2971, 37.8459], "Embu": [-0.5310, 37.4500], "Kitui": [-1.3667, 38.0167],
  "Machakos": [-1.5177, 37.2634], "Makueni": [-1.8038, 37.6242], "Nyandarua": [-0.3242, 36.4310],
  "Nyeri": [-0.4167, 36.9500], "Kirinyaga": [-0.6591, 37.3833], "Murang'a": [-0.7217, 37.1500],
  "Kiambu": [-1.1714, 36.8356], "Turkana": [3.1167, 35.6000], "West Pokot": [1.6167, 35.3833],
  "Samburu": [1.2151, 36.9490], "Trans Nzoia": [1.0167, 35.0000], "Uasin Gishu": [0.5143, 35.2698],
  "Elgeyo-Marakwet": [0.8000, 35.5000], "Nandi": [0.1833, 35.1167], "Baringo": [0.4667, 35.9667],
  "Laikipia": [0.2000, 36.7833], "Nakuru": [-0.3031, 36.0800], "Narok": [-1.0833, 35.8667],
  "Kajiado": [-1.8500, 36.7833], "Kericho": [-0.3667, 35.2833], "Bomet": [-0.7833, 35.3417],
  "Kakamega": [0.2827, 34.7519], "Vihiga": [0.0667, 34.7167], "Bungoma": [0.5667, 34.5667],
  "Busia": [0.4608, 34.1115], "Siaya": [0.0607, 34.2881], "Kisumu": [-0.0917, 34.7680],
  "Homa Bay": [-0.5273, 34.4571], "Migori": [-1.0634, 34.4731], "Kisii": [-0.6817, 34.7680],
  "Nyamira": [-0.5633, 34.9358], "Nairobi": [-1.2921, 36.8219]
};
function nkHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function nkFindNearestCounty(lat, lon) {
  let best = null, bestDist = Infinity;
  Object.entries(NK_COUNTY_COORDS).forEach(([county, [clat, clon]]) => {
    if (!nkAreaCountFor(county)) return;
    const d = nkHaversine(lat, lon, clat, clon);
    if (d < bestDist) { bestDist = d; best = county; }
  });
  return best;
}
/**
 * nkUseNearMe(onFound) — shared "Near me" flow. Calls onFound(county)
 * once a county is resolved. Used by both the homepage hero and the
 * listings toolbar (B4: "Near me" should work on both pages).
 */
function nkUseNearMe(onFound, onError) {
  if (!navigator.geolocation) { if (onError) onError("Location isn't available on this device/browser."); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    const county = nkFindNearestCounty(pos.coords.latitude, pos.coords.longitude);
    if (county && onFound) onFound(county);
    else if (onError) onError('Could not match your location to a county.');
  }, () => { if (onError) onError('Could not get your location. You can pick a county manually.'); }, { timeout: 8000 });
}

/* ---------- D: recent searches saved as full filter sets (not just raw text), shared so listings.html can record them too ---------- */
const NK_RECENT_SEARCHES_KEY = 'nk_recent_searches_v2';
function nkBuildSearchLabel(filters) {
  const parts = [];
  if (filters.area) parts.push(Array.isArray(filters.area) ? filters.area.join(', ') : filters.area);
  else if (filters.county) parts.push(nkCountyLabel(filters.county));
  if (filters.beds) parts.push(filters.beds === '0' ? 'Studio' : `${filters.beds}+ bed`);
  if (filters.maxPrice) parts.push(`under ${Number(filters.maxPrice).toLocaleString()}`);
  if (filters.cat && NK_CATEGORIES[filters.cat]) parts.push(NK_CATEGORIES[filters.cat].label);
  if (filters.q) parts.push(`"${filters.q}"`);
  return parts.length ? parts.join(' · ') : 'All listings';
}
function nkGetRecentSearches() {
  try { const v = JSON.parse(localStorage.getItem(NK_RECENT_SEARCHES_KEY) || '[]'); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
function nkAddRecentSearch(filters) {
  const label = nkBuildSearchLabel(filters);
  let list = nkGetRecentSearches().filter(s => s.label !== label);
  list.unshift({ label, filters, ts: Date.now() });
  list = list.slice(0, 6);
  try { localStorage.setItem(NK_RECENT_SEARCHES_KEY, JSON.stringify(list)); } catch (e) {}
}

/* ---------- E: aria-pressed helper for filter pills ---------- */
function nkSetPressed(el, pressed) { if (el) el.setAttribute('aria-pressed', pressed ? 'true' : 'false'); }

/* ============================================================
   BACKEND / SCHEMA NOTES (cannot be fixed from static front-end
   files alone — flagged here so they aren't lost):

   1. search_events table (for nkRecordZeroResultSearch):
        id uuid pk default gen_random_uuid(),
        filters jsonb, path text, created_at timestamptz

   2. A numeric `bedrooms` generated column (or a real column kept
      in sync at write time) would be a cleaner long-term fix than
      the `details->bedrooms` jsonb-numeric comparison used above.

   3. loadCountyListingCounts() below selects `county` for every
      active/occupied row and groups client-side. That's correct
      (unlike the old area-name grouping) but still doesn't scale
      past Supabase's row cap. Replace with a single RPC/view that
      returns {county, count, category_counts} in one round trip.

   4. submitCardInquiry()/submitNotifyAlert() should move to one
      atomic RPC or Edge Function (insert enquiry + message
      together, with rate limiting) instead of anonymous
      insert+insert+delete-on-failure, which requires anonymous
      DELETE rights on `enquiries`. A honeypot field and a
      client-side per-listing cooldown are added in listings.html
      as a stop-gap, but real abuse protection needs server-side
      enforcement (RLS + Edge Function).

   5. RLS: confirm `area_geocodes` cannot be written by anonymous
      clients except through a server function (cache-poisoning
      risk noted in the analysis doc).

   6. Clean per-filter routes (e.g. /listings/kisumu/apartments)
      need server-side rewrites or prerendering; out of scope for
      these static files. In the meantime, canonical/title/meta are
      updated client-side to reflect the active filters (see
      nkUpdatePageHeading/nkUpdateSeo in listings.html).
   ============================================================ */