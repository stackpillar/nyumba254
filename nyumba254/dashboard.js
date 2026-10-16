
const SUPABASE_URL = 'https://vliuuloyfhyxcsuchpss.supabase.co';
const SUPABASE_KEY = 'sb_publishable_oIIcecf3wzKMual5K24Z8Q_zmxVfgsx';
const EDGE_URL = `${SUPABASE_URL}/functions/v1`;
const { createClient } = supabase;
const PDF_LIBRARY_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
let pdfLibraryPromise = null;

function ensurePdfLibrary(){
  if(window.jspdf) return Promise.resolve(true);
  if(pdfLibraryPromise) return pdfLibraryPromise;
  pdfLibraryPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=PDF_LIBRARY_URL;
    script.async=true;
    script.onload=()=>window.jspdf?resolve(true):reject(new Error('PDF library loaded without exposing jsPDF'));
    script.onerror=()=>reject(new Error('Could not download the PDF library'));
    document.head.appendChild(script);
  }).catch(error=>{
    pdfLibraryPromise=null;
    console.error('PDF library loading failed:',error);
    showToast('PDF tools could not load. Check your connection and try again.','error');
    return false;
  });
  return pdfLibraryPromise;
}

// ── Match the "Remember me" storage adapter used on the sign-in page ──
const authStorage = {
  getItem: (key) => (localStorage.getItem('ny_remember') === '0' ? sessionStorage : localStorage).getItem(key),
  setItem: (key, value) => (localStorage.getItem('ny_remember') === '0' ? sessionStorage : localStorage).setItem(key, value),
  removeItem: (key) => { localStorage.removeItem(key); sessionStorage.removeItem(key); }
};

const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage: authStorage, persistSession: true, autoRefreshToken: true }
});

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

  function applyStoredTheme(){
  let saved=localStorage.getItem('ny_theme');
  if(!saved){
    const prefersDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;
    saved=prefersDark?'dark':'light';
    localStorage.setItem('ny_theme',saved);
  }
  document.documentElement.setAttribute('data-theme',saved==='light'?'':saved);
  updateThemeMenuActive(saved);
}
function setTheme(name){
  localStorage.setItem('ny_theme',name);
  document.documentElement.setAttribute('data-theme',name==='light'?'':name);
  updateThemeMenuActive(name);
  closeThemeMenu();
}
function updateThemeMenuActive(name){
  document.querySelectorAll('.theme-option').forEach(b=>b.classList.toggle('active',b.dataset.theme===name));
}
function toggleThemeMenu(){document.getElementById('theme-menu')?.classList.toggle('open');}
function closeThemeMenu(){document.getElementById('theme-menu')?.classList.remove('open');}
document.addEventListener('click',e=>{const sw=document.getElementById('theme-switch');if(sw&&!sw.contains(e.target))closeThemeMenu();});
applyStoredTheme();

  function nkCountyLabel(county) { return NK_COUNTY_LABEL[county] || county; }

  const NK_AREA_TO_COUNTY = {};
  for (const [county, areas] of Object.entries(NK_AREAS_BY_COUNTY)) {
    areas.forEach(a => { NK_AREA_TO_COUNTY[a] = county; });
  }

  function nkPopulateEditCounties() {
    const sel = document.getElementById('edit-county');
    if (!sel) return;
    sel.innerHTML = NK_COUNTIES.map(c => `<option value="${c}">${nkCountyLabel(c)}</option>`).join('');
  }
  function nkPopulateEditAreas(county, currentArea) {
    const sel = document.getElementById('edit-area');
    if (!sel) return;
    const areas = NK_AREAS_BY_COUNTY[county] || [];
    sel.innerHTML = areas.map(a => `<option value="${a}">${a}</option>`).join('');
    if (currentArea && areas.includes(currentArea)) {
      sel.value = currentArea;
    } else if (currentArea) {
      const opt = document.createElement('option');
      opt.value = currentArea; opt.textContent = currentArea + ' (custom)';
      sel.appendChild(opt);
      sel.value = currentArea;
    }
  }
  function handleEditCountyChange() {
    const county = document.getElementById('edit-county').value;
    nkPopulateEditAreas(county);
  }

  function copyBubbleText(el){
  const text=el.textContent;
    if(!navigator.clipboard?.writeText){showToast('Copy is unavailable in this browser. Select and copy the message manually.','error');return;}
    navigator.clipboard.writeText(text).then(()=>showToast('Message copied ✓','success')).catch(error=>{
      console.error('Could not copy message:',error);
      showToast('Could not copy message. Select and copy it manually.','error');
    });
  }


let currentUser=null,currentProfile=null,ownerProfile=null,effectiveSellerId=null,isTeamMember=false,allListings=[],allEnquiries=[],allPayments=[],allMessages=[],allReviews=[],threads=[],activeThread=null,listingFilter='all',enquiryFilter='all',deleteTargetId=null,occupiedTargetId=null,replyTargetEnquiry=null,msgPollTimer=null,threadListingFilter=null,messagesChannel=null,listingActionBusy=new Set(),notifPollTimer=null,bnbBookingsChannel=null,bnbPropertyIdSet=new Set();
const ACCOUNT_TYPES=['buyer','owner','caretaker','agent','company'];
const ACCOUNT_ROLE_LABELS={buyer:'Tenant / Buyer',owner:'Owner',caretaker:'Caretaker',agent:'Agent',company:'Company'};
const ACCOUNT_ROLE_DESCRIPTIONS={buyer:'Browse, save and contact property listers.',owner:'List property you own.',caretaker:'Manage property on an owner’s behalf.',agent:'Connect buyers and tenants with properties.',company:'Represent an agency, developer or property manager.'};
const roleDate=value=>value?new Date(value).toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'}):'';

async function refreshBnbPropertyIdSet(){
  const{data,error}=await db.from('bnb_properties').select('id').eq('seller_id',effectiveSellerId);
  if(error){console.error('Could not refresh BNB booking subscriptions:',error);return;}
  bnbPropertyIdSet=new Set((data||[]).map(r=>String(r.id)));
  subscribeBnbBookingsRealtime();
}

function subscribeBnbBookingsRealtime(){
  if(bnbBookingsChannel){bnbBookingsChannel.unsubscribe();bnbBookingsChannel=null;}
  bnbBookingsChannel=db.channel('dash-bnb-bookings-'+effectiveSellerId)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'bnb_bookings'},payload=>{
      if(!bnbPropertyIdSet.has(String(payload.new.bnb_property_id)))return;
      playActivitySound();
      showToast(`New booking request from ${payload.new.guest_name||'a guest'} — check BNB Booking Ledger`,'success');
      notifyInApp('rent_ledger',`New booking — ${payload.new.guest_name||'Guest'}`,`${payload.new.check_in} → ${payload.new.check_out} · Awaiting confirmation`);
      if(document.getElementById('page-rent-ledger')?.classList.contains('active')&&isBnbLedgerMode())loadBnbLedger();
    })
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'bnb_bookings'},payload=>{
      if(!bnbPropertyIdSet.has(String(payload.new.bnb_property_id)))return;
      if(document.getElementById('page-rent-ledger')?.classList.contains('active')&&isBnbLedgerMode())loadBnbLedger();
    })
    .subscribe();
}

// Message history window: only pulls the last N days of messages on load,
// so this query and buildThreads() stay fast as conversations pile up over
// months. Older threads still exist in the DB, just not preloaded here.
const MSG_HISTORY_DAYS=90;
// Realtime already delivers new messages instantly; these two intervals are
// just a fallback in case a realtime channel silently drops.
const MSG_POLL_MS=300000, LISTING_STATUS_POLL_MS=30000; // 5min fallback poll — realtime (subscribeMessagesRealtime) is the primary delivery path

// ── Multi-unit management state (Manage units modal) ──
let muActiveListingId=null,muUnits=[],muActionBusy=false;

const AMENITY_KEYS=[
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

async function init(){
  try{
    nkPopulateEditCounties();
    const{data:{session},error:sessionError}=await db.auth.getSession();
    if(sessionError) throw new Error(`Could not verify your session: ${sessionError.message}`);
    if(!session){window.location.href='/login';return;}
    currentUser=session.user;
    discardUnscopedNotificationQueue();
    document.getElementById('topbar-date').textContent=new Date().toLocaleDateString('en-KE',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    await resolveEffectiveSeller();
    await Promise.all([loadPlatformVerifySettings(), loadProfile()]);
    updateVerifyWarningBanner();
    if(currentProfile?.role==='admin'){
      document.getElementById('loading-screen').style.display='none';
      document.getElementById('admin-blocked-screen').style.display='flex';
      document.getElementById('scw-fab').style.display='none';
      document.getElementById('scw-panel').style.display='none';
      return;
    }
  
    if(currentProfile?.is_disabled){
      document.getElementById('loading-screen').style.display='none';
      document.getElementById('suspended-screen').style.display='flex';
      document.getElementById('scw-fab').style.display='none';
      document.getElementById('scw-panel').style.display='none';
      return;
    }
    await loadAllData();
    void loadViewingRequestsPage(true);
    await refreshBnbPropertyIdSet();
    dashJoinAllPresence();
    loadPlatformPrices();
    loadNotifBell();
    renderOverview();
    document.getElementById('loading-screen').style.display='none';
    document.getElementById('app-shell').style.display='flex';
    const urlParams=new URLSearchParams(location.search);
    if(urlParams.get('verify')==='1'){
      const lim=urlParams.get('limit')||PLATFORM_VERIFY_SETTINGS.unverified_listing_limit||2;
      showToast(`Please verify your account — unverified sellers are limited to ${lim} listing(s).`,'error');
      showPage('settings');
      setTimeout(()=>openKycModal(),400);
      history.replaceState(null,'',location.pathname);
    }
    const lastPage=location.hash.slice(1)||sessionStorage.getItem('ny_last_page');
    if(lastPage&&lastPage!=='overview'&&document.getElementById('page-'+lastPage)){showPage(lastPage);}
    if(!currentProfile?.onboarding_completed){
      showToast('Choose an account type to finish setting up your account.','success');
      showPage('settings');
    }
    retryQueuedNotifications(); // flush any emails that failed to send last session
    msgPollTimer=setInterval(pollNewMessages,MSG_POLL_MS);
    listingStatusPollTimer=setInterval(pollListingStatusChanges,LISTING_STATUS_POLL_MS);
    notifPollTimer=setInterval(loadNotifBell,60000);
    document.addEventListener('visibilitychange',handleVisibilityChange);

    scwLoaded=true;
    scwInit();
    try{ tourOffer(); }catch(tourErr){ console.error('Tour error (non-fatal):',tourErr); }
  }catch(err){
    if(err && err.message==='account_deleted') return; // handleDeletedAccount() is already redirecting
    console.error('Init error:',err);
    const loadingScreen=document.getElementById('loading-screen');
    loadingScreen.setAttribute('role','alert');
    document.getElementById('loading-screen').innerHTML =
      '<p style="color:white;max-width:320px;text-align:center">Something went wrong loading your dashboard.<br><span style="opacity:.6;font-size:11px">'+escHtml(err.message||String(err))+'</span></p><div style="display:flex;gap:10px"><button class="btn btn-primary" onclick="location.reload()">Try again</button><button class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,.4)" onclick="doSignOut()">Sign out</button></div>';
  }
}

function updateNetworkStatus(){
  const status=document.getElementById('network-status');
  if(status) status.hidden=navigator.onLine;
}
window.addEventListener('online',updateNetworkStatus);
window.addEventListener('offline',updateNetworkStatus);
updateNetworkStatus();

  let notifItems = [];
  function toggleNotifBell() {
    const panel = document.getElementById('notif-bell-panel');
    const open = panel.style.display === 'block';
    panel.style.display = open ? 'none' : 'block';
    document.getElementById('theme-menu')?.classList.remove('open');
  }
  document.addEventListener('click', e => {
    const wrap = document.getElementById('notif-bell-wrap');
    if (wrap && !wrap.contains(e.target)) document.getElementById('notif-bell-panel').style.display = 'none';
  });

  const NOTIF_ICON = {
    message: '💬', listing_approved: '✅', listing_rejected: '⚠️', listing_updated: '✏️', payment: '💳',
    platform_update: '📣', policy_update: '📜', profile: '👤',
    rent_ledger: '📊', demand_insights: '📈', plan_feature: '⭐',
  };

  async function loadNotifBell() {
    const { data, error } = await db.from('notifications').select('*').eq('seller_id', effectiveSellerId).order('created_at', { ascending: false }).limit(30);
    if (error) { console.error('loadNotifBell error:', error); return; }
    notifItems = data || [];
    renderNotifBell();
    subscribeNotifBellRealtime();
  }
  function renderNotifBell() {
    const mutedCatsForBell=getMutedNotifCategories();
    const visibleNotifItems=notifItems.filter(n=>!mutedCatsForBell.has(notifCategoryFor(n.type)));
    const unread = visibleNotifItems.filter(n => !n.is_read).length;
    const badge = document.getElementById('notif-bell-badge');
    if (badge) {
      badge.textContent = unread > 9 ? '9+' : String(unread);
      badge.style.display = unread > 0 ? 'flex' : 'none';
      badge.classList.toggle('show', unread > 0);
    }
    const navBadge = document.getElementById('nav-badge-notifications');
    if (navBadge) { navBadge.textContent = unread > 99 ? '99+' : unread; navBadge.style.display = unread > 0 ? 'inline-block' : 'none'; }
    const list = document.getElementById('notif-bell-list');
    if (!list) return;
    if (!visibleNotifItems.length) { list.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-3);font-size:12.5px">${mutedCatsForBell.size?'All caught up — some categories are muted':'No notifications yet'}</div>`; return; }
    list.innerHTML = visibleNotifItems.map(n => `
      <div style="display:flex;gap:10px;padding:12px 16px;border-bottom:1px solid var(--border);background:${n.is_read ? 'transparent' : 'var(--green-light)'}">
        <span style="font-size:16px;flex-shrink:0;cursor:pointer" onclick="openNotifItem(${n.id})">${NOTIF_ICON[n.type] || '🔔'}</span>
        <div style="min-width:0;flex:1;cursor:pointer" onclick="openNotifItem(${n.id})">
          <div style="font-size:12.5px;font-weight:${n.is_read ? 500 : 700};color:var(--text)">${escHtml(n.title)}</div>
          ${n.body ? `<div style="font-size:11.5px;color:var(--text-3);margin-top:2px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${escHtml(n.body)}</div>` : ''}
          <div style="font-size:10.5px;color:var(--text-3);margin-top:4px">${timeAgo(n.created_at)}</div>
        </div>
        <button style="flex-shrink:0;align-self:center;font-size:10.5px;font-weight:700;color:var(--green-dark);background:var(--green-light);border:1px solid var(--green);border-radius:20px;padding:4px 10px;cursor:pointer;white-space:nowrap" onclick="event.stopPropagation();viewNotificationInCenter(${n.id})">View</button>
      </div>`).join('');
  }
  const LISTING_NOTIF_TYPES = new Set(['listing_approved', 'listing_rejected', 'listing_updated']);
  async function openNotifItem(id) {
    const n = notifItems.find(x => x.id === id);
    if (n && !n.is_read) {
      const{error}=await db.from('notifications').update({ is_read: true }).eq('seller_id',effectiveSellerId).eq('id', id);
      if(error){console.error('Could not mark notification as read:',error);showToast('Could not update this notification. Please try again.','error');return;}
      n.is_read = true; renderNotifBell();
    }
    document.getElementById('notif-bell-panel').style.display = 'none';
    // Only listing-related notifications navigate — straight to that listing.
    // Everything else just marks read and stays put.
    if (n && LISTING_NOTIF_TYPES.has(n.type) && n.link && n.link !== '#') {
      { const s = safeInternalLink(n.link); if (s) window.location.href = s; }
    }
  }
  async function markAllNotifsRead() {
    const unreadIds = notifItems.filter(n => !n.is_read).map(n => n.id);
    if (!unreadIds.length) { showToast('No unread notifications','success'); return; }
    const { error } = await db.from('notifications').update({ is_read: true }).eq('seller_id', effectiveSellerId).in('id', unreadIds);
    if (error) { showToast('Could not mark all read: '+error.message,'error'); console.error('markAllNotifsRead error:', error); return; }
    notifItems.forEach(n => n.is_read = true);
    renderNotifBell();
    showToast('All notifications marked read ✓','success');
  }
  let notifBellChannel = null;
  function subscribeNotifBellRealtime() {
    if (notifBellChannel) notifBellChannel.unsubscribe();
    notifBellChannel = db.channel('notif-bell-' + effectiveSellerId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `seller_id=eq.${effectiveSellerId}` }, payload => {
        notifItems.unshift(payload.new);
        renderNotifBell();
        if(!isNotifCategoryMuted(payload.new.type)){
          playActivitySound();
          showToast(payload.new.title, 'success');
        }
        if (document.getElementById('page-notifications')?.classList.contains('active')) renderNotificationsPage();
      })
      .subscribe();
  }

  // ── Notification Center — full categorized history, linked from the bell ──
  const NOTIF_CATEGORY_MAP = {
    message: 'messages', listing_approved: 'listings', listing_rejected: 'listings', listing_updated: 'listings',
    payment: 'payments', profile: 'account',
    rent_ledger: 'rent_ledger', demand_insights: 'rent_ledger',
    plan_feature: 'plan',
    platform_update: 'platform', policy_update: 'platform',
  };
  const NOTIF_CATEGORY_META = {
    messages:    { label: 'Messages & Enquiries', icon: '💬' },
    listings:    { label: 'Listings', icon: '🏠' },
    payments:    { label: 'Payments', icon: '💳' },
    account:     { label: 'Account', icon: '👤' },
    rent_ledger: { label: 'Rent Ledger & Insights', icon: '📊' },
    plan:        { label: 'Plan & Features', icon: '⭐' },
    platform:    { label: 'Platform & Updates', icon: '📣' },
    other:       { label: 'Other', icon: '🔔' },
  };
  function notifCategoryFor(type) { return NOTIF_CATEGORY_MAP[type] || 'other'; }
  let notifPageFilter = 'all';

  function viewNotificationInCenter(id) {
    document.getElementById('notif-bell-panel').style.display = 'none';
    const n = notifItems.find(x => x.id === id);
    if (n && !n.is_read) {
      db.from('notifications').update({ is_read: true }).eq('seller_id',effectiveSellerId).eq('id', id).then(({error})=>{
        if(error){console.error('Could not mark notification as read:',error);showToast('Could not update this notification. Please try again.','error');return;}
        n.is_read=true;renderNotifBell();renderNotificationsPage();
      }).catch(error=>{console.error('Could not mark notification as read:',error);showToast('Could not update this notification. Please try again.','error');});
    }
    showPage('notifications');
    setTimeout(() => { document.getElementById('notif-card-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); document.getElementById('notif-card-' + id)?.classList.add('notif-card-highlight'); }, 150);
  }

  function setNotifPageFilter(cat) {
    notifPageFilter = cat;
    renderNotificationsPage();
  }

  function renderNotificationsPage() {
    const total = notifItems.length;
    const unread = notifItems.filter(n => !n.is_read).length;
    const catCounts = {};
    notifItems.forEach(n => { const c = notifCategoryFor(n.type); catCounts[c] = (catCounts[c]||0) + 1; });

    const statsEl = document.getElementById('notif-page-stats');
    if (statsEl) statsEl.innerHTML = `
      <div class="notif-stat-card"><div class="ns-val">${total}</div><div class="ns-lbl">Total notifications</div></div>
      <div class="notif-stat-card"><div class="ns-val" style="color:${unread>0?'var(--red)':'var(--text)'}">${unread}</div><div class="ns-lbl">Unread</div></div>
      <div class="notif-stat-card"><div class="ns-val">${Object.keys(catCounts).length}</div><div class="ns-lbl">Categories active</div></div>`;

    const tabsEl = document.getElementById('notif-cat-tabs');
    const allCats = ['all', ...Object.keys(NOTIF_CATEGORY_META).filter(c => catCounts[c])];
    if (tabsEl) tabsEl.innerHTML = allCats.map(c => {
      const label = c === 'all' ? 'All' : NOTIF_CATEGORY_META[c].label;
      const icon = c === 'all' ? '🔔' : NOTIF_CATEGORY_META[c].icon;
      const count = c === 'all' ? total : (catCounts[c]||0);
      return `<button class="notif-cat-tab ${notifPageFilter===c?'active':''}" onclick="setNotifPageFilter('${c}')">${icon} ${escHtml(label)} <span class="nct-count">${count}</span></button>`;
    }).join('');

    const listEl = document.getElementById('notif-groups-list');
    if (!listEl) return;
    if (!total) {
      listEl.innerHTML = `<div class="notif-empty-state"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg><h3 style="font-size:15px;font-weight:600;color:var(--text-2);margin-bottom:4px">No notifications yet</h3><p style="font-size:12.5px;margin-bottom:14px">You'll see messages, listing updates, payments, and account activity here.</p><button class="btn btn-primary btn-sm" onclick="showPage('overview')">Go to Overview</button></div>`;
      return;
    }

    const unreadOnly = document.getElementById('notif-unread-only')?.checked;
    let filtered = notifPageFilter === 'all' ? notifItems : notifItems.filter(n => notifCategoryFor(n.type) === notifPageFilter);
    if (unreadOnly) filtered = filtered.filter(n => !n.is_read);
    if (!filtered.length) {
      listEl.innerHTML = `<div class="notif-empty-state"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><h3 style="font-size:15px;font-weight:600;color:var(--text-2)">Nothing in this category</h3></div>`;
      return;
    }

    const groups = {};
    filtered.forEach(n => { const c = notifCategoryFor(n.type); (groups[c] = groups[c]||[]).push(n); });
    const orderedCats = Object.keys(NOTIF_CATEGORY_META).filter(c => groups[c]);

    listEl.innerHTML = orderedCats.map(c => {
      const meta = NOTIF_CATEGORY_META[c];
      const items = groups[c];
      const rows = items.map(n => `
        <div class="notif-card-item ${n.is_read?'':'unread'}" id="notif-card-${n.id}" onclick="openNotifItemFromPage(${n.id})">
          <div class="notif-card-icon">${NOTIF_ICON[n.type] || meta.icon}</div>
          <div class="notif-card-body">
            <div class="notif-card-top">
              ${!n.is_read?'<span class="notif-card-new-dot"></span>':''}
              <span class="notif-card-title">${escHtml(n.title)}</span>
              <span class="notif-card-time">${timeAgo(n.created_at)}</span>
              <button type="button" title="Delete notification" onclick="event.stopPropagation();deleteNotifItem(${n.id})" style="margin-left:6px;background:none;border:none;color:var(--text-3);cursor:pointer;font-size:13px;padding:2px 6px;border-radius:6px">✕</button>
            </div>
            ${n.body ? `<div class="notif-card-msg">${escHtml(n.body)}</div>` : ''}
          </div>
        </div>`).join('');
    }).join('');
  }

  async function deleteNotifItem(id) {
    const { error } = await db.from('notifications').delete().eq('seller_id',effectiveSellerId).eq('id', id);
    if (error) { showToast('Could not delete: '+error.message,'error'); return; }
    notifItems = notifItems.filter(n => n.id !== id);
    renderNotifBell();
    renderNotificationsPage();
    showToast('Notification deleted','success');
  }

  // ── In-app per-category mute (Cross-Cutting enhancement) ──
  function mutedNotifCategoriesKey(){return 'ny_muted_notif_cats_'+(currentUser?.id||'');}
  function getMutedNotifCategories(){
    try{return new Set(JSON.parse(localStorage.getItem(mutedNotifCategoriesKey())||'[]'));}catch(e){return new Set();}
  }
  function setMutedNotifCategories(set){
    try{localStorage.setItem(mutedNotifCategoriesKey(),JSON.stringify([...set]));}catch(e){}
  }
  function isNotifCategoryMuted(type){return getMutedNotifCategories().has(notifCategoryFor(type));}
  function toggleMuteNotifCategory(catId){
    const muted=getMutedNotifCategories();
    if(muted.has(catId))muted.delete(catId);else muted.add(catId);
    setMutedNotifCategories(muted);
    renderNotifBell();
    renderNotificationsPage();
  }
  function renderNotifMuteStrip(){
    let host=document.getElementById('notif-mute-strip');
    const tabs=document.getElementById('notif-cat-tabs');
    if(!tabs)return;
    if(!host){
      host=document.createElement('div');
      host.id='notif-mute-strip';
      host.style.cssText='display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:-6px 0 16px;font-size:11.5px;color:var(--text-3)';
      tabs.insertAdjacentElement('afterend',host);
    }
    const muted=getMutedNotifCategories();
    host.innerHTML='<span style="font-weight:700;color:var(--text-2)">Mute in-app:</span>'+Object.entries(NOTIF_CATEGORY_META).map(([id,meta])=>{
      const isMuted=muted.has(id);
      return `<button type="button" onclick="toggleMuteNotifCategory('${id}')" style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;border:1.5px solid ${isMuted?'var(--border)':'var(--green)'};background:${isMuted?'var(--surface)':'var(--green-light)'};color:${isMuted?'var(--text-3)':'var(--green-dark)'};cursor:pointer">${meta.icon} ${escHtml(meta.label)}${isMuted?' (muted)':''}</button>`;
    }).join('');
  }

  // ── Notification grouping ("5 new messages" collapsed into one line) ──
  function renderSingleNotifCard(n,meta){
    return `<div class="notif-card-item ${n.is_read?'':'unread'}" id="notif-card-${n.id}" onclick="event.stopPropagation();openNotifItemFromPage(${n.id})">
      <div class="notif-card-icon">${NOTIF_ICON[n.type]||meta.icon}</div>
      <div class="notif-card-body">
        <div class="notif-card-top">
          ${!n.is_read?'<span class="notif-card-new-dot"></span>':''}
          <span class="notif-card-title">${escHtml(n.title)}</span>
          <span class="notif-card-time">${timeAgo(n.created_at)}</span>
          <button type="button" title="Delete notification" onclick="event.stopPropagation();deleteNotifItem(${n.id})" style="margin-left:6px;background:none;border:none;color:var(--text-3);cursor:pointer;font-size:13px;padding:2px 6px;border-radius:6px">✕</button>
        </div>
        ${n.body?`<div class="notif-card-msg">${escHtml(n.body)}</div>`:''}
      </div>
    </div>`;
  }
  function toggleNotifGroupChunk(gid){
    const el=document.getElementById(gid);
    if(el)el.style.display=el.style.display==='none'?'block':'none';
  }
  function renderGroupedNotifCards(){
    const listEl=document.getElementById('notif-groups-list');
    if(!listEl||!notifItems.length)return;
    const mutedCats=getMutedNotifCategories();
    const unreadOnly=document.getElementById('notif-unread-only')?.checked;
    let filtered = notifPageFilter==='all' ? notifItems : notifItems.filter(n=>notifCategoryFor(n.type)===notifPageFilter);
    filtered = filtered.filter(n=>!mutedCats.has(notifCategoryFor(n.type)));
    if(unreadOnly) filtered = filtered.filter(n=>!n.is_read);
    if(!filtered.length){
      listEl.innerHTML = `<div class="notif-empty-state"><svg viewBox="0 0 24 24"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg><h3 style="font-size:15px;font-weight:600;color:var(--text-2)">${mutedCats.size?'Nothing here — some categories are muted':'Nothing in this category'}</h3></div>`;
      return;
    }
    const groups={};
    filtered.forEach(n=>{const c=notifCategoryFor(n.type);(groups[c]=groups[c]||[]).push(n);});
    const orderedCats=Object.keys(NOTIF_CATEGORY_META).filter(c=>groups[c]);
    listEl.innerHTML = orderedCats.map(c=>{
      const meta=NOTIF_CATEGORY_META[c];
      const items=groups[c];
      const chunks=[];
      let i=0;
      while(i<items.length){
        let j=i;
        while(j<items.length && items[j].type===items[i].type) j++;
        chunks.push(items.slice(i,j));
        i=j;
      }
      const bodyHtml=chunks.map((run,ci)=>{
        if(run.length>=3){
          const unreadInRun=run.filter(n=>!n.is_read).length;
          const gid=`notifgrp-${c}-${ci}`;
          return `<div class="notif-card-item" style="cursor:pointer" onclick="toggleNotifGroupChunk('${gid}')">
            <div class="notif-card-icon">${NOTIF_ICON[run[0].type]||meta.icon}</div>
            <div class="notif-card-body">
              <div class="notif-card-top">
                ${unreadInRun?'<span class="notif-card-new-dot"></span>':''}
                <span class="notif-card-title">${run.length} ${escHtml(meta.label)} notifications</span>
                <span class="notif-card-time">${timeAgo(run[0].created_at)}</span>
              </div>
              <div class="notif-card-msg">${unreadInRun?unreadInRun+' unread · ':''}Tap to expand</div>
            </div>
          </div>
          <div id="${gid}" style="display:none;padding-left:12px;border-left:2px solid var(--border);margin:0 0 8px 19px">
            ${run.map(n=>renderSingleNotifCard(n,meta)).join('')}
          </div>`;
        }
        return run.map(n=>renderSingleNotifCard(n,meta)).join('');
      }).join('');
      return `<div class="notif-group">
        <div class="notif-group-head"><h3>${meta.icon} ${escHtml(meta.label)}</h3><span class="ngh-count">${items.length}</span></div>
        ${bodyHtml}
      </div>`;
    }).join('');
  }
  const _origRenderNotificationsPage = renderNotificationsPage;
  renderNotificationsPage = function(){
    _origRenderNotificationsPage();
    renderNotifMuteStrip();
    renderGroupedNotifCards();
  };

  async function openNotifItemFromPage(id) {
    const n = notifItems.find(x => x.id === id);
    if (n && !n.is_read) {
      const{error}=await db.from('notifications').update({ is_read: true }).eq('seller_id',effectiveSellerId).eq('id', id);
      if(error){console.error('Could not mark notification as read:',error);showToast('Could not update this notification. Please try again.','error');return;}
      n.is_read = true; renderNotifBell(); renderNotificationsPage();
    }
    // Silent by default — just re-highlight the card in place.
    document.getElementById('notif-card-' + id)?.classList.add('notif-card-highlight');
    // Only listing-related notifications navigate, straight to the listing.
    if (n && LISTING_NOTIF_TYPES.has(n.type) && n.link) {
      { const s = safeInternalLink(n.link); if (s) window.location.href = s; }
    }
  }

// Returns the owner's id if the caller is an active team member,
// otherwise the caller's own id. Everything that scopes to "this seller's
// data" should use effectiveSellerId, not currentUser.id.
async function resolveEffectiveSeller(){
  const{data,error}=await db.from('team_members').select('owner_id').eq('member_id',currentUser.id).eq('status','active').maybeSingle();
  if(error) throw new Error(`Could not verify team membership: ${error.message}`);
  if(data && data.owner_id){
    effectiveSellerId = data.owner_id;
    isTeamMember = true;
  } else {
    effectiveSellerId = currentUser.id;
    isTeamMember = false;
  }
}

// Writes a business-level profile field (subscription, notifications toggle,
// verification, storefront slug, etc.) to the OWNER's profile row, and keeps
// the in-memory ownerProfile/currentProfile in sync. Use this instead of
// writing straight to currentUser.id for anything that should apply
// account-wide rather than to just the person clicking the toggle.
async function updateOwnerProfile(patch){
  const{error}=await db.from('profiles').update(patch).eq('id',effectiveSellerId);
  if(!error){
    ownerProfile={...ownerProfile,...patch};
    if(!isTeamMember) currentProfile=ownerProfile;
  }
  return error;
}

async function compressImage(file,maxDim=1600,quality=0.82){
  if(!file.type.startsWith('image/')||file.size<400*1024)return file;
  try{
    const bmp=await createImageBitmap(file,{imageOrientation:'from-image'});
    const s=Math.min(1,maxDim/Math.max(bmp.width,bmp.height));
    const c=document.createElement('canvas');c.width=Math.round(bmp.width*s);c.height=Math.round(bmp.height*s);
    c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
    const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',quality));
    return blob&&blob.size<file.size?new File([blob],file.name.replace(/\.\w+$/,'')+'.jpg',{type:'image/jpeg'}):file;
  }catch(e){return file;}
}

// If the profile row is gone (e.g. the account was deleted from another
// device/tab), the current session can still look "valid" for a while —
// Supabase doesn't instantly invalidate an already-issued access token when
// a row is deleted. Signs out and sends the person to login instead of
// silently continuing with a null profile.
async function handleDeletedAccount(){
  try{
    const{error}=await db.auth.signOut();
    if(error) throw error;
  }catch(error){
    console.error('Could not clear the deleted account session:',error);
  }
  window.location.href='/login?deleted=1';
}

// Lightweight existence check reused by the periodic status poll below, so
// a deletion is caught even if the seller never refreshes the tab.
async function verifyAccountStillActive(){
  if(!currentUser)return;
  const{count,error}=await db.from('profiles').select('id',{count:'exact',head:true}).eq('id',currentUser.id);
  if(!error && count===0){ await handleDeletedAccount(); }
}

let PLATFORM_VERIFY_SETTINGS = { enforce_verification_general: 0, unverified_listing_limit: 2 };
let STOREFRONT_FREE_ENABLED=false;
let VIEWING_FEE_POLICY_VERSION='v1',VIEWING_FEE_MAX=5000,VIEWING_FEE_REQUIRES_IDENTITY=true;
async function loadPlatformVerifySettings(){
  const{data,error}=await db.from('platform_settings').select('key,value').in('key',['enforce_verification_general','unverified_listing_limit','viewing_fee_policy_version','viewing_fee_max','viewing_fee_requires_identity','storefront_free_enabled']);
  if(error) throw new Error(`Could not load verification settings: ${error.message}`);
  (data||[]).forEach(r=>{
    if(r.key==='storefront_free_enabled')STOREFRONT_FREE_ENABLED=Number(r.value)===1;
    else if(r.key==='viewing_fee_policy_version')VIEWING_FEE_POLICY_VERSION=String(r.value??'v1');
    else if(r.key==='viewing_fee_max')VIEWING_FEE_MAX=Math.min(5000,Number(r.value)||5000);
    else if(r.key==='viewing_fee_requires_identity')VIEWING_FEE_REQUIRES_IDENTITY=Number(r.value)!==0;
    else PLATFORM_VERIFY_SETTINGS[r.key]=Number(r.value);
  });
}
function verificationEnforcedForMe(){
  return Number(PLATFORM_VERIFY_SETTINGS.enforce_verification_general)===1 || !!currentProfile?.verification_enforced;
}

async function loadProfile(){
  const{data,error}=await db.from('profiles').select('*').eq('id',currentUser.id).single();
  if(error?.code==='PGRST116'||(!error&&!data)){
    await handleDeletedAccount();
    throw new Error('account_deleted');
  }
  if(error) throw new Error(`Could not load your profile: ${error.message}`);
  currentProfile=data;
  renderAccountType();
  await Promise.all([loadAccountRoleHistory(),loadCompanyProfileForSettings()]);
  const email=currentUser.email||'';
  const name=(data&&data.full_name)?data.full_name:email.split('@')[0];
  const initials=name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()||'?';
  document.getElementById('sidebar-avatar').textContent=initials;
  document.getElementById('sidebar-name').textContent=name;
  document.getElementById('sidebar-email').textContent=email;
  document.getElementById('settings-avatar').textContent=initials;
  document.getElementById('settings-fullname').textContent=name;
  document.getElementById('settings-email-display').textContent=email;

  document.getElementById('notif-enquiry').checked = data?.notif_enquiry !== false;
  document.getElementById('notif-approved').checked = data?.notif_approved !== false;
  document.getElementById('notif-expiring').checked = data?.notif_expiring !== false;
  document.getElementById('notif-payment').checked = data?.notif_payment !== false;
  const weeklyEl = document.getElementById('notif-weekly-digest');
  if (weeklyEl) weeklyEl.checked = !!data?.notif_weekly_digest;

  loadVerificationUI();

  const sidebarBadge = document.getElementById('sidebar-verify-badge');
  if (sidebarBadge) sidebarBadge.textContent = data?.verification_status === 'verified' ? '✓ Verified' : 'Unverified';

  if(isTeamMember){
    const{data:owner,error:ownerError}=await db.from('profiles').select('*').eq('id',effectiveSellerId).single();
    if(ownerError||!owner) throw new Error(`Could not load the account owner's profile: ${ownerError?.message||'profile not found'}`);
    ownerProfile=owner;
  }else{
    ownerProfile=currentProfile;
  }
  renderAccountType();
  renderViewingFeeSettings();

  // These are account-wide (owner) settings, not per-login — must read
  // from ownerProfile so a team member sees the OWNER's real settings,
  // not their own (irrelevant) profile row.
  const conciergeToggle = document.getElementById('concierge-toggle');
  if (conciergeToggle) conciergeToggle.checked = !!ownerProfile?.concierge_enabled;
  const smsToggle = document.getElementById('sms-alerts-toggle');
  if (smsToggle) smsToggle.checked = !!ownerProfile?.sms_alerts_enabled;
  const conciergeNote = document.getElementById('concierge-note');
  if (conciergeNote) conciergeNote.textContent = ownerProfile?.concierge_enabled
    ? "On — our team can now reply to your buyer messages for you. You'll still see everything in your Messages tab."
    : 'Off — you handle all your own enquiries.';

  const hideContactToggle = document.getElementById('hide-contact-toggle');
  if (hideContactToggle) hideContactToggle.checked = !!ownerProfile?.hide_buyer_contact;
  const hideContactNote = document.getElementById('hide-contact-note');
  if (hideContactNote) hideContactNote.textContent = ownerProfile?.hide_buyer_contact
    ? 'On — every listing shows "Chat only" to buyers. Call/WhatsApp buttons are hidden platform-wide.'
    : 'Off — buyers can reveal your number to call or WhatsApp you (rate-limited for your safety).';

  updateVerifyWarningBanner();
  loadSubscriptionUI();
}

function renderAccountType(){
  const roleProfile=isTeamMember?(ownerProfile||currentProfile):currentProfile;
  const accountType=ACCOUNT_TYPES.includes(roleProfile?.account_type)?roleProfile.account_type:null;
  document.querySelectorAll('input[name="account-type"]').forEach(input=>{input.checked=input.value===currentProfile?.account_type;});
  const status=document.getElementById('account-role-status');
  const saveButton=document.getElementById('save-account-roles-btn');
  const options=document.getElementById('account-role-options');
  const pickerHint=document.getElementById('account-role-picker-hint');
  const roleLabel=document.getElementById('account-role-label');
  const roleDescription=document.getElementById('account-role-description');
  const roleVerification=document.getElementById('account-role-verification');
  const roleSetDate=document.getElementById('account-role-set-date');
  const roleChangeButton=document.getElementById('change-account-role-btn');
  const roleVerifyButton=document.getElementById('verify-account-role-btn');
  const sidebarRoleChip=document.getElementById('sidebar-role-chip');
  const bulkSetFeeButton=document.getElementById('bulk-set-viewing-fee-btn');
  const bulkClearFeeButton=document.getElementById('bulk-clear-viewing-fee-btn');
  const companySection=document.getElementById('company-profile-settings');
  const onboardingReminder=document.getElementById('account-onboarding-reminder');
  const buyerMode=accountType==='buyer';
  const buyerCard=document.getElementById('buyer-mode-card');
  const roleVerified=!!accountType&&roleProfile?.verified_role===accountType;
  const feeEligible=['agent','company'].includes(roleProfile?.account_type);
  const policyAccepted=roleProfile?.viewing_fee_policy_version===VIEWING_FEE_POLICY_VERSION&&!!roleProfile?.viewing_fee_policy_accepted_at;
  if(bulkSetFeeButton)bulkSetFeeButton.hidden=!feeEligible||!policyAccepted||VIEWING_FEE_REQUIRES_IDENTITY&&roleProfile?.verification_status!=='verified'||roleProfile?.viewing_fee_blocked===true;
  if(bulkClearFeeButton)bulkClearFeeButton.hidden=!feeEligible;
  if(sidebarRoleChip)sidebarRoleChip.textContent=accountType
    ?`${ACCOUNT_ROLE_LABELS[accountType]}${roleVerified?' ✓':' (not verified)'}`
    :'Role not selected';
  if(roleLabel)roleLabel.textContent=accountType?ACCOUNT_ROLE_LABELS[accountType]:'Choose a role';
  if(roleDescription)roleDescription.textContent=accountType?ACCOUNT_ROLE_DESCRIPTIONS[accountType]:'Choose one role to tailor your Nyumba254 experience.';
  if(roleVerification)roleVerification.textContent=accountType?(roleVerified?`Verified ${ACCOUNT_ROLE_LABELS[accountType]} ✓`:`${ACCOUNT_ROLE_LABELS[accountType]} (not verified)`):'';
  if(roleSetDate)roleSetDate.textContent=roleProfile?.account_type_set_at?`Role set ${roleDate(roleProfile.account_type_set_at)}`:'';
  if(roleChangeButton)roleChangeButton.hidden=!accountType||isTeamMember;
  if(roleVerifyButton)roleVerifyButton.hidden=!accountType||roleVerified||isTeamMember;
  if(options)options.hidden=!!accountType;
  if(pickerHint)pickerHint.hidden=!!accountType;
  if(saveButton)saveButton.hidden=!!accountType;
  if(companySection)companySection.hidden=accountType!=='company';
  renderViewingFeeSettings();
  if(onboardingReminder)onboardingReminder.hidden=!!currentProfile?.onboarding_completed;
  if(buyerCard)buyerCard.hidden=!buyerMode;
  ['nav-listings','nav-enquiries','nav-viewings','nav-reviews','nav-payments','nav-rent-ledger','nav-demand-heatmap','nav-elite-section','nav-premium-upgrade'].forEach(id=>{
    const element=document.getElementById(id);if(element)element.hidden=buyerMode;
  });
  ['btn-new-listing-tour','btn-new-listing-small','btn-add-listing-empty'].forEach(id=>{
    const element=document.getElementById(id);if(element)element.hidden=buyerMode;
  });
  document.querySelectorAll('#page-overview > *').forEach(element=>{element.hidden=buyerMode&&!element.contains(buyerCard);});
  document.querySelectorAll('#overview-grid > *').forEach(element=>{element.hidden=buyerMode&&!element.contains(buyerCard);});
  const activityCard=document.getElementById('overview-activity-card');
  activityCard?.querySelectorAll(':scope > *:not(#buyer-mode-card):not(#account-onboarding-reminder)').forEach(element=>{element.hidden=buyerMode;});
  window.syncAccountTypeNavigation?.();
  if(saveButton)saveButton.textContent='Complete account setup';
  if(!status)return;
  if(!currentProfile?.onboarding_completed){
    status.textContent='Choose one account type to complete account setup. You can still browse while you decide.';
    return;
  }
  status.textContent=isTeamMember?'This role is managed by your company account.':`Your role is ${ACCOUNT_ROLE_LABELS[accountType]}.`;
  renderRoleTrustOverview();
}

function renderViewingFeeSettings(){
  const section=document.getElementById('viewing-fee-settings');
  if(!section)return;
  const profile=ownerProfile||currentProfile;
  const eligible=profile?.account_type==='agent'||profile?.account_type==='company';
  section.hidden=!eligible||isTeamMember;
  const input=document.getElementById('viewing-fee-default');
  if(input){input.max=String(VIEWING_FEE_MAX);input.setAttribute('aria-describedby','viewing-fee-status');}
  if(input&&document.activeElement!==input)input.value=profile?.default_viewing_fee??'';
  const accepted=document.getElementById('viewing-fee-policy-accepted');
  if(accepted)accepted.checked=profile?.viewing_fee_policy_version===VIEWING_FEE_POLICY_VERSION&&!!profile?.viewing_fee_policy_accepted_at;
}

function renderRoleTrustOverview(){
  const target=document.getElementById('overview-role-trust-content');
  if(!target)return;
  const profile=ownerProfile||currentProfile;
  const role=ACCOUNT_TYPES.includes(profile?.account_type)?ACCOUNT_ROLE_LABELS[profile.account_type]:'Not selected';
  const roleVerified=profile?.verified_role===profile?.account_type&&!!profile?.account_type;
  const identityVerified=profile?.verification_status==='verified';
  const count=allListings.filter(listing=>listing.status==='active'&&!listing.is_disabled&&!listing.recycle_bin).length;
  const limit=Number(PLATFORM_VERIFY_SETTINGS.unverified_listing_limit)||2;
  const next=!profile?.account_type?'Choose your role in Settings.':
    profile.account_type==='buyer'?'Browse listings, save favourites and contact listers.':
    !identityVerified?'Verify your identity to increase the applicable listing cap.':
    !roleVerified?'Submit role-specific evidence to verify your current role.':
    'Your identity and current role are verified.';
  const cap=`${count} active${identityVerified?' (no unverified cap)':` of ${limit} unverified listing cap`}`;
  const checklistKey=`ny_role_checklist_dismissed_${currentUser?.id||''}`;
  let checklistDismissed=false;
  try{checklistDismissed=localStorage.getItem(checklistKey)==='1'}catch(error){console.error('Could not read onboarding checklist preference:',error)}
  const feeStepNeeded=['agent','company'].includes(profile?.account_type);
  const feeStepDone=(profile?.default_viewing_fee!==null&&profile?.default_viewing_fee!==undefined)
    ||(profile?.viewing_fee_policy_version===VIEWING_FEE_POLICY_VERSION&&allListings.some(listing=>Number(listing.viewing_fee)>0));
  const steps=[
    {label:'Verify your identity',done:identityVerified,action:"settingsJumpTo('verification-settings-section')"},
    {label:'Add your first listing',done:allListings.length>0,action:"location.href='/post-listing'"},
    ...(feeStepNeeded?[{label:'Set a viewing-fee default or keep viewings free',done:feeStepDone,action:"settingsJumpTo('viewing-fee-settings')"}]:[])
  ];
  const checklist=profile?.account_type&&profile.account_type!=='buyer'&&!checklistDismissed
    ?`<div class="card" style="padding:14px;margin-top:14px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><strong style="font-size:13px">Getting started</strong><button type="button" class="btn btn-outline btn-sm" onclick="dismissRoleSetupChecklist()" aria-label="Dismiss getting started checklist">Dismiss</button></div><ol style="margin:8px 0 0;padding-left:20px">${steps.map(step=>`<li style="margin:7px 0;font-size:12px;color:var(--text-2)"><span>${step.done?'✓':'○'} ${escHtml(step.label)}</span>${step.done?'':` <button type="button" class="link" onclick="${step.action}" style="min-height:44px">${step.action.includes('post-listing')?'Add a listing':'Continue'}</button>`}</li>`).join('')}</ol></div>`
    :'';
  target.innerHTML=`<div style="display:flex;gap:10px;flex-wrap:wrap"><span><strong>Role:</strong> ${escHtml(role)}</span><span><strong>Role verification:</strong> ${escHtml(roleVerified?'Verified':'Not verified')}</span><span><strong>Identity:</strong> ${escHtml(identityVerified?'Verified':'Not verified')}</span><span><strong>Listing cap used:</strong> ${escHtml(cap)}</span></div><p style="margin:8px 0 0;color:var(--text-2);font-size:12px">${escHtml(next)}</p>${checklist}`;
}

function dismissRoleSetupChecklist(){
  try{localStorage.setItem(`ny_role_checklist_dismissed_${currentUser?.id||''}`,'1')}
  catch(error){console.error('Could not save onboarding checklist preference:',error);showToast('Could not save this checklist preference on this device.','error');return}
  renderRoleTrustOverview();
}

async function acceptCurrentViewingFeePolicy(){
  const checkbox=document.getElementById('viewing-fee-policy-accepted');
  if(!checkbox?.checked)throw new Error('Read and accept the Viewing Fee Policy before setting a fee.');
  const{error}=await db.rpc('accept_viewing_fee_policy',{p_policy_version:VIEWING_FEE_POLICY_VERSION});
  if(error)throw new Error(error.message);
  currentProfile={...currentProfile,viewing_fee_policy_version:VIEWING_FEE_POLICY_VERSION,viewing_fee_policy_accepted_at:new Date().toISOString()};
  if(ownerProfile?.id===currentUser.id)ownerProfile=currentProfile;
  renderAccountType();
}

async function saveViewingFeeDefault(){
  const input=document.getElementById('viewing-fee-default'),status=document.getElementById('viewing-fee-status');
  if(!input||!status)return;
  const raw=input.value.trim(),value=raw===''?null:Number(raw);
  if(value!==null&&(!Number.isInteger(value)||value<0||value>VIEWING_FEE_MAX)){
    status.textContent=`Enter a whole-number amount from KES 0 to KES ${VIEWING_FEE_MAX.toLocaleString('en-KE')}, or leave it blank.`;
    showToast(status.textContent,'error');return;
  }
  try{
    if(value>0)await acceptCurrentViewingFeePolicy();
    const{error}=await db.from('profiles').update({default_viewing_fee:value}).eq('id',currentUser.id);
    if(error)throw new Error(`Could not save your default viewing fee: ${error.message}`);
    currentProfile={...currentProfile,default_viewing_fee:value};
    ownerProfile=currentProfile;
    status.textContent=value===null?'Default cleared.':'Default saved.';
    showToast('Viewing fee default saved ✓','success');
  }catch(error){
    console.error('[viewing-fee] Default fee update failed:',error);
    status.textContent=error.message||'Could not save your default viewing fee.';
    showToast(status.textContent,'error');
  }
}

async function applyViewingFeeToActiveListings(){
  const input=document.getElementById('viewing-fee-default'),status=document.getElementById('viewing-fee-status');
  if(!input||!status)return;
  const value=input.value.trim()===''?0:Number(input.value);
  if(!Number.isInteger(value)||value<0||value>VIEWING_FEE_MAX){
    status.textContent=`Enter a whole-number amount from KES 0 to KES ${VIEWING_FEE_MAX.toLocaleString('en-KE')} first.`;
    showToast(status.textContent,'error');return;
  }
  const confirmed=window.confirm(`Apply KES ${value.toLocaleString('en-KE')} viewing fee to all your active listings? Existing active listing fees will be replaced.`);
  if(!confirmed)return;
  try{
    if(value>0)await acceptCurrentViewingFeePolicy();
    const ids=allListings.filter(l=>l.status==='active'&&!l.is_disabled&&!l.recycle_bin).map(l=>l.id);
    const{error}=await db.rpc('set_listing_viewing_fees',{p_listing_ids:ids,p_viewing_fee:value});
    if(error)throw new Error(`Could not apply the fee to active listings: ${error.message}`);
    await loadAllData();
    status.textContent='Fee applied to active listings.';
    showToast('Viewing fee applied to active listings ✓','success');
  }catch(error){
    console.error('[viewing-fee] Active-listing fee update failed:',error);
    status.textContent=error.message||'Could not apply the fee to active listings.';
    showToast(status.textContent,'error');
  }
}

async function loadAccountRoleHistory(){
  const target=document.getElementById('account-role-history');
  if(!target)return;
  const{data,error}=await db.from('role_history').select('previous_account_type,new_account_type,changed_at').eq('profile_id',currentUser.id).order('changed_at',{ascending:false}).limit(3);
  if(error)throw new Error(`Could not load account type history: ${error.message}`);
  if(!data?.length){target.textContent='No account type changes yet.';return;}
  target.replaceChildren();
  const heading=document.createElement('strong');
  heading.textContent='Recent account type changes';
  target.appendChild(heading);
  data.forEach(row=>{
    const item=document.createElement('div');
    const previous=row.previous_account_type||'Not set';
    item.textContent=`${ACCOUNT_ROLE_LABELS[previous]||previous} → ${ACCOUNT_ROLE_LABELS[row.new_account_type]||row.new_account_type} · ${roleDate(row.changed_at)}`;
    target.appendChild(item);
  });
}

async function loadCompanyProfileForSettings(){
  const section=document.getElementById('company-profile-settings');
  if(!section)return;
  section.hidden=currentProfile?.account_type!=='company';
  if(section.hidden)return;
  const{data,error}=await db.from('company_profiles').select('company_name,company_type,registration_number,logo_url,description,website').eq('profile_id',currentUser.id).maybeSingle();
  if(error)throw new Error(`Could not load company profile: ${error.message}`);
  const values={
    'company-name':data?.company_name||'',
    'company-type':data?.company_type||'agency',
    'company-registration':data?.registration_number||'',
    'company-logo':data?.logo_url||'',
    'company-description':data?.description||'',
    'company-website':data?.website||''
  };
  Object.entries(values).forEach(([id,value])=>{const field=document.getElementById(id);if(field)field.value=value;});
}

async function saveAccountType(){
  const accountType=document.querySelector('input[name="account-type"]:checked')?.value;
  const status=document.getElementById('account-role-status');
  if(!ACCOUNT_TYPES.includes(accountType)){if(status)status.textContent='Choose one account type before saving.';showToast('Choose one account type.','error');return;}
  const button=document.getElementById('save-account-roles-btn');
  if(button){button.disabled=true;button.textContent='Saving…';}
  try{
    const{data,error}=await db.rpc('change_account_type',{p_account_type:accountType});
    if(error)throw new Error(`Could not save your account type: ${error.message}`);
    const result=Array.isArray(data)?data[0]:data;
    const{data:profile,error:profileError}=await db.from('profiles').select('*').eq('id',currentUser.id).single();
    if(profileError)throw new Error(`Your role was saved, but could not be refreshed: ${profileError.message}`);
    currentProfile={...currentProfile,...result,...profile,account_type:accountType,onboarding_completed:true};
    renderAccountType();
    await Promise.all([loadAccountRoleHistory(),loadCompanyProfileForSettings()]);
    showToast('Your account type was saved ✓','success');
  }catch(error){
    console.error('Account type update failed:',error);
    if(status)status.textContent=error.message||'Could not save your account type.';
    showToast(error.message||'Could not save your account type.','error');
  }finally{
    if(button){button.disabled=false;button.textContent=currentProfile?.onboarding_completed?'Save account type':'Complete account setup';}
  }
}

let pendingAccountType=null;
let pendingRoleChangeRequest=false;
function openChangeRoleModal(){
  const profile=isTeamMember?(ownerProfile||currentProfile):currentProfile;
  if(!profile?.account_type||isTeamMember)return;
  const lockedUntil=profile.account_type_cooldown_until?new Date(profile.account_type_cooldown_until):null;
  const locked=!!lockedUntil&&lockedUntil>Date.now();
  const options=document.getElementById('change-role-options');
  const notice=document.getElementById('change-role-locked');
  const confirmStep=document.getElementById('change-role-confirm-step');
  const status=document.getElementById('change-role-status');
  const confirm=document.getElementById('change-role-confirm');
  pendingAccountType=null;
  pendingRoleChangeRequest=locked;
  status.textContent='';
  confirmStep.hidden=true;
  notice.hidden=!locked;
  notice.textContent=locked?`Locked until ${roleDate(lockedUntil)}. If you believe this is a mistake, contact support.`:'';
  if(locked)notice.innerHTML=`Role changes are locked until ${escHtml(roleDate(lockedUntil))}. Select the accurate role below to request an admin-reviewed correction.`;
  options.replaceChildren();
  ACCOUNT_TYPES.forEach(type=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='role-choice';
    button.disabled=type===profile.account_type;
    button.setAttribute('aria-pressed','false');
    button.dataset.role=type;
    const current=type===profile.account_type;
    button.innerHTML=`<strong>${escHtml(ACCOUNT_ROLE_LABELS[type])}${current?' · Current role':''}</strong><span>${escHtml(ACCOUNT_ROLE_DESCRIPTIONS[type])}</span>`;
    button.addEventListener('click',()=>{
      if(current)return;
      pendingAccountType=type;
      options.querySelectorAll('button').forEach(card=>card.setAttribute('aria-pressed',String(card===button)));
      confirmStep.hidden=false;
      const requestReason=document.getElementById('change-role-reason-wrap');
      const confirmCopy=document.getElementById('change-role-confirm-copy');
      const reasonField=document.getElementById('change-role-reason');
      if(requestReason)requestReason.hidden=!locked;
      if(reasonField)reasonField.value='';
      if(confirmCopy)confirmCopy.textContent=locked
        ?`Request an administrator to correct your role to ${ACCOUNT_ROLE_LABELS[type]}. Your role will not change unless the request is approved.`
        :'This uses your change for the next 7 days. Continue?';
      confirm.textContent=locked?'Submit request':'Confirm';
      status.textContent='';
      confirm.focus();
    });
    options.appendChild(button);
  });
  document.getElementById('change-role-cancel').onclick=()=>{
    pendingAccountType=null;
    confirmStep.hidden=true;
    status.textContent='';
    options.querySelector('[aria-pressed="true"]')?.focus();
  };
  confirm.onclick=confirmAccountTypeChange;
  openModal('modal-change-role');
}

async function confirmAccountTypeChange(){
  if(!ACCOUNT_TYPES.includes(pendingAccountType))return;
  const button=document.getElementById('change-role-confirm');
  const status=document.getElementById('change-role-status');
  button.disabled=true;
  button.textContent='Saving…';
  status.textContent='';
  try{
    const nextType=pendingAccountType;
    if(pendingRoleChangeRequest){
      const reason=document.getElementById('change-role-reason')?.value.trim()||'';
      if(reason.length<10){status.textContent='Please explain the correction in at least 10 characters.';document.getElementById('change-role-reason')?.focus();return;}
      const{error}=await db.rpc('submit_account_type_change_request',{p_account_type:nextType,p_reason:reason});
      if(error)throw new Error(error.message);
      pendingAccountType=null;
      closeModal('modal-change-role');
      showToast('Role correction request sent to our team for review.','success');
      return;
    }
    const{data,error}=await db.rpc('change_account_type',{p_account_type:nextType});
    if(error)throw new Error(error.message);
    const result=Array.isArray(data)?data[0]:data;
    currentProfile={...currentProfile,...result,account_type:nextType,onboarding_completed:true,verified_role:null};
    if(!isTeamMember)ownerProfile=currentProfile;
    pendingAccountType=null;
    renderAccountType();
    closeModal('modal-change-role');
    let refreshWarning='';
    const{data:profile,error:profileError}=await db.from('profiles').select('*').eq('id',currentUser.id).single();
    if(profileError)refreshWarning=` Role changed successfully; refresh the page to load the latest role details.`;
    else{
      currentProfile=profile;
      if(!isTeamMember)ownerProfile=profile;
      renderAccountType();
    }
    await loadAccountRoleHistory();
    await loadCompanyProfileForSettings();
    showToast(`Role changed to ${ACCOUNT_ROLE_LABELS[nextType]}.${refreshWarning}`,refreshWarning?'error':'success');
  }catch(error){
    console.error('Role change failed:',error);
    status.textContent=error.message||'Could not change your role.';
  }finally{
    button.disabled=false;
    button.textContent='Confirm';
  }
}

document.addEventListener('keydown',event=>{
  const dialog=document.getElementById('modal-change-role');
  if(!dialog?.classList.contains('open'))return;
  if(event.key==='Escape'){
    event.preventDefault();
    closeModal('modal-change-role');
    return;
  }
  if(event.key!=='Tab')return;
  const focusable=[...dialog.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),[tabindex]:not([tabindex="-1"])')].filter(el=>!el.hidden&&el.offsetParent!==null);
  if(!focusable.length)return;
  const first=focusable[0],last=focusable[focusable.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
});

async function saveCompanyProfile(){
  const status=document.getElementById('company-profile-status');
  const input=id=>document.getElementById(id)?.value.trim()||'';
  const companyName=input('company-name');
  if(companyName.length<2){if(status)status.textContent='Enter a company name with at least two characters.';return;}
  try{
    const{error}=await db.rpc('save_company_profile',{
      p_company_name:companyName,
      p_company_type:input('company-type'),
      p_registration_number:input('company-registration')||null,
      p_logo_url:input('company-logo')||null,
      p_description:input('company-description')||null,
      p_website:input('company-website')||null
    });
    if(error)throw new Error(`Could not save the company profile: ${error.message}`);
    const{data:company,error:reviewError}=await db.from('company_profiles').select('duplicate_review_required').eq('profile_id',currentUser.id).single();
    if(reviewError)throw new Error(`Company profile saved, but duplicate-review status could not be checked: ${reviewError.message}`);
    if(status)status.textContent=company.duplicate_review_required
      ?'Company profile saved. A similar verified company name needs admin review; the company verification badge and logo remain hidden until review.'
      :'Company profile saved. Company verification is reviewed separately.';
    showToast('Company profile saved ✓','success');
  }catch(error){
    console.error('Company profile update failed:',error);
    if(status)status.textContent=error.message||'Could not save the company profile.';
    showToast(error.message||'Could not save the company profile.','error');
  }
}

function updateVerifyWarningBanner(){
  const banner=document.getElementById('verify-warning-banner');
  if(!banner)return;
  const roleProfile=ownerProfile||currentProfile;
  const accountType=roleProfile?.account_type;
  const status=roleProfile?.verification_status||'unverified';
  const applies=!!accountType&&accountType!=='buyer'&&(
    status==='unverified'||status==='rejected'||roleProfile?.verified_role!==accountType
  );
  banner.style.display = applies ? 'flex' : 'none';
  if(applies){
    const limit = Number(PLATFORM_VERIFY_SETTINGS.unverified_listing_limit)||2;
    const textEl = banner.querySelector('span');
    const copy={
      owner:'Submit proof that you own the property to verify your Owner role.',
      agent:'Verify your identity and submit your Agent credentials to verify this role.',
      caretaker:'Submit a landlord authorization letter with the landlord’s name and phone to verify your Caretaker role.',
      company:'Submit company registration documents to verify your Company role.'
    };
    if(textEl)textEl.textContent=`${copy[accountType]||'Complete verification for your role.'} When verification limits apply, unverified accounts may post up to ${limit} active listings.`;
  }
}
function goToVerification(){
  openKycModal();
}
function goToRoleVerification(){
  window.open('/kyc.html#role-verification','_blank','noopener,noreferrer');
}
function openKycModal(){ openModal('modal-kyc'); }
function closeKycModal(){ closeModal('modal-kyc'); }
function openKycFullPage(){ window.open('/kyc.html','_blank','noopener,noreferrer'); }

// ── Subscription status — reads what the admin panel's Grant Premium
// modal writes (subscription_tier: 'monthly'/'yearly'/'none',
// subscription_plan: 'premium'/'elite', subscription_expires_at). ──
function subscriptionInfo(){
  const p = ownerProfile || currentProfile;
  const tier = p?.subscription_tier || 'none';
  const expiresAt = p?.subscription_expires_at;
  const notExpired = !expiresAt || new Date(expiresAt) > new Date();
  const active = tier !== 'none' && !!tier && notExpired;
  return { active, plan: active ? (p?.subscription_plan || 'premium') : null, expiresAt: active ? expiresAt : null };
}
function fmtSubDate(d){ return new Date(d).toLocaleDateString('en-KE',{day:'numeric',month:'short',year:'numeric'}); }
function confirmListingCategoryBeforeLeaving(){
  return true;
}

function loadSubscriptionUI(){
  const sub = subscriptionInfo();
  updatePremiumSectionUI(sub);
  updateEliteSectionUI(sub);
  syncProBadge(sub);
  updatePremiumNavBadge(sub);
  updateConciergeGate(sub);
  updateSmsAlertsGate(sub);
  updateEliteGatedPages(sub);
  loadRelationshipManager(sub);
  loadTeamSeats(sub);
  updateStorefrontBanner(sub);
  updateBnbStatusBanner();
}

// Surfaces the storefront link somewhere the seller can't miss it — a
// dedicated banner right at the top of Overview, not buried in Settings.
async function updateStorefrontBanner(sub){
  const card=document.getElementById('storefront-banner-card');
  if(!card)return;
  const isElite = sub.active && sub.plan==='elite';
  if(!isElite&&!STOREFRONT_FREE_ENABLED){card.style.display='none';return;}
  let slug;
  try{slug=await ensureStorefrontSlug();}
  catch(error){console.error('Could not prepare public storefront link:',error);showToast('Could not prepare your public storefront link. Please try again.','error');return;}
  const url = `${location.origin}/storefront?seller=${slug}`;
  const urlEl=document.getElementById('storefront-banner-url');
  const openEl=document.getElementById('storefront-banner-open');
  if(urlEl) urlEl.textContent = url.replace(/^https?:\/\//,'');
  if(openEl) openEl.href = url;
  card.style.display='block';
}

function teamSeatLimit(){
  const p = ownerProfile || currentProfile;
  if (p?.subscription_plan==='elite') return 5;
  return p?.subscription_tier==='yearly' ? 3 : 1;
}

async function loadTeamSeats(sub){
  const section=document.getElementById('settings-team-section');
  if(!section)return;
  if(!sub.active || isTeamMember){section.style.display='none';return;}
  section.style.display='block';
  const limit=teamSeatLimit();
  const{data,error}=await db.from('team_members').select('*').eq('owner_id',currentUser.id).order('invited_at',{ascending:false});
  const members=data||[];
  document.getElementById('team-seats-note').textContent=`${members.length} of ${limit} seat(s) used.`;
  document.getElementById('team-invite-btn').disabled=members.length>=limit;
  const listEl=document.getElementById('team-members-list');
  if(error){listEl.innerHTML=`<div style="font-size:12px;color:var(--red)">Could not load team: ${escHtml(error.message)}</div>`;return;}
  listEl.innerHTML=members.length?members.map(m=>`
    <div class="toggle-row">
      <div class="toggle-label"><strong>${escHtml(m.member_email)}</strong><span>${m.status==='active'?'Active — joined '+new Date(m.joined_at).toLocaleDateString('en-KE'):'Invited — awaiting sign-up'}</span></div>
      <button class="btn btn-outline btn-sm" style="color:var(--red);border-color:var(--red)" onclick="removeTeamMember(${m.id})">Remove</button>
    </div>`).join(''):'<div style="font-size:12.5px;color:var(--text-3)">No teammates invited yet.</div>';
}

async function inviteTeamMember(){
  const emailEl=document.getElementById('team-invite-email');
  const email=emailEl.value.trim();
  if(!email||!email.includes('@')){showToast('Please enter a valid email','error');return;}
  const limit=teamSeatLimit();
  const{count}=await db.from('team_members').select('*',{count:'exact',head:true}).eq('owner_id',currentUser.id);
  if((count||0)>=limit){showToast('You\'ve used all your team seats for this plan','error');return;}
  const btn=document.getElementById('team-invite-btn');btn.disabled=true;btn.textContent='Inviting…';
  const inviteToken=crypto.randomUUID();
  const{data:invite,error}=await db.from('team_members').insert({owner_id:currentUser.id,member_email:email,status:'invited',invite_token:inviteToken}).select().single();
  btn.disabled=false;btn.textContent='Invite';
  if(error){showToast('Could not invite: '+error.message,'error');return;}
  emailEl.value='';
  showToast('Invite sent ✓','success');
  fetch(`${EDGE_URL}/send-notification-email`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`},body:JSON.stringify({type:'team_invite',audience:'seller',sellerEmail:email,sellerName:email.split('@')[0],ownerName:currentProfile?.full_name||currentUser?.email,inviteToken:inviteToken})}).catch(()=>{});
  loadTeamSeats(subscriptionInfo());
}

async function removeTeamMember(id){
  if(!await lcConfirm({title:'Remove teammate?',message:'They will lose access immediately.',confirmLabel:'Remove',danger:true}))return;
  const{error}=await db.from('team_members').delete().eq('id',id);
  if(error){showToast('Could not remove: '+error.message,'error');return;}
  showToast('Removed','success');
  loadTeamSeats(subscriptionInfo());
}

async function loadRelationshipManager(sub){
  const section=document.getElementById('settings-rm-section');
  const content=document.getElementById('rm-content');
  if(!section||!content)return;
  if(!sub.active){section.style.display='none';return;}
  const ownerP = ownerProfile || currentProfile;
  if(ownerP?.subscription_tier!=='yearly'){
    section.style.display='block';
    content.textContent="You're in our priority support queue — support chats from monthly-plan sellers are answered ahead of the general queue. Upgrade to yearly for a named manager with a direct line.";
    return;
  }
  const{data}=await db.from('platform_settings').select('key,value').in('key',['rm_name','rm_phone']);
  const name=(data||[]).find(r=>r.key==='rm_name')?.value||'';
  const phone=(data||[]).find(r=>r.key==='rm_phone')?.value||'';
  section.style.display='block';
  if(!name&&!phone){content.textContent="Your relationship manager will be assigned shortly — we'll update this as soon as they're set.";return;}
  const normalizedPhone=phone.replace(/\D/g,'').replace(/^0/,'254');
  const validPhone=/^\d{9,15}$/.test(normalizedPhone);
  const waLink=validPhone?`https://wa.me/${normalizedPhone}`:null;
  content.innerHTML=`${escHtml(name)||'Your manager'} is your direct contact for anything on Nyumba254.${validPhone?` <a href="tel:${normalizedPhone}" style="color:var(--green);font-weight:600">Call ${escHtml(phone)}</a>`:''}${waLink?` · <a href="${waLink}" target="_blank" rel="noopener noreferrer" style="color:#25D366;font-weight:600">WhatsApp</a>`:''}`;
}

async function toggleDemandDigest(enabled){
  const error = await updateOwnerProfile({ demand_digest_enabled: enabled });
  if(error){ showToast('Could not update: '+error.message,'error'); document.getElementById('demand-digest-toggle').checked=!enabled; return; }
  showToast(enabled?'Weekly digest turned on ✓':'Weekly digest turned off','success');
  notifyInApp('demand_insights', enabled?'Weekly demand digest turned on':'Weekly demand digest turned off', enabled?"You'll get the top opportunity areas every Monday.":'You will no longer receive the weekly digest.');
}
async function toggleAiConcierge(enabled){
  const error = await updateOwnerProfile({ ai_concierge_enabled: enabled, ai_concierge_enabled_at: enabled ? new Date().toISOString() : null });
  if(error){ showToast('Could not update: '+error.message,'error'); document.getElementById('ai-concierge-toggle').checked=!enabled; return; }
  showToast(enabled?'AI Chat Concierge turned on ✓ — it will start answering routine buyer questions on your listings':'AI Chat Concierge turned off','success');
  notifyInApp('plan_feature', enabled?'24/7 AI Chat Concierge turned on':'AI Chat Concierge turned off', enabled?'It will now answer routine buyer questions on your listings automatically.':'Buyers will no longer get automatic AI answers.');
}
function eliteActive(){
  const sub = subscriptionInfo();
  return sub.active && sub.plan==='elite';
}

// Elite unlocks the full ledger suite (Rent Ledger, BNB Booking Ledger,
// Demand Insights, AI tools) regardless of plan_category. But a seller who
// has ONLY paid for a BNB plan (Basic/Bundle/Unlimited) — no Elite — should
// still get the Booking Ledger, since that's the entire point of the BNB
// plan. Demand Insights and the AI tools stay Elite-exclusive either way.
function ledgerAccessActive(){
  return eliteActive() || (isBnbLedgerMode() && bnbSubscriptionInfo().active);
}

function rentalCapacityActive(){ const p = ownerProfile || currentProfile; return !!p?.has_rental_capacity; }
function bnbCapacityActive(){ const p = ownerProfile || currentProfile; return !!p?.has_bnb_capacity; }
function isBnbLedgerMode(){
  // Default view when a seller has both: rental first, unless they only have BNB.
  if (rentalCapacityActive()) return ledgerViewOverride === 'bnb';
  return bnbCapacityActive();
}
let ledgerViewOverride = null;
function rlShowSkeleton(containerId){
  const el=document.getElementById(containerId);
  if(!el)return;
  el.innerHTML=`<div style="padding:30px;text-align:center;color:var(--text-3);font-size:13px">
    <div class="spinner-sm" style="border-top-color:var(--text-3);width:20px;height:20px;margin:0 auto 10px"></div>Loading…</div>`;
}
function setLedgerView(v){
  ledgerViewOverride = v;
  updateEliteGatedPages(subscriptionInfo());
  if(v==='bnb'){ rlShowSkeleton('bnb-properties-list'); loadBnbLedger(); }
  else { rlShowSkeleton('rental-units-list'); loadRentalUnits(); }
}
function updateEliteGatedPages(sub){
  const isElite = sub.active && sub.plan==='elite';
  const switcher = document.getElementById('rl-capacity-switcher');
  if (switcher) {
    const both = rentalCapacityActive() && bnbCapacityActive();
    switcher.style.display = both ? 'flex' : 'none';
    if (both) {
      document.getElementById('rl-switch-rental')?.classList.toggle('active', !isBnbLedgerMode());
      document.getElementById('rl-switch-bnb')?.classList.toggle('active', isBnbLedgerMode());
    }
  }
  const bnbMode = isBnbLedgerMode();
  const ledgerUnlocked = isElite || (bnbMode && bnbSubscriptionInfo().active);
  const rlLocked=document.getElementById('rent-ledger-locked'), rlContent=document.getElementById('rent-ledger-content');
  const bnbContent=document.getElementById('bnb-ledger-content');
  if(rlLocked){ rlLocked.style.display = ledgerUnlocked?'none':'block'; }
  if(rlContent) rlContent.style.display = (ledgerUnlocked && !bnbMode)?'block':'none';
  if(bnbContent) bnbContent.style.display = (ledgerUnlocked && bnbMode)?'block':'none';
  const rlHeadingEl=document.getElementById('rl-page-heading');
  const rlNavLabelEl=document.getElementById('nav-rent-ledger-label');
  if(rlHeadingEl) rlHeadingEl.textContent = bnbMode ? 'BNB Booking Ledger' : 'Rent & Tenant Ledger';
  if(rlNavLabelEl) rlNavLabelEl.textContent = bnbMode ? 'Booking Ledger' : 'Rent Ledger';
  const dhLocked=document.getElementById('demand-locked'), dhContent=document.getElementById('demand-content');
  if(dhLocked && dhContent){ dhLocked.style.display = ledgerUnlocked?'none':'block'; dhContent.style.display = ledgerUnlocked?'block':'none'; }
  const addUnitBtn=document.getElementById('btn-add-rental-unit');
  if(addUnitBtn) addUnitBtn.style.display = (ledgerUnlocked && !bnbMode)?'inline-flex':'none';
  const addBnbPropBtn=document.getElementById('btn-add-bnb-property');
  if(addBnbPropBtn) addBnbPropBtn.style.display = (ledgerUnlocked && bnbMode)?'inline-flex':'none';
  const addBnbBookingBtn=document.getElementById('btn-add-bnb-booking');
  if(addBnbBookingBtn) addBnbBookingBtn.style.display = (ledgerUnlocked && bnbMode)?'inline-flex':'none';
  const rlTourReplayBtn=document.getElementById('rl-tour-replay-btn');
  if(rlTourReplayBtn) rlTourReplayBtn.style.display = (ledgerUnlocked && !bnbMode)?'flex':'none';
  const digestRow=document.getElementById('demand-digest-row');
  if(digestRow){ digestRow.style.display = isElite?'flex':'none'; const dt=document.getElementById('demand-digest-toggle'); if(dt) dt.checked=!!currentProfile?.demand_digest_enabled; }
  const aiConciergeRow=document.getElementById('ai-concierge-row');
  if(aiConciergeRow){ aiConciergeRow.style.display = isElite?'flex':'none'; const act=document.getElementById('ai-concierge-toggle'); if(act) act.checked=!!currentProfile?.ai_concierge_enabled; }
  ['btn-export-rl-csv','btn-export-rl-pdf','btn-export-rl-annual','btn-remind-overdue','btn-reminder-settings'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display = (ledgerUnlocked && !bnbMode)?'inline-flex':'none';
  });
  ['btn-export-bnb-csv','btn-export-bnb-pdf'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display = (ledgerUnlocked && bnbMode)?'inline-flex':'none';
  });
  ['btn-export-di-csv','btn-export-di-pdf'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display = ledgerUnlocked?'inline-flex':'none';
  });
}

async function requestPlanCategorySwitch(){
  const p = ownerProfile || currentProfile;
  const current = p?.has_bnb_capacity ? 'bnb' : 'rental';
  const target = p?.has_bnb_capacity ? 'rental' : 'bnb';
  if(!await lcConfirm({title:'Request a plan change?',message:`Request ${target==='bnb'?'Airbnb/BNB':'rental'} listing capacity on top of what you have. This opens a support ticket so our team can confirm pricing first. Nothing is charged yet.`,confirmLabel:'Send request'})) return;
  const sessionKey = `seller_${currentUser.id}_plan_switch_${Date.now()}`;
  const { data, error } = await db.from('chat_sessions').insert({
    session_key: sessionKey, session_type:'seller', seller_id: currentUser.id, visitor_name: scwSellerName,
    page:'dashboard.html', topic:'Plan category switch request', status:'open', is_resolved:false, last_msg_at:new Date().toISOString(),
  }).select().single();
  if(error){ showToast('Could not start request: '+error.message,'error'); return; }
  await db.from('chat_messages').insert({ session_id:data.id, sender:'visitor', body:`I'd like to switch my plan from ${current} to ${target}. Please let me know if I owe anything or have credit.` });
  showToast('Request sent — check Messages for our reply ✓','success');
}
function updatePremiumSectionUI(sub){
  const btn = document.getElementById('premium-upgrade-btn');
  const banner = document.getElementById('premium-status-banner');
  if(!btn || !banner) return;
  const planP = ownerProfile || currentProfile;
  const catRow = document.getElementById('plan-category-row');
  if (catRow) {
    const caps = [];
    if (planP?.has_rental_capacity) caps.push('Sale & rental');
    if (planP?.has_bnb_capacity) caps.push('Airbnb / BNB');
    if (caps.length) {
      catRow.style.display = 'block';
      document.getElementById('plan-category-label').textContent = caps.join(' + ') + ' listings';
      document.getElementById('plan-balance-note').textContent = '';
    } else {
      catRow.style.display = 'none';
    }
  }
  if(sub.active){
    const exp = sub.expiresAt ? ` — renews/expires ${fmtSubDate(sub.expiresAt)}` : '';
    banner.style.display = 'block';
    banner.textContent = sub.plan==='elite' ? `✓ Included with your Elite plan${exp}` : `✓ Active${exp}`;
    btn.style.display = 'none';
  } else {
    banner.style.display = 'none';
    btn.style.display = 'inline-flex';
  }
}

async function syncProBadge(sub){
  const shouldBePro = !!sub.active; // any Premium or Elite subscriber
  const p = ownerProfile || currentProfile;
  if(p && p.is_pro !== shouldBePro){
    await updateOwnerProfile({ is_pro: shouldBePro });
  }
}

// ── Sidebar "Upgrade to Premium" link → Pro badge once subscribed ──
// - No active subscription: plain "Upgrade to Premium" link (as before).
// - Active Premium (not Elite): shows a Pro badge but stays clickable,
//   since a Premium seller can still upgrade further to Elite.
// - Active Elite: top tier — nothing left to upgrade to, so the link
//   becomes a static, disabled badge (no href, no click).
function goToPremiumSettings(e){
  if(e) e.preventDefault();
  showPage('settings');
  setTimeout(()=>settingsJumpTo('settings-premium-section'),80);
}
function bnbSubscriptionInfo(){
  const p = ownerProfile || currentProfile;
  const bnbPlanActive = !!(p?.bnb_plan && p?.bnb_expires_at && new Date(p.bnb_expires_at) > new Date());
  const active = bnbPlanActive || eliteActive();
  return { active, plan: bnbPlanActive ? p.bnb_plan : (eliteActive() ? 'elite_included' : null) };
}
function isNearChatBottom(){
  const mc=document.getElementById('chat-messages');if(!mc)return true;
  return mc.scrollHeight-mc.scrollTop-mc.clientHeight<120;
}
function handleChatScroll(){
  const btn=document.getElementById('chat-scroll-btn');
  if(btn)btn.style.display=isNearChatBottom()?'none':'flex';
}
function scrollChatToBottom(force){
  const mc=document.getElementById('chat-messages');if(!mc)return;
  if(force||isNearChatBottom())mc.scrollTop=mc.scrollHeight;
}

function updatePremiumNavBadge(sub){
  const link = document.getElementById('nav-premium-upgrade');
  const textEl = document.getElementById('nav-premium-upgrade-text');
  if(!link || !textEl) return;
  link.setAttribute('href','#');
  link.onclick = goToPremiumSettings;
  link.style.cursor = 'pointer';

  const bnb = bnbSubscriptionInfo();
  const bnbLabelMap = { bnb_basic:'BNB Basic', bnb_bundle:'BNB Bundle', bnb_unlimited:'BNB Unlimited' };
  const hasAnyActivePlan = (sub.active && (sub.plan==='elite' || sub.plan==='premium')) || bnb.active;
  // Matches the same highlighted look .nav-item.active gets when it's the
  // current page, so an active plan visually reads as "selected" in the
  // sidebar instead of just being plain dimmed text.
  link.style.background = hasAnyActivePlan ? 'rgba(255,255,255,0.12)' : 'none';
  link.style.color = hasAnyActivePlan ? 'white' : '';

  const navP = ownerProfile || currentProfile;
  const capSuffix = (navP?.has_rental_capacity && navP?.has_bnb_capacity) ? ' · Rental+BNB' : navP?.has_bnb_capacity ? ' · BNB' : navP?.has_rental_capacity ? ' · Rental' : '';
  if(sub.active && sub.plan==='elite'){
    textEl.innerHTML = `👑 Elite member${capSuffix}`;
    link.style.opacity = '1';
  } else if(sub.active && sub.plan==='premium'){
    textEl.innerHTML = `⭐ Pro${capSuffix} · Upgrade to Elite`;
    link.style.opacity = '1';
  } else if(bnb.active){
    // BNB-only seller (no Premium/Elite) — reflect the active BNB plan
    // instead of falling through to the generic "Upgrade to Premium" link.
    textEl.innerHTML = `🏠 ${bnbLabelMap[bnb.plan]||'BNB'} active`;
    link.style.opacity = '1';
  } else {
    textEl.textContent = 'Upgrade to Premium';
    link.style.opacity = '1';
  }
}

function updateEliteSectionUI(sub){
  const btn = document.getElementById('elite-upgrade-btn');
  const banner = document.getElementById('elite-status-banner');
  const storefrontRow = document.getElementById('storefront-link-row');
  const valuationBtn = document.getElementById('elite-valuation-btn');
  const aiListingBtn = document.getElementById('elite-ai-listing-btn');
  if(!btn || !banner) return;
  if(sub.active && sub.plan==='elite'){
    const exp = sub.expiresAt ? ` — renews/expires ${fmtSubDate(sub.expiresAt)}` : '';
    banner.style.display = 'block';
    banner.textContent = `✓ Active${exp}`;
    btn.style.display = 'none';
    if(storefrontRow){
      storefrontRow.style.display = 'block';
      ensureStorefrontSlug().then(slug=>{
        const url = `${location.origin}/storefront?seller=${slug}`;
        const urlEl=document.getElementById('storefront-settings-url');
        const openEl=document.getElementById('storefront-settings-open');
        if(urlEl) urlEl.textContent = url;
        if(openEl) openEl.href = url;
      });
    }
    if(valuationBtn) valuationBtn.style.display = 'inline-flex';
    if(aiListingBtn) aiListingBtn.style.display = 'inline-flex';
  } else {
    banner.style.display = 'none';
    btn.style.display = 'inline-flex';
    if(storefrontRow) storefrontRow.style.display = 'none';
    if(valuationBtn) valuationBtn.style.display = 'none';
    if(aiListingBtn) aiListingBtn.style.display = 'none';
  }
  const storefrontAvailable=(sub.active&&sub.plan==='elite')||STOREFRONT_FREE_ENABLED;
  if(storefrontRow)storefrontRow.style.display=storefrontAvailable?'block':'none';
  if(storefrontAvailable){
    ensureStorefrontSlug().then(slug=>{
      const url=`${location.origin}/storefront?seller=${slug}`;
      const urlEl=document.getElementById('storefront-settings-url');
      const openEl=document.getElementById('storefront-settings-open');
      if(urlEl)urlEl.textContent=url;
      if(openEl)openEl.href=url;
    }).catch(error=>console.error('Could not prepare public storefront link:',error));
  }
}

function slugifyName(name){
  return (name||'seller').toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g,'')
    .replace(/\s+/g,'-')
    .replace(/-+/g,'-')
    .replace(/^-|-$/g,'') || 'seller';
}

async function ensureStorefrontSlug(){
  const p = ownerProfile || currentProfile;
  if(p?.storefront_slug) return p.storefront_slug;
  const base = slugifyName(p?.full_name);
  let candidate = base;
  for(let i=0;i<20;i++){
    const{data:existing}=await db.from('profiles').select('id').eq('storefront_slug',candidate).maybeSingle();
    if(!existing || existing.id===effectiveSellerId) break;
    candidate = `${base}-${Math.floor(Math.random()*900+100)}`;
  }
  const err = await updateOwnerProfile({storefront_slug:candidate});
  if(err){ console.error('Could not save storefront slug:',err); return effectiveSellerId; }
  return candidate;
}

// ══════════════════════════════════════════════════════════════
// BNB BOOKING LEDGER (Elite + plan_category='bnb') — manual-entry
// booking tracker. Tables: bnb_properties, bnb_bookings.
// ══════════════════════════════════════════════════════════════
let bnbPropertiesCache=[];
let bnbGuestsCache=[];

async function loadBnbLedger(){
  if(!ledgerAccessActive())return;
  const wrap=document.getElementById('bnb-properties-list');
  wrap.innerHTML='<div style="padding:30px;text-align:center;color:var(--text-3);font-size:13px">Loading…</div>';
  const{data,error}=await db.from('bnb_properties').select('*, bnb_bookings(*)').eq('seller_id',effectiveSellerId).order('created_at',{ascending:false});
  if(error){wrap.innerHTML=`<div class="empty-state"><p>Could not load: ${escHtml(error.message)}</p></div>`;return;}
  bnbPropertiesCache=data||[];
  await bnbAutoExpireProperties();
  await rlLoadExtras();
  renderBnbExpiryAlerts();
  renderBnbSummary();
  renderBnbGoalCard();
  renderBnbUpcoming();
  renderBnbCleaningCard();
  renderBnbProperties();
  if(bnbActiveTab==='calendar') renderBnbCalendar();
  if(bnbActiveTab==='analytics') renderBnbAnalytics();
  if(bnbActiveTab==='guests') renderBnbGuests();
  if(bnbActiveTab==='finances') renderBnbFinances();
  if(bnbActiveTab==='maintenance') renderBnbMaintenance();
}
function renderBnbCleaningCard(){
  const queue=bnbCleaningQueue();
  if(!queue.length)return;
  const upcomingEl=document.getElementById('bnb-upcoming-card');
  if(!upcomingEl)return;
  const note=document.createElement('div');
  note.style.cssText='margin-top:14px;padding-top:14px;border-top:1px dashed var(--border)';
  note.innerHTML=`<h4 style="font-size:12.5px;font-weight:700;margin-bottom:8px">🧹 Needs cleaning (${queue.length})</h4>`+
    queue.map(({p,b})=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:12.5px"><span>${escHtml(p.property_label)} — checked out ${new Date(b.check_out).toLocaleDateString('en-KE',{day:'numeric',month:'short'})}</span><button class="btn btn-outline btn-sm" onclick="markBnbCleaningDone('${b.id}')">Mark cleaned</button></div>`).join('');
  upcomingEl.appendChild(note);
}

function exportBnbBookingsCSV(){
  const allBookings=bnbPropertiesCache.flatMap(p=>(p.bnb_bookings||[]).map(b=>({...b,_property:p.property_label})));
  if(!allBookings.length){showToast('No bookings to export','error');return;}
  const rows=[['Property','Guest','Phone','Email','Check-in','Check-out','Nights','Source','Total (KES)','Paid (KES)','Balance (KES)','Status','Cleaning']];
  allBookings.forEach(b=>{
    const nights=bnbNightsBetween(b.check_in,b.check_out);
    const balance=(Number(b.total_amount)||0)-(Number(b.amount_paid)||0);
    rows.push([b._property,b.guest_name,b.guest_phone||'',b.guest_email||'',b.check_in,b.check_out,nights,b.source,Number(b.total_amount)||0,Number(b.amount_paid)||0,balance,b.payment_status,b.cleaning_status||'pending']);
  });
  const csv=rows.map(r=>r.map(v=>csvCell(v)).join(',')).join('\n');
  rlDownloadBlob(`Nyumba254-BNB-Bookings-${localDateKey()}.csv`,csv,'text/csv');
  showToast('CSV exported ✓','success');
}

async function exportBnbRevenuePDF(){
  if(!bnbPropertiesCache.length){showToast('No properties to report on','error');return;}
  if(!await ensurePdfLibrary())return;
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'mm',format:'a4'});
  doc.setFillColor(124,58,237);doc.rect(0,0,210,24,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(16);doc.setTextColor(255,255,255);
  doc.text('Nyumba254 — BNB Revenue Report',14,15);
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(230,230,255);
  doc.text(`${currentProfile?.full_name||currentUser?.email||''} · Generated ${new Date().toLocaleDateString('en-KE',{day:'numeric',month:'long',year:'numeric'})}`,14,21);

  let y=34;
  const allBookings=bnbPropertiesCache.flatMap(p=>(p.bnb_bookings||[]).filter(b=>b.status!=='cancelled').map(b=>({...b,_property:p})));
  const totalRevenue=allBookings.reduce((s,b)=>s+(Number(b.amount_paid)||0),0);
  const totalNights=allBookings.reduce((s,b)=>s+bnbNightsBetween(b.check_in,b.check_out),0);
  const adr=totalNights>0?Math.round(totalRevenue/totalNights):0;
  doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(26,26,24);
  doc.text(`${bnbPropertiesCache.length} propert${bnbPropertiesCache.length!==1?'ies':'y'} · Total revenue KES ${totalRevenue.toLocaleString('en-KE')} · ADR KES ${adr.toLocaleString('en-KE')}`,14,y);
  y+=10;

  doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(255,255,255);
  doc.setFillColor(124,58,237);doc.rect(14,y-4,182,7,'F');
  doc.text('Property',16,y);doc.text('Bookings',95,y);doc.text('Nights',120,y);doc.text('Revenue (KES)',150,y);
  y+=7;
  doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(74,74,70);
  bnbPropertiesCache.forEach(p=>{
    if(y>280){doc.addPage();y=20;}
    const bookings=(p.bnb_bookings||[]).filter(b=>b.status!=='cancelled');
    const nights=bookings.reduce((s,b)=>s+bnbNightsBetween(b.check_in,b.check_out),0);
    const rev=bookings.reduce((s,b)=>s+(Number(b.amount_paid)||0),0);
    doc.text(String(p.property_label).slice(0,32),16,y);
    doc.text(String(bookings.length),95,y);
    doc.text(String(nights),120,y);
    doc.text(rev.toLocaleString('en-KE'),150,y);
    y+=6.5;
    doc.setDrawColor(230,230,230);doc.line(14,y-4.5,196,y-4.5);
  });
  doc.save(`Nyumba254-BNB-Revenue-Report-${new Date().toISOString().slice(0,10)}.pdf`);
  showToast('Revenue report downloaded ✓','success');
}

async function downloadBnbBookingReceiptPDF(bookingId){
  let found=null;
  bnbPropertiesCache.forEach(p=>{(p.bnb_bookings||[]).forEach(b=>{if(String(b.id)===String(bookingId))found={p,b};});});
  if(!found){showToast('Booking not found','error');return;}
  if(!await ensurePdfLibrary())return;
  const{jsPDF}=window.jspdf;
  const{p,b}=found;
  const doc=new jsPDF({unit:'mm',format:'a5'});
  doc.setFont('helvetica','bold');doc.setFontSize(18);doc.setTextColor(124,58,237);
  doc.text('Nyumba254',74,20,{align:'center'});
  doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(120,120,120);
  doc.text('BOOKING RECEIPT',74,27,{align:'center'});
  doc.setDrawColor(124,58,237);doc.line(15,32,133,32);
  let y=42;
  const row=(label,value)=>{doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(130,130,130);doc.text(label,15,y);doc.setFont('helvetica','bold');doc.setTextColor(26,26,24);doc.text(String(value),133,y,{align:'right'});y+=8;};
  const nights=bnbNightsBetween(b.check_in,b.check_out);
  row('Receipt No.','BNB-'+String(b.id).slice(0,8).toUpperCase());
  row('Date issued',new Date().toLocaleDateString('en-KE',{day:'numeric',month:'long',year:'numeric'}));
  row('Guest',b.guest_name);
  row('Property',p.property_label);
  row('Check-in',new Date(b.check_in).toLocaleDateString('en-KE',{day:'numeric',month:'long',year:'numeric'}));
  row('Check-out',new Date(b.check_out).toLocaleDateString('en-KE',{day:'numeric',month:'long',year:'numeric'}));
  row('Nights',nights);
  row('Booking source',(b.source||'—').replace('_',' '));
  row('Payment status',b.payment_status);
  doc.setDrawColor(224,222,216);doc.line(15,y,133,y);y+=10;
  doc.setFont('helvetica','bold');doc.setFontSize(14);doc.setTextColor(124,58,237);
  doc.text('Amount paid',15,y);
  doc.text(`KES ${Number(b.amount_paid||0).toLocaleString('en-KE')}`,133,y,{align:'right'});
  y+=8;
  const balance=(Number(b.total_amount)||0)-(Number(b.amount_paid)||0);
  if(balance>0){
    doc.setFontSize(10);doc.setTextColor(200,60,50);
    doc.text('Balance due',15,y);
    doc.text(`KES ${balance.toLocaleString('en-KE')}`,133,y,{align:'right'});
    y+=8;
  }
  y+=8;
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(150,150,150);
  doc.text(`Issued by ${currentProfile?.full_name||currentUser?.email||'Nyumba254 host'}`,74,y,{align:'center'});
  doc.save(`Nyumba254-Booking-Receipt-${b.guest_name.replace(/[^a-z0-9]+/gi,'-')}.pdf`);
  showToast('Receipt downloaded ✓','success');
}

function bnbActiveOrFutureBookings(p){
  const cutoff=new Date(Date.now()-30*86400000).toISOString().slice(0,10); // keep receipts reachable for 30 days after checkout
  return (p.bnb_bookings||[]).filter(b=>b.status!=='cancelled' && b.check_out>=cutoff).sort((a,b)=>new Date(a.check_in)-new Date(b.check_in));
}
function bnbNightsBetween(ci,co){ return Math.max(1,Math.round((new Date(co)-new Date(ci))/86400000)); }

function bnbDaysUntilExpiry(p){
  if(!p.plan_expires_at)return null;
  return Math.ceil((new Date(p.plan_expires_at)-new Date())/86400000);
}
function renderBnbExpiryAlerts(){
  const el=document.getElementById('bnb-expiry-alerts');
  if(!el)return;
  const soon=[];
  bnbPropertiesCache.forEach(p=>{
    if(p.plan_status==='expired')return; // already expired — the per-card "Renew" button covers this
    const days=bnbDaysUntilExpiry(p);
    if(days!==null&&days<=7)soon.push({p,days});
  });
  if(!soon.length){el.style.display='none';el.innerHTML='';return;}
  soon.sort((a,b)=>a.days-b.days);
  el.style.display='block';
  el.innerHTML=`<strong>⏰ ${soon.length} propert${soon.length!==1?'ies':'y'} expiring soon</strong>` +
    soon.map(s=>`${escHtml(s.p.property_label)} — ${s.days<=0?'expires today':`expires in ${s.days}d`}`).join(' · ') +
    ` — renew below to stay live on book.nyumba254.com.`;
}
function renderBnbSummary(){
  const el=document.getElementById('bnb-summary-grid');
  if(!el)return;
  const totalProps=bnbPropertiesCache.length;
  const today=new Date().toISOString().slice(0,10);
  let occupiedToday=0,upcoming7=0,dueAmount=0,monthRevenue=0,dueBookingsCount=0;
  const monthKey=currentMonthKey();
  bnbPropertiesCache.forEach(p=>{
    (p.bnb_bookings||[]).forEach(b=>{
      if(b.status==='cancelled')return;
      if(b.check_in<=today && b.check_out>today) occupiedToday++;
      const days=Math.ceil((new Date(b.check_in)-new Date())/86400000);
      if(days>=0 && days<=7) upcoming7++;
      if(b.payment_status==='due'||b.payment_status==='partial'){
        dueAmount += (Number(b.total_amount)||0)-(Number(b.amount_paid)||0);
        dueBookingsCount++;
      }
      if(String(b.check_in).slice(0,7)===monthKey) monthRevenue += Number(b.amount_paid)||0;
    });
  });
  const occRate = totalProps>0 ? Math.round((occupiedToday/totalProps)*100) : 0;
  el.innerHTML=`
    <div class="rl-stat"><div class="rl-label">Properties</div><div class="rl-val">${totalProps}</div></div>
    <div class="rl-stat ${occRate>=50?'good':''}"><div class="rl-label">Occupied tonight</div><div class="rl-val">${occupiedToday} of ${totalProps}</div></div>
    <div class="rl-stat purple"><div class="rl-label">Check-ins next 7 days</div><div class="rl-val">${upcoming7}</div></div>
    <div class="rl-stat good"><div class="rl-label">Collected this month</div><div class="rl-val">KES ${monthRevenue.toLocaleString('en-KE')}</div></div>
    <div class="rl-stat ${dueAmount>0?'danger':''}"><div class="rl-label">Outstanding balance</div><div class="rl-val">KES ${dueAmount.toLocaleString('en-KE')}${dueBookingsCount?` <span style="font-size:12px;font-weight:600">(${dueBookingsCount})</span>`:''}</div></div>`;
  const badge=document.getElementById('nav-badge-rentledger');
  if(badge){badge.textContent=dueBookingsCount;badge.style.display=dueBookingsCount>0?'inline-block':'none';}
}

function renderBnbUpcoming(){
  const el=document.getElementById('bnb-upcoming-card');
  if(!el)return;
  const today=new Date().toISOString().slice(0,10);
  const rows=[];
  bnbPropertiesCache.forEach(p=>{
    (p.bnb_bookings||[]).forEach(b=>{
      if(b.status==='cancelled')return;
      if(b.check_in>=today || b.check_out>=today) rows.push({p,b});
    });
  });
  rows.sort((a,b)=>new Date(a.b.check_in)-new Date(b.b.check_in));
  el.innerHTML = `<h3 style="font-size:13.5px;font-weight:700;margin-bottom:10px">📅 Upcoming check-ins &amp; check-outs</h3>` +
    (rows.length ? rows.slice(0,8).map(r=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:12.5px">
        <span><strong>${escHtml(r.b.guest_name)}</strong> · ${escHtml(r.p.property_label)}</span>
        <span>${new Date(r.b.check_in).toLocaleDateString('en-KE',{day:'numeric',month:'short'})} → ${new Date(r.b.check_out).toLocaleDateString('en-KE',{day:'numeric',month:'short'})}</span>
      </div>`).join('') : '<div style="font-size:12.5px;color:var(--text-3)">No upcoming bookings logged.</div>');
}

function renderBnbProperties(){
  const wrap=document.getElementById('bnb-properties-list');
  if(!bnbPropertiesCache.length){
    wrap.innerHTML=`<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg><h3>No BNB properties yet</h3><p>Add a property you manage bookings for to start tracking guests and payments.</p><button class="btn btn-primary" onclick="openAddBnbPropertyModal()">Add property</button></div>`;
    return;
  }
  wrap.innerHTML=bnbPropertiesCache.map(p=>{
    const bookings=bnbActiveOrFutureBookings(p);
    const expired=bnbPropertyIsExpired(p);
    const linkedListing=p.listing_id?allListings.find(l=>String(l.id)===String(p.listing_id)):null;
    const linkedCover=linkedListing?(linkedListing.listing_photos||[]).find(ph=>ph.is_cover)||(linkedListing.listing_photos||[])[0]:null;
    const thumbUrl=(Array.isArray(p.photos)&&p.photos[0])||linkedCover?.url||null;
    const thumb=thumbUrl?`<img src="${escAttr(thumbUrl)}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;flex-shrink:0"/>`:`<div style="width:64px;height:64px;border-radius:8px;background:var(--surface);flex-shrink:0;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--text-3)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`;
    return `<div class="card" style="padding:18px 20px;margin-bottom:14px${expired?';border-color:var(--red)':''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
        <div style="display:flex;gap:12px;align-items:flex-start">
          ${thumb}
          <div>
            <div style="font-weight:700;font-size:14px">${escHtml(p.property_label)}${expired?' <span class="status status-disabled" style="margin-left:6px">Expired</span>':''}</div>
            <div style="font-size:12px;color:var(--text-3)">KES ${Number(p.nightly_rate).toLocaleString('en-KE')}/night${p.cleaning_fee?' + KES '+Number(p.cleaning_fee).toLocaleString('en-KE')+' cleaning':''}${p.notes?' · '+escHtml(p.notes):''}</div>
            ${p.plan_expires_at?(()=>{const d=bnbDaysUntilExpiry(p);const soon=!expired&&d!==null&&d<=7;return `<div style="font-size:11px;color:${expired?'var(--red)':soon?'var(--amber)':'var(--text-3)'};font-weight:${expired||soon?700:400};margin-top:2px">${expired?'Expired':soon?`⏰ Expires in ${d<=0?'0 days':d+'d'}`:'Renews/expires'} ${new Date(p.plan_expires_at).toLocaleDateString('en-KE',{day:'numeric',month:'short',year:'numeric'})}</div>`;})():''}
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${!p.listing_id?`<button class="btn btn-outline btn-sm" onclick="openEditBnbPropertyModal('${p.id}')">✏️ Edit</button>`:''}
          <button class="btn btn-outline btn-sm" onclick="openAddBnbBookingModal('${p.id}')">+ Log booking</button>
          ${expired
            ?`<button class="btn btn-primary btn-sm" style="background:#7c3aed" onclick="openRenewBnbPropertyModal('${p.id}')">🔄 Renew to reactivate</button>`
            :`<button class="btn btn-outline btn-sm" onclick="openBnbPublicBookingModal('${p.id}')">${p.is_publicly_bookable?'🌐 Public booking: ON':'🌐 Public booking'}</button>`}
          ${(p.is_publicly_bookable&&!expired)?`<a class="btn btn-outline btn-sm" href="https://book.nyumba254.com/property.html?id=${encodeURIComponent(String(p.id))}" target="_blank" rel="noopener noreferrer">↗ View book page</a>`:''}
          <button class="btn btn-outline btn-sm" style="color:var(--red);border-color:var(--red)" onclick="deleteBnbProperty('${p.id}')">Delete</button>
        </div>
        ${(!p.listing_id && !(Array.isArray(p.photos)&&p.photos.length))?`<div style="margin-top:8px;font-size:11px;color:var(--red)">⚠️ No photos yet — add at least one before turning on public booking.</div>`:''}
      </div>
      ${bookings.length ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
        ${bookings.map(b=>{
          const nights=bnbNightsBetween(b.check_in,b.check_out);
          const balance=(Number(b.total_amount)||0)-(Number(b.amount_paid)||0);
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);font-size:12.5px">
            <span><strong>${escHtml(b.guest_name)}</strong> · ${nights} night(s) · ${escHtml(b.source)} · ${new Date(b.check_in).toLocaleDateString('en-KE',{day:'numeric',month:'short'})}–${new Date(b.check_out).toLocaleDateString('en-KE',{day:'numeric',month:'short'})}</span>
            <span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <span class="rl-chip ${b.payment_status==='paid'?'paid':b.payment_status==='partial'?'partial':b.payment_status==='pending_verification'?'partial':b.payment_status==='refunded'?'due':'overdue'}">${b.payment_status==='pending_verification'?'Awaiting confirmation':b.payment_status}${balance>0&&b.payment_status!=='pending_verification'?' · KES '+balance.toLocaleString('en-KE')+' due':''}</span>
              ${b.payment_status==='pending_verification'?`<button class="btn btn-primary btn-sm" style="background:#7c3aed" onclick="confirmBnbBookingPayment('${b.id}')" title="Confirm the M-Pesa payment cleared">✓ Confirm payment</button>`:''}
              ${b.guest_email?`<button class="btn btn-outline btn-sm" onclick="sendBnbCheckinReminder('${b.id}')" title="Send check-in instructions">✉️ Check-in</button>`:''}
              ${(b.guest_email && b.check_out<=new Date().toISOString().slice(0,10))?`<button class="btn btn-outline btn-sm" onclick="sendBnbReviewRequest('${b.id}')" title="Ask for a review">⭐ Review</button>`:''}
              <button class="btn btn-outline btn-sm" onclick="downloadBnbBookingReceiptPDF('${b.id}')" title="Download guest receipt">🧾 Receipt</button>
              <button class="btn btn-outline btn-sm" onclick="openEditBnbBookingModal('${b.id}')">Edit</button>
            </span>
          </div>`;
        }).join('')}
      </div>` : '<div style="margin-top:10px;font-size:12px;color:var(--text-3)">No upcoming bookings for this property.</div>'}
    </div>`;
  }).join('');
}

let bnbActiveTab='properties';
function bnbSetTab(tab){
  bnbActiveTab=tab;
  document.querySelectorAll('#bnb-ledger-content .rl-tab').forEach(b=>b.classList.toggle('active',b.dataset.bnbtab===tab));
  ['properties','calendar','analytics','guests','finances','maintenance'].forEach(t=>{
    const el=document.getElementById('bnb-tab-'+t);
    if(el) el.style.display = t===tab?'block':'none';
  });
  if(tab==='calendar') renderBnbCalendar();
  if(tab==='analytics') renderBnbAnalytics();
  if(tab==='guests') renderBnbGuests();
  if(tab==='finances') renderBnbFinances();
  if(tab==='maintenance') renderBnbMaintenance();
}

// ── Goal tracker (mirrors rent-roll goal) ──
function renderBnbGoalCard(){
  const el=document.getElementById('bnb-goal-card');
  if(!el)return;
  const goal=Number(currentProfile?.bnb_revenue_goal)||0;
  const monthKey=currentMonthKey();
  const current=bnbPropertiesCache.reduce((s,p)=>s+(p.bnb_bookings||[]).filter(b=>b.status!=='cancelled'&&String(b.check_in).slice(0,7)===monthKey).reduce((s2,b)=>s2+(Number(b.amount_paid)||0),0),0);
  if(!goal){el.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px"><div><strong style="font-size:13.5px">Set a monthly revenue goal</strong><div style="font-size:12px;color:var(--text-3)">Track progress toward a target across all properties</div></div><button class="btn btn-outline btn-sm" onclick="openBnbGoalModal()">Set goal</button></div>`;return;}
  const pct=Math.min(100,Math.round((current/goal)*100));
  el.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px"><strong style="font-size:13.5px">🎯 Monthly revenue goal</strong><span style="font-size:12px;color:var(--text-3)">KES ${current.toLocaleString('en-KE')} of ${goal.toLocaleString('en-KE')}</span></div>
    <div class="rl-goal-bar"><div class="rl-goal-fill" style="width:${pct}%"><span>${pct}%</span></div></div>
    <div style="text-align:right"><button class="btn btn-outline btn-sm" onclick="openBnbGoalModal()">Edit goal</button></div>`;
}
function openBnbGoalModal(){document.getElementById('goal-amount').value=currentProfile?.bnb_revenue_goal||'';document.getElementById('modal-rent-goal').querySelector('h3').textContent='Set a monthly revenue goal';document.getElementById('modal-rent-goal').dataset.mode='bnb';openModal('modal-rent-goal');}

// ── Calendar: 90-day occupancy heatmap across all properties ──
function renderBnbCalendar(){
  const wrap=document.getElementById('bnb-tab-calendar');
  if(!wrap)return;
  if(!bnbPropertiesCache.length){wrap.innerHTML='<div class="empty-state"><p>Add a property first to see its calendar.</p></div>';return;}
  const days=[];const start=new Date();start.setHours(0,0,0,0);
  for(let i=0;i<90;i++){const d=new Date(start);d.setDate(d.getDate()+i);days.push(d);}
  const rows=bnbPropertiesCache.map(p=>{
    const cells=days.map(d=>{
      const iso=localDateKey(d);
      const booking=(p.bnb_bookings||[]).find(b=>b.status!=='cancelled'&&b.check_in<=iso&&iso<b.check_out);
      const color=booking?(booking.payment_status==='paid'?'#16a34a':booking.payment_status==='partial'?'var(--amber)':'var(--red)'):'var(--border)';
      const title=booking?`${escAttr(booking.guest_name)} (${booking.payment_status})`:'Available';
      return `<div style="flex:1;min-width:8px;height:22px;background:${color};border-radius:2px" title="${d.toLocaleDateString('en-KE',{day:'numeric',month:'short'})}: ${title}"></div>`;
    }).join('');
    return `<div style="margin-bottom:14px">
      <div style="font-size:12.5px;font-weight:700;margin-bottom:5px">${escHtml(p.property_label)}</div>
      <div style="display:flex;gap:1px;overflow-x:auto;padding-bottom:4px">${cells}</div>
    </div>`;
  }).join('');
  wrap.innerHTML=`<div class="card" style="padding:18px 20px">
    <h3 style="font-size:13.5px;font-weight:700;margin-bottom:4px">Next 90 days — all properties</h3>
    <p style="font-size:11.5px;color:var(--text-3);margin-bottom:14px">🟩 Paid booking · 🟧 Partial payment · 🟥 Payment due · Grey = available</p>
    ${rows}
  </div>`;
}

// ── Analytics: revenue trend, ADR, occupancy rate, channel mix ──
function bnbLast6Months(){return lastNMonths(6);}
function renderBnbAnalytics(){
  const wrap=document.getElementById('bnb-tab-analytics');
  if(!wrap)return;
  const months=bnbLast6Months();
  const allBookings=bnbPropertiesCache.flatMap(p=>(p.bnb_bookings||[]).filter(b=>b.status!=='cancelled').map(b=>({...b,_property:p})));
  const revByMonth=months.map(m=>allBookings.filter(b=>String(b.check_in).slice(0,7)===m).reduce((s,b)=>s+(Number(b.amount_paid)||0),0));
  const maxRev=Math.max(...revByMonth,1);
  const bars=months.map((m,i)=>{
    const h=Math.max(4,Math.round((revByMonth[i]/maxRev)*90));
    const label=new Date(m+'-01').toLocaleDateString('en-KE',{month:'short'});
    return `<div style="flex:1;text-align:center"><div style="height:90px;display:flex;align-items:flex-end;justify-content:center"><div style="width:70%;height:${h}px;background:#7c3aed;border-radius:4px 4px 0 0" title="KES ${revByMonth[i].toLocaleString('en-KE')}"></div></div><div style="font-size:10.5px;color:var(--text-3);margin-top:4px">${label}</div></div>`;
  }).join('');

  const totalNights=allBookings.reduce((s,b)=>s+bnbNightsBetween(b.check_in,b.check_out),0);
  const totalRevenue=allBookings.reduce((s,b)=>s+(Number(b.amount_paid)||0),0);
  const adr=totalNights>0?Math.round(totalRevenue/totalNights):0;

  const today=localDateKey();
  const last30Start=new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  let bookedNightsLast30=0;
  bnbPropertiesCache.forEach(p=>{
    (p.bnb_bookings||[]).filter(b=>b.status!=='cancelled').forEach(b=>{
      const ci=b.check_in<last30Start?last30Start:b.check_in;
      const co=b.check_out>today?today:b.check_out;
      if(co>ci) bookedNightsLast30+=bnbNightsBetween(ci,co);
    });
  });
  const availableNights=bnbPropertiesCache.length*30;
  const occRate=availableNights>0?Math.round((bookedNightsLast30/availableNights)*100):0;

  const channelCounts={};
  allBookings.forEach(b=>{channelCounts[b.source]=(channelCounts[b.source]||0)+(Number(b.amount_paid)||0);});
  const channelTotal=Object.values(channelCounts).reduce((s,v)=>s+v,0)||1;
  const channelLabels={direct:'Direct',airbnb:'Airbnb',booking_com:'Booking.com',other:'Other'};

  wrap.innerHTML=`
    <div class="rl-summary-grid" style="margin-bottom:16px">
      <div class="rl-stat purple"><div class="rl-label">Average daily rate</div><div class="rl-val">KES ${adr.toLocaleString('en-KE')}</div></div>
      <div class="rl-stat ${occRate>=60?'good':occRate>=30?'warn':'danger'}"><div class="rl-label">Occupancy (last 30d)</div><div class="rl-val">${occRate}%</div></div>
      <div class="rl-stat good"><div class="rl-label">Revenue (6mo)</div><div class="rl-val">KES ${revByMonth.reduce((a,b)=>a+b,0).toLocaleString('en-KE')}</div></div>
    </div>
    <div class="card" style="padding:18px 20px;margin-bottom:16px">
      <h3 style="font-size:13.5px;font-weight:700;margin-bottom:14px">Revenue — last 6 months</h3>
      <div style="display:flex;gap:6px">${bars}</div>
    </div>
    <div class="card" style="padding:18px 20px">
      <h3 style="font-size:13.5px;font-weight:700;margin-bottom:12px">Revenue by channel</h3>
      ${Object.keys(channelCounts).length?Object.entries(channelCounts).map(([k,v])=>`<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span>${channelLabels[k]||k}</span><span style="color:var(--text-3)">KES ${v.toLocaleString('en-KE')} (${Math.round(v/channelTotal*100)}%)</span></div><div style="background:var(--surface);border-radius:6px;height:6px;overflow:hidden"><div style="background:#7c3aed;height:100%;width:${Math.round(v/channelTotal*100)}%"></div></div></div>`).join(''):'<div style="font-size:12.5px;color:var(--text-3)">No bookings logged yet.</div>'}
    </div>`;
}

// ── Guests CRM: aggregated across all properties, flags repeat guests ──
function renderBnbGuests(){
  const wrap=document.getElementById('bnb-tab-guests');
  if(!wrap)return;
  const allBookings=bnbPropertiesCache.flatMap(p=>(p.bnb_bookings||[]).filter(b=>b.status!=='cancelled').map(b=>({...b,_propertyLabel:p.property_label})));
  const byGuest={};
  allBookings.forEach(b=>{
    const key=(b.guest_phone||b.guest_email||b.guest_name||'').toLowerCase().trim();
    if(!key)return;
    if(!byGuest[key])byGuest[key]={name:b.guest_name,phone:b.guest_phone,email:b.guest_email,stays:0,totalSpent:0,lastStay:b.check_out,properties:new Set(),bookings:[]};
    byGuest[key].stays++;
    byGuest[key].totalSpent+=Number(b.amount_paid)||0;
    byGuest[key].properties.add(b._propertyLabel);
    byGuest[key].bookings.push(b);
    if(b.check_out>byGuest[key].lastStay)byGuest[key].lastStay=b.check_out;
  });
  const guests=Object.values(byGuest).sort((a,b)=>b.totalSpent-a.totalSpent);
  bnbGuestsCache=guests;
  if(!guests.length){wrap.innerHTML='<div class="empty-state"><p>No guests logged yet — they\'ll appear here once you log bookings.</p></div>';return;}
  wrap.innerHTML=`<div class="card" style="padding:18px 20px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <h3 style="font-size:13.5px;font-weight:700">All guests (${guests.length})</h3>
      <button class="btn btn-outline btn-sm" onclick="exportBnbGuestsCSV()">⬇️ CSV</button>
    </div>
    ${guests.map((g,i)=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--border);font-size:13px;flex-wrap:wrap;gap:8px">
      <div><strong>${escHtml(g.name)}</strong>${g.stays>1?' <span class="rl-badge-pill escalation">🔁 Repeat guest — '+g.stays+' stays</span>':''}<div style="font-size:11.5px;color:var(--text-3)">${escHtml(g.phone||g.email||'')} · Last stay ${new Date(g.lastStay).toLocaleDateString('en-KE',{day:'numeric',month:'short',year:'numeric'})}</div></div>
      <span style="display:flex;align-items:center;gap:10px">
        <span style="font-weight:700;color:var(--green-dark)">KES ${g.totalSpent.toLocaleString('en-KE')}</span>
        <button class="btn btn-outline btn-sm" onclick="downloadBnbGuestStatementPDF(${i})">🧾 Statement</button>
      </span>
    </div>`).join('')}
  </div>`;
}

async function downloadBnbGuestStatementPDF(idx){
  const g=bnbGuestsCache[idx];
  if(!g){showToast('Guest not found','error');return;}
  if(!await ensurePdfLibrary())return;
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'mm',format:'a4'});
  doc.setFillColor(124,58,237);doc.rect(0,0,210,24,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(16);doc.setTextColor(255,255,255);
  doc.text('Guest Stay Statement',14,15);
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(230,230,255);
  doc.text(`${g.name} · Nyumba254`,14,21);
  let y=34;
  doc.setTextColor(26,26,24);doc.setFont('helvetica','normal');doc.setFontSize(10);
  doc.text(`Host: ${currentProfile?.full_name||currentUser?.email||''}`,14,y);y+=6;
  doc.text(`Contact: ${g.phone||g.email||'—'}`,14,y);y+=6;
  doc.text(`Total stays: ${g.stays}`,14,y);y+=10;
  doc.setFont('helvetica','bold');doc.setFillColor(124,58,237);doc.setTextColor(255,255,255);
  doc.rect(14,y-4,182,7,'F');
  doc.text('Property',16,y);doc.text('Check-in',80,y);doc.text('Check-out',115,y);doc.text('Paid (KES)',160,y);
  y+=7;
  doc.setFont('helvetica','normal');doc.setTextColor(74,74,70);
  g.bookings.slice().sort((a,b)=>new Date(a.check_in)-new Date(b.check_in)).forEach(b=>{
    if(y>280){doc.addPage();y=20;}
    doc.text(String(b._propertyLabel).slice(0,28),16,y);
    doc.text(new Date(b.check_in).toLocaleDateString('en-KE',{day:'numeric',month:'short'}),80,y);
    doc.text(new Date(b.check_out).toLocaleDateString('en-KE',{day:'numeric',month:'short'}),115,y);
    doc.text(Number(b.amount_paid||0).toLocaleString('en-KE'),160,y);
    y+=6.5;
    doc.setDrawColor(230,230,230);doc.line(14,y-4.5,196,y-4.5);
  });
  y+=6;
  doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(124,58,237);
  doc.text(`Total spent: KES ${g.totalSpent.toLocaleString('en-KE')}`,14,y);
  doc.save(`${g.name.replace(/[^a-z0-9]+/gi,'-')}-statement.pdf`);
  showToast('Statement downloaded ✓','success');
}

function exportBnbGuestsCSV(){
  if(!bnbGuestsCache.length){showToast('No guests to export','error');return;}
  const rows=[['Guest','Phone','Email','Stays','Total spent (KES)','Last stay']];
  bnbGuestsCache.forEach(g=>rows.push([g.name,g.phone||'',g.email||'',g.stays,g.totalSpent,g.lastStay]));
  const csv=rows.map(r=>r.map(v=>csvCell(v)).join(',')).join('\n');
  rlDownloadBlob(`Nyumba254-BNB-Guests-${new Date().toISOString().slice(0,10)}.csv`,csv,'text/csv');
  showToast('CSV exported ✓','success');
}

// ── Finances tab — reuses unit_expenses via bnb_property_id ──
function renderBnbFinances(){
  const wrap=document.getElementById('bnb-tab-finances');
  if(!wrap)return;
  const allBookings=bnbPropertiesCache.flatMap(p=>(p.bnb_bookings||[]).filter(b=>b.status!=='cancelled'));
  const revenue=allBookings.reduce((s,b)=>s+(Number(b.amount_paid)||0),0);
  const bnbExpenses=unitExpensesCache.filter(e=>e.bnb_property_id);
  const totalExpenses=bnbExpenses.reduce((s,e)=>s+(Number(e.amount)||0),0);
  const net=revenue-totalExpenses;
  const byCategory={};
  bnbExpenses.forEach(e=>{byCategory[e.category]=(byCategory[e.category]||0)+Number(e.amount||0);});
  const catMax=Math.max(...Object.values(byCategory),1);
  wrap.innerHTML=`
    <div class="rl-summary-grid" style="margin-bottom:16px">
      <div class="rl-stat good"><div class="rl-label">Total revenue collected</div><div class="rl-val">KES ${revenue.toLocaleString('en-KE')}</div></div>
      <div class="rl-stat danger"><div class="rl-label">Total expenses</div><div class="rl-val">KES ${totalExpenses.toLocaleString('en-KE')}</div></div>
      <div class="rl-stat ${net>=0?'good':'danger'}"><div class="rl-label">Net income</div><div class="rl-val">KES ${net.toLocaleString('en-KE')}</div></div>
    </div>
    <div class="card" style="padding:18px 20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3 style="font-size:13.5px;font-weight:700">Expenses by category</h3><button class="btn btn-primary btn-sm" style="background:#7c3aed" onclick="openBnbExpenseModal()">+ Log expense</button></div>
      ${Object.keys(byCategory).length?Object.entries(byCategory).map(([k,v])=>`<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span style="text-transform:capitalize">${k.replace('_',' ')}</span><span style="color:var(--text-3)">KES ${v.toLocaleString('en-KE')}</span></div><div style="background:var(--surface);border-radius:6px;height:6px;overflow:hidden"><div style="background:#7c3aed;height:100%;width:${Math.round((v/catMax)*100)}%"></div></div></div>`).join(''):'<div style="font-size:12.5px;color:var(--text-3)">No expenses logged yet.</div>'}
      <div style="max-height:220px;overflow-y:auto;margin-top:10px">
        ${bnbExpenses.slice(0,20).map(e=>{const p=bnbPropertiesCache.find(x=>x.id===e.bnb_property_id);return`<div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid var(--border);font-size:12px"><span>${new Date(e.expense_date).toLocaleDateString('en-KE',{day:'numeric',month:'short'})} · ${escHtml(p?.property_label||'—')} · ${escHtml(e.description||e.category)}</span><span style="font-weight:600">KES ${Number(e.amount).toLocaleString('en-KE')}</span></div>`;}).join('')}
      </div>
    </div>`;
}
function openBnbExpenseModal(){
  const sel=document.getElementById('exp-unit');
  sel.innerHTML=bnbPropertiesCache.map(p=>`<option value="${p.id}">${escHtml(p.property_label)}</option>`).join('');
  sel.dataset.mode='bnb';
  document.getElementById('exp-amount').value='';document.getElementById('exp-desc').value='';
  document.getElementById('exp-date').value=new Date().toISOString().slice(0,10);
  openModal('modal-add-expense');
}

// ── Maintenance tab — reuses maintenance_requests via bnb_property_id ──
function renderBnbMaintenance(){
  const wrap=document.getElementById('bnb-tab-maintenance');
  if(!wrap)return;
  const bnbMaint=maintenanceCache.filter(m=>m.bnb_property_id);
  const open=bnbMaint.filter(m=>m.status!=='done');
  const done=bnbMaint.filter(m=>m.status==='done');
  const row=(m)=>{const p=bnbPropertiesCache.find(x=>x.id===m.bnb_property_id);return`<div class="card" style="padding:14px 16px;margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
      <div><strong style="font-size:13px">${escHtml(m.title)}</strong><div style="font-size:11.5px;color:var(--text-3)">${escHtml(p?.property_label||'—')} · Reported ${new Date(m.reported_date).toLocaleDateString('en-KE',{day:'numeric',month:'short'})}</div></div>
      <span class="rl-chip ${m.status==='done'?'paid':m.status==='in_progress'?'partial':'due'}">${m.status.replace('_',' ')}</span>
    </div>
    ${m.notes?`<div style="font-size:12.5px;color:var(--text-2);margin-top:6px">${escHtml(m.notes)}</div>`:''}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
      <span style="font-size:12px;font-weight:700;color:var(--text)">${m.cost?'KES '+Number(m.cost).toLocaleString('en-KE'):'No cost logged'}</span>
      ${m.status!=='done'?`<button class="btn btn-outline btn-sm" onclick="markMaintenanceDone(${m.id})">Mark done</button>`:''}
    </div></div>`;};
  wrap.innerHTML=`<div style="display:flex;justify-content:flex-end;margin-bottom:12px"><button class="btn btn-primary btn-sm" style="background:#7c3aed" onclick="openBnbMaintenanceModal()">+ Log request</button></div>
    <h3 style="font-size:13px;font-weight:700;margin-bottom:8px">Open (${open.length})</h3>
    ${open.length?open.map(row).join(''):'<div style="font-size:12.5px;color:var(--text-3);margin-bottom:16px">Nothing open — nice! 🎉</div>'}
    ${done.length?`<h3 style="font-size:13px;font-weight:700;margin:16px 0 8px">Completed (${done.length})</h3>${done.slice(0,10).map(row).join('')}`:''}`;
}
function openBnbMaintenanceModal(){
  const sel=document.getElementById('mt-unit');
  sel.innerHTML=bnbPropertiesCache.map(p=>`<option value="${p.id}">${escHtml(p.property_label)}</option>`).join('');
  sel.dataset.mode='bnb';
  document.getElementById('mt-title').value='';document.getElementById('mt-notes').value='';document.getElementById('mt-cost').value='';document.getElementById('mt-status').value='open';
  openModal('modal-add-maintenance');
}

// ── Cleaning / turnover — auto-derived from checkouts, tracked via cleaning_status ──
function bnbCleaningQueue(){
  const today=new Date().toISOString().slice(0,10);
  const out=[];
  bnbPropertiesCache.forEach(p=>{
    (p.bnb_bookings||[]).forEach(b=>{
      if(b.status==='cancelled')return;
      if(b.check_out<=today && (b.cleaning_status||'pending')==='pending') out.push({p,b});
    });
  });
  return out.sort((a,b)=>new Date(b.b.check_out)-new Date(a.b.check_out));
}
async function markBnbCleaningDone(bookingId){
  const{error}=await db.from('bnb_bookings').update({cleaning_status:'done'}).eq('id',bookingId);
  if(error){showToast('Could not update: '+error.message,'error');return;}
  showToast('Marked cleaned ✓','success');
  loadBnbLedger();
}

// ── Automated guest emails ──
async function sendBnbCheckinReminder(bookingId){
  let found=null;
  bnbPropertiesCache.forEach(p=>{(p.bnb_bookings||[]).forEach(b=>{if(String(b.id)===String(bookingId))found={p,b};});});
  if(!found||!found.b.guest_email){showToast('This guest has no email on file','error');return;}
  await notifyByEmail('bnb_checkin_instructions',{
    guestName:found.b.guest_name, guestEmail:found.b.guest_email,
    propertyLabel:found.p.property_label, checkIn:found.b.check_in, checkOut:found.b.check_out,
    sellerName:currentProfile?.full_name, sellerEmail:currentUser?.email, sellerPhone:currentProfile?.phone,
  });
  showToast('Check-in instructions sent ✓','success');
}
async function sendBnbReviewRequest(bookingId){
  let found=null;
  bnbPropertiesCache.forEach(p=>{(p.bnb_bookings||[]).forEach(b=>{if(String(b.id)===String(bookingId))found={p,b};});});
  if(!found||!found.b.guest_email){showToast('This guest has no email on file','error');return;}
  await notifyByEmail('bnb_review_request',{
    guestName:found.b.guest_name, guestEmail:found.b.guest_email,
    propertyLabel:found.p.property_label, sellerName:currentProfile?.full_name, sellerEmail:currentUser?.email,
  });
  showToast('Review request sent ✓','success');
}

let bpPendingPhotos=[];
let bpExistingPhotos=[];
let bpEditingId=null;
const BNB_AMENITY_KEYS=[
  { key:'wifi', label:'WiFi' },
  { key:'parking', label:'Parking' },
  { key:'pool', label:'Swimming pool' },
  { key:'backup_power', label:'Backup power' },
  { key:'hot_water', label:'Hot water' },
  { key:'kitchen', label:'Full kitchen' },
  { key:'workspace', label:'Workspace' },
  { key:'ac', label:'Air conditioning' },
  { key:'tv', label:'TV / Netflix' },
  { key:'washer', label:'Washing machine' },
  { key:'security', label:'24/7 security' },
  { key:'pets_allowed', label:'Pets allowed' },
];
function bpRenderAmenitiesGrid(selected){
  const grid=document.getElementById('bp-amenities-grid');
  if(!grid)return;
  const sel=selected||[];
  grid.innerHTML=BNB_AMENITY_KEYS.map(a=>`<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:7px;background:var(--surface);border-radius:6px"><input type="checkbox" id="bp-amenity-${a.key}" ${sel.includes(a.key)?'checked':''}/>${a.label}</label>`).join('');
}
function bpToggleUnlinkedFields(){
  const linked=!!document.getElementById('bp-listing').value;
  const grp=document.getElementById('bp-unlinked-fields');
  if(grp) grp.style.display = linked ? 'none' : 'block';
}
function renderBpPhotosGrid(){
  const grid=document.getElementById('bp-photos-grid');
  if(!grid)return;
  const existingHtml=bpExistingPhotos.map((url,i)=>`
    <div style="position:relative;border-radius:8px;overflow:hidden;border:2px solid var(--green);aspect-ratio:1">
      <img src="${escAttr(url)}" style="width:100%;height:100%;object-fit:cover;display:block"/>
      <button type="button" onclick="removeBpExistingPhoto(${i})" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.6);border:none;color:white;border-radius:6px;width:20px;height:20px;font-size:12px;cursor:pointer">✕</button>
    </div>`).join('');
  const pendingHtml=bpPendingPhotos.map((p,i)=>`
    <div style="position:relative;border-radius:8px;overflow:hidden;border:2px solid var(--border);aspect-ratio:1">
      <img src="${p.previewUrl}" style="width:100%;height:100%;object-fit:cover;display:block"/>
      <button type="button" onclick="removeBpPendingPhoto(${i})" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.6);border:none;color:white;border-radius:6px;width:20px;height:20px;font-size:12px;cursor:pointer">✕</button>
    </div>`).join('');
  grid.innerHTML=existingHtml+pendingHtml;
}
function handleBpPhotoUpload(fileList){
  Array.from(fileList||[]).forEach(file=>bpPendingPhotos.push({file,previewUrl:URL.createObjectURL(file)}));
  renderBpPhotosGrid();
  document.getElementById('bp-photo-upload').value='';
}
function removeBpPendingPhoto(i){bpPendingPhotos.splice(i,1);renderBpPhotosGrid();}
function removeBpExistingPhoto(i){bpExistingPhotos.splice(i,1);renderBpPhotosGrid();}
function openAddBnbPropertyModal(){
  bpEditingId=null;
  document.getElementById('bp-modal-title').textContent='Add BNB property';
  document.getElementById('btn-save-bnb-property').textContent='Add property';
  document.getElementById('bp-listing-group').style.display='block';
  const sel=document.getElementById('bp-listing');
  sel.innerHTML='<option value="">Not linked to a listing</option>'+allListings.filter(l=>l.category==='airbnb').map(l=>`<option value="${l.id}">${escHtml(l.title)}</option>`).join('');
  document.getElementById('bp-label').value='';document.getElementById('bp-nightly').value='';document.getElementById('bp-weekend').value='';document.getElementById('bp-cleaning').value='';document.getElementById('bp-notes').value='';document.getElementById('bp-description').value='';
  bpRenderAmenitiesGrid([]);
  bpPendingPhotos=[];bpExistingPhotos=[];renderBpPhotosGrid();bpToggleUnlinkedFields();
  document.getElementById('bp-photo-upload-status').textContent='';
  openModal('modal-add-bnb-property');
}

function openEditBnbPropertyModal(propertyId){
  const p=bnbPropertiesCache.find(x=>String(x.id)===String(propertyId));
  if(!p){showToast('Property not found','error');return;}
  if(p.listing_id){showToast('This property is linked to a listing — edit the listing itself instead.','error');return;}
  bpEditingId=propertyId;
  document.getElementById('bp-modal-title').textContent='Edit BNB property';
  document.getElementById('btn-save-bnb-property').textContent='Save changes';
  document.getElementById('bp-listing-group').style.display='none';
  document.getElementById('bp-label').value=p.property_label||'';
  document.getElementById('bp-nightly').value=p.nightly_rate||'';
  document.getElementById('bp-weekend').value=p.weekend_rate||'';
  document.getElementById('bp-cleaning').value=p.cleaning_fee||'';
  document.getElementById('bp-notes').value=p.notes||'';
  document.getElementById('bp-description').value=p.description||'';
  bpRenderAmenitiesGrid(Array.isArray(p.amenities)?p.amenities:[]);
  bpPendingPhotos=[];bpExistingPhotos=Array.isArray(p.photos)?[...p.photos]:[];
  renderBpPhotosGrid();
  document.getElementById('bp-unlinked-fields').style.display='block';
  document.getElementById('bp-photo-upload-status').textContent='';
  openModal('modal-add-bnb-property');
}
const BNB_PROPERTY_PHOTOS_BUCKET='bnb-property-photos';
async function saveBnbProperty(){
  const label=document.getElementById('bp-label').value.trim();
  if(!label){showToast('Please name the property','error');return;}
  const isEdit=!!bpEditingId;
  const listingId=isEdit?null:(document.getElementById('bp-listing').value||null);
  const payload={
    property_label:label,
    nightly_rate:parseFloat(document.getElementById('bp-nightly').value)||0,
    weekend_rate:document.getElementById('bp-weekend').value?parseFloat(document.getElementById('bp-weekend').value):null,
    cleaning_fee:parseFloat(document.getElementById('bp-cleaning').value)||0,
    notes:document.getElementById('bp-notes').value.trim()||null,
  };
  if(!isEdit){
    payload.seller_id=effectiveSellerId;
    payload.listing_id=listingId;
    payload.photos=[];
    payload.plan_status='active';
    payload.plan_expires_at=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
  }
  if(isEdit||!listingId){
    payload.description=document.getElementById('bp-description').value.trim()||null;
    payload.amenities=BNB_AMENITY_KEYS.filter(a=>document.getElementById('bp-amenity-'+a.key)?.checked).map(a=>a.key);
  }

  const btn=document.getElementById('btn-save-bnb-property');btn.disabled=true;btn.textContent='Saving…';
  let row,error;
  if(isEdit){({data:row,error}=await db.from('bnb_properties').update(payload).eq('id',bpEditingId).select().single());}
  else{({data:row,error}=await db.from('bnb_properties').insert(payload).select().single());}
  if(error){btn.disabled=false;btn.textContent=isEdit?'Save changes':'Add property';showToast('Could not save: '+error.message,'error');return;}

  let photoUploadFailed=false;
  if(!listingId && (bpPendingPhotos.length || isEdit)){
    btn.textContent='Uploading photos…';
    const urls=[...bpExistingPhotos];
    for(let i=0;i<bpPendingPhotos.length;i++){
      const file=await compressImage(bpPendingPhotos[i].file);
      const ext=(file.name.split('.').pop()||'jpg').toLowerCase();
      const path=`${effectiveSellerId}/${row.id}/${Date.now()}_${i}.${ext}`;
      const{error:upErr}=await db.storage.from(BNB_PROPERTY_PHOTOS_BUCKET).upload(path,file);
      if(upErr){
        console.error('bnb photo upload failed:',upErr.message);
        photoUploadFailed=true;
        if(upErr.message.toLowerCase().includes('bucket not found')){
          showToast('Photo storage isn\'t set up yet — contact support to enable BNB property photos.','error');
        }else{
          showToast('A photo failed to upload: '+upErr.message,'error');
        }
        continue;
      }
      const{data:pub}=db.storage.from(BNB_PROPERTY_PHOTOS_BUCKET).getPublicUrl(path);
      urls.push(pub.publicUrl);
    }
    await db.from('bnb_properties').update({photos:urls}).eq('id',row.id);
  }

  btn.disabled=false;btn.textContent=isEdit?'Save changes':'Add property';
  closeModal('modal-add-bnb-property');
  if(photoUploadFailed){
    showToast(isEdit?'Property saved, but photo upload failed — try again':'Property added, but photo upload failed — edit it to retry','error');
  }else{
    showToast(isEdit?'Property updated ✓':'Property added ✓','success');
  }
  bpPendingPhotos=[];bpExistingPhotos=[];bpEditingId=null;
  loadBnbLedger();
}

let pbActivePropertyId=null;
function openBnbPublicBookingModal(propertyId){
  const p=bnbPropertiesCache.find(x=>String(x.id)===String(propertyId));
  if(!p){showToast('Property not found','error');return;}
  pbActivePropertyId=propertyId;
  document.getElementById('pb-is-bookable').checked=!!p.is_publicly_bookable;
  document.getElementById('pb-max-guests').value=p.max_guests||'';
  document.getElementById('pb-min-stay').value=p.min_stay_nights||1;
  document.getElementById('pb-cancellation-policy').value=p.cancellation_policy||'flexible';
  openModal('modal-bnb-public-booking');
}
async function saveBnbPublicBooking(){
  if(!pbActivePropertyId)return;
  const isBookable=document.getElementById('pb-is-bookable').checked;
  const maxGuests=parseInt(document.getElementById('pb-max-guests').value)||null;
  if(isBookable&&!maxGuests){showToast('Please set max guests before turning public booking on','error');return;}
  if(isBookable){
    const p=bnbPropertiesCache.find(x=>String(x.id)===String(pbActivePropertyId));
    const linkedListing=p?.listing_id?allListings.find(l=>String(l.id)===String(p.listing_id)):null;
    const linkedHasPhotos=linkedListing&&(linkedListing.listing_photos||[]).length>0;
    const ownHasPhotos=Array.isArray(p?.photos)&&p.photos.length>0;
    if(!linkedHasPhotos&&!ownHasPhotos){
      showToast('Add at least one photo to this property before making it publicly bookable','error');
      return;
    }
  }
  const payload={
    is_publicly_bookable:isBookable,
    max_guests:maxGuests,
    min_stay_nights:parseInt(document.getElementById('pb-min-stay').value)||1,
    cancellation_policy:document.getElementById('pb-cancellation-policy').value,
  };
  const btn=document.getElementById('btn-save-bnb-public-booking');btn.disabled=true;btn.textContent='Saving…';
  const{error}=await db.from('bnb_properties').update(payload).eq('id',pbActivePropertyId);
  btn.disabled=false;btn.textContent='Save';
  if(error){showToast('Could not save: '+error.message,'error');return;}
  closeModal('modal-bnb-public-booking');
  showToast(isBookable?'Public booking turned ON ✓ — live at book.nyumba254.com':'Public booking turned off','success');
  loadBnbLedger();
}
async function deleteBnbProperty(id){
  const label=(bnbPropertiesCache.find(p=>String(p.id)===String(id))||{}).property_label||'this property';
  if(!await lcConfirm({title:'Delete property?',message:`<strong>${escHtml(label)}</strong> and its booking history will be removed.`,confirmLabel:'Delete',danger:true}))return;
  const{error}=await db.from('bnb_properties').delete().eq('id',id);
  if(error){showToast('Could not delete: '+error.message,'error');return;}
  showToast('Property deleted','success');
  loadBnbLedger();
}

function renderActionCenter(){
  const el=document.getElementById('action-center-card');if(!el)return;
  lcBuildStats();
  const items=[];
  const plural=(n,w)=>`${n} ${w}${n!==1?'s':''}`;
  const unread=threads.reduce((s,t)=>s+(t.unread_count||0),0);
  if(unread)items.push({icon:'💬',text:`${plural(unread,'unread message')}`,go:"showAllMessages()"});
  const unpaid=allListings.filter(lcIsUnpaid).length;
  if(unpaid)items.push({icon:'💳',text:`${plural(unpaid,'listing')} awaiting payment`,go:"showPage('listings');filterListings('unpaid')"});
  const noPhoto=allListings.filter(l=>lcPhotoCount(l)<=1&&!lcHasIssue(l)).length;
  if(noPhoto)items.push({icon:'📷',text:`${plural(noPhoto,'listing')} missing photos`,go:"showPage('listings');filterListings('view:nophotos')"});
  const stale=allListings.filter(l=>lcMatchesFilter(l,'view:stale')).length;
  if(stale)items.push({icon:'🕸️',text:`${plural(stale,'listing')} going stale`,go:"showPage('listings');filterListings('view:stale')"});
  const reviews=allReviews.filter(r=>!r.response_text).length;
  if(reviews)items.push({icon:'⭐',text:`${plural(reviews,'review')} awaiting your response`,go:"showPage('reviews')"});
  if(!items.length){el.style.display='none';return;}
  el.style.display='block';
  el.innerHTML=`<div style="font-weight:700;font-size:13.5px;margin-bottom:10px;color:var(--amber)">⚡ Needs you today</div><div style="display:flex;flex-wrap:wrap;gap:8px">${items.map(i=>`<button type="button" class="btn btn-outline btn-sm" style="background:var(--white)" onclick="${i.go}">${i.icon} ${i.text} →</button>`).join('')}</div>`;
}
function bnbPropertyIsExpired(p){
  if(!p.plan_expires_at)return false;
  return new Date(p.plan_expires_at) < new Date();
}
async function bnbAutoExpireProperties(){
  const toDisable=bnbPropertiesCache.filter(p=>bnbPropertyIsExpired(p)&&p.plan_status!=='expired');
  for(const p of toDisable){
    const wasBookable=!!p.is_publicly_bookable;
    const{error}=await db.from('bnb_properties').update({plan_status:'expired',pre_expiry_bookable:wasBookable,is_publicly_bookable:false}).eq('id',p.id);
    if(!error){p.plan_status='expired';p.pre_expiry_bookable=wasBookable;p.is_publicly_bookable=false;}
  }
}
let rbpActivePropertyId=null;
function openRenewBnbPropertyModal(propertyId){const _s=document.getElementById('pay-sms-paste');if(_s){_s.value='';parsePaySms('');}
  const p=bnbPropertiesCache.find(x=>String(x.id)===String(propertyId));
  if(!p){showToast('Property not found','error');return;}
  rbpActivePropertyId=propertyId;
  const wasBundle=p.plan_tier==='bundle';
  document.getElementById('pay-listing-intro').textContent=`Renew "${p.property_label}" (${wasBundle?'Bundle':'Basic'} tier) to bring it back live on the book page.`;
  document.getElementById('pay-plan-standard-row').style.display='flex';
  document.getElementById('pay-plan-featured-row').style.display='none';
  const amt=Number(wasBundle?(platformPrices.bnb_bundle_price||2000):(platformPrices.bnb_basic_price||700));
  document.getElementById('pay-standard-amount').textContent='KES '+amt.toLocaleString('en-KE')+' / 30 days';
  document.getElementById('pay-listing-amount-display').textContent='KES '+amt.toLocaleString('en-KE');
  document.getElementById('pay-listing-ref').value='';
  document.getElementById('btn-submit-pay-listing').onclick=submitRenewBnbProperty;
  openModal('modal-pay-listing');
}
async function submitRenewBnbProperty(){
  const code=document.getElementById('pay-listing-ref').value.trim();
  if(!code||code.length!==10){showToast('Enter a valid 10-character M-Pesa code','error');return;}
  const p=bnbPropertiesCache.find(x=>String(x.id)===String(rbpActivePropertyId));
  if(!p)return;
  const amount=Number(p.plan_tier==='bundle'?(platformPrices.bnb_bundle_price||2000):(platformPrices.bnb_basic_price||700))||700;
  const btn=document.getElementById('btn-submit-pay-listing');btn.disabled=true;btn.textContent='Submitting…';
  const{error}=await db.from('payments').insert({seller_id:effectiveSellerId,amount,method:'paybill',reference:code,type:'bnb_property_renewal',status:'pending_verification',bnb_property_id:p.id});
  btn.disabled=false;btn.textContent='Submit for verification';
  if(error){showToast('Could not submit: '+error.message,'error');return;}
  closeModal('modal-pay-listing');
  document.getElementById('btn-submit-pay-listing').onclick=submitPayListing;
  showToast('Renewal submitted — will reactivate once confirmed ✓','success');
  notifyAdmin('bnb_property_renewal_submitted',{propertyId:p.id,propertyLabel:p.property_label,amount,reference:code,sellerName:currentProfile?.full_name,sellerEmail:currentUser?.email});
}
let bbEditingId=null;
function openAddBnbBookingModal(preselectPropertyId){
  bbEditingId=null;
  const sel=document.getElementById('bb-property');
  sel.innerHTML=bnbPropertiesCache.map(p=>`<option value="${p.id}">${escHtml(p.property_label)}</option>`).join('');
  if(preselectPropertyId) sel.value=preselectPropertyId;
  document.getElementById('bb-guest-name').value='';document.getElementById('bb-guest-phone').value='';document.getElementById('bb-guest-email').value='';
  document.getElementById('bb-checkin').value='';document.getElementById('bb-checkout').value='';
  document.getElementById('bb-source').value='direct';document.getElementById('bb-total').value='';document.getElementById('bb-paid').value='0';document.getElementById('bb-payment-status').value='due';document.getElementById('bb-notes').value='';
  openModal('modal-add-bnb-booking');
}
function openEditBnbBookingModal(bookingId){
  let found=null;
  bnbPropertiesCache.forEach(p=>{(p.bnb_bookings||[]).forEach(b=>{if(String(b.id)===String(bookingId))found={p,b};});});
  if(!found){showToast('Booking not found','error');return;}
  bbEditingId=bookingId;
  const sel=document.getElementById('bb-property');
  sel.innerHTML=bnbPropertiesCache.map(p=>`<option value="${p.id}">${escHtml(p.property_label)}</option>`).join('');
  sel.value=found.p.id;
  document.getElementById('bb-guest-name').value=found.b.guest_name||'';
  document.getElementById('bb-guest-phone').value=found.b.guest_phone||'';
  document.getElementById('bb-guest-email').value=found.b.guest_email||'';
  document.getElementById('bb-checkin').value=found.b.check_in||'';
  document.getElementById('bb-checkout').value=found.b.check_out||'';
  document.getElementById('bb-source').value=found.b.source||'direct';
  document.getElementById('bb-total').value=found.b.total_amount||'';
  document.getElementById('bb-paid').value=found.b.amount_paid||0;
  document.getElementById('bb-payment-status').value=found.b.payment_status||'due';
  document.getElementById('bb-notes').value=found.b.notes||'';
  openModal('modal-add-bnb-booking');
}
async function saveBnbBooking(){
  const name=document.getElementById('bb-guest-name').value.trim();
  const checkin=document.getElementById('bb-checkin').value;
  const checkout=document.getElementById('bb-checkout').value;
  const propertyId=document.getElementById('bb-property').value;
  if(!name||!checkin||!checkout){showToast('Guest name, check-in and check-out are required','error');return;}
  if(checkout<=checkin){showToast('Check-out must be after check-in','error');return;}

  // Overlap guard: check_in < existing.check_out && check_out > existing.check_in
  {
    let overlapQ=db.from('bnb_bookings').select('id,guest_name,check_in,check_out')
      .eq('bnb_property_id',propertyId).neq('status','cancelled')
      .lt('check_in',checkout).gt('check_out',checkin);
    if(bbEditingId) overlapQ=overlapQ.neq('id',bbEditingId);
    const{data:overlaps,error:ovErr}=await overlapQ;
    if(ovErr){showToast('Could not verify availability: '+ovErr.message,'error');return;}
    if(overlaps&&overlaps.length){
      showToast(`These dates overlap an existing booking for ${overlaps[0].guest_name} (${overlaps[0].check_in} → ${overlaps[0].check_out})`,'error');
      return;
    }
  }

  const payload={
    bnb_property_id:document.getElementById('bb-property').value,
    guest_name:name,
    guest_phone:document.getElementById('bb-guest-phone').value.trim()||null,
    guest_email:document.getElementById('bb-guest-email').value.trim()||null,
    check_in:checkin,check_out:checkout,
    source:document.getElementById('bb-source').value,
    total_amount:parseFloat(document.getElementById('bb-total').value)||0,
    amount_paid:parseFloat(document.getElementById('bb-paid').value)||0,
    payment_status:document.getElementById('bb-payment-status').value,
    notes:document.getElementById('bb-notes').value.trim()||null,
  };
  const btn=document.getElementById('btn-save-bnb-booking');btn.disabled=true;btn.textContent='Saving…';
  let error;
  if(bbEditingId){ ({error}=await db.from('bnb_bookings').update(payload).eq('id',bbEditingId)); }
  else { ({error}=await db.from('bnb_bookings').insert(payload)); }
  btn.disabled=false;btn.textContent='Save booking';
  if(error){showToast('Could not save: '+error.message,'error');return;}
  closeModal('modal-add-bnb-booking');
  showToast('Booking saved ✓','success');
  await bnbPatchPropertyBookings(propertyId); // targeted refetch, not a full ledger reload
}

// Refetches bookings for ONE property and merges into the cache instead of
// re-fetching every property + booking + expense + maintenance row on every
// single-booking edit.
async function bnbPatchPropertyBookings(propertyId){
  const{data,error}=await db.from('bnb_properties').select('*, bnb_bookings(*)').eq('id',propertyId).single();
  if(error||!data)return loadBnbLedger(); // fall back to full reload if anything's off
  const idx=bnbPropertiesCache.findIndex(p=>String(p.id)===String(propertyId));
  if(idx!==-1) bnbPropertiesCache[idx]=data; else bnbPropertiesCache.unshift(data);
  renderBnbSummary();renderBnbUpcoming();renderBnbProperties();
  if(bnbActiveTab==='calendar')renderBnbCalendar();
  if(bnbActiveTab==='analytics')renderBnbAnalytics();
  if(bnbActiveTab==='guests')renderBnbGuests();
}

async function confirmBnbBookingPayment(bookingId){
  if(!await lcConfirm({title:'Confirm payment?',message:'Confirm this M-Pesa payment cleared and finalise the booking?',confirmLabel:'Confirm payment'}))return;
  const{error}=await db.from('bnb_bookings').update({payment_status:'paid',status:'confirmed'}).eq('id',bookingId);
  if(error){showToast('Could not confirm: '+error.message,'error');return;}
  showToast('Booking confirmed ✓','success');
  let found=null;
  bnbPropertiesCache.forEach(p=>{(p.bnb_bookings||[]).forEach(b=>{if(String(b.id)===String(bookingId))found={p,b};});});
  if(found)notifyInApp('rent_ledger',`Booking confirmed — ${found.b.guest_name}`,`${found.p.property_label} · ${found.b.check_in} → ${found.b.check_out}`);
  loadBnbLedger();
}

// ── Rent & Tenant Ledger (Elite) — full property-management grade ledger ──
// Requires: alter table tenants add column if not exists lease_end_date date;
//           alter table tenants add column if not exists move_out_date date;
let rentalUnitsCache=[];
let rlSearchQuery='';
let rlActiveTab='units';

async function loadRentalUnits(){
  if(!eliteActive())return;
  const wrap=document.getElementById('rental-units-list');
  wrap.innerHTML='<div style="padding:30px;text-align:center;color:var(--text-3);font-size:13px">Loading…</div>';
  const{data,error}=await db.from('rental_units').select('*, tenants(*, rent_payments(*))').eq('seller_id',effectiveSellerId).order('created_at',{ascending:false});
  if(error){wrap.innerHTML=`<div class="empty-state"><p>Could not load: ${escHtml(error.message)}</p></div>`;return;}
  rentalUnitsCache=data||[];
  await rlLoadExtras();
  renderRentLedgerSummary();
  renderLeaseAlerts();
  renderPortfolioHealthCard();
  renderGoalCard();
  renderRentalUnits();
  renderFullLedgerTable();
  if(rlActiveTab==='analytics') renderRentAnalytics();
  if(rlActiveTab==='pipeline') renderPipeline();
  if(rlActiveTab==='finances') renderFinancesTab();
  if(rlActiveTab==='maintenance') renderMaintenanceTab();
  try{RLTour.maybeStart();}catch(e){console.error('RLTour error:',e);}
}

// ── Portfolio analytics ──
function rlCollectionRateForMonth(monthKey){
  let roll=0, collected=0;
  rentalUnitsCache.forEach(u=>{
    const t=rlTenantForMonth(u,monthKey); if(!t) return;
    roll += Number(u.monthly_rent)||0;
    const st = rentStatusForMonth(t, monthKey);
    const amt = rentAmountForMonth(t, monthKey);
    if(st==='paid') collected += amt || Number(u.monthly_rent)||0;
    else if(st==='partial') collected += amt;
  });
  return roll>0 ? Math.round((collected/roll)*100) : null;
}
function tenantReliability(t){
  let checked=0, onTime=0;
  last12Months().filter(m=>m<=currentMonthKey()).forEach(m=>{
    const st=rentStatusForMonth(t,m);
    if(st==='paid'||st==='overdue'){ checked++; if(st==='paid') onTime++; }
  });
  return checked>0 ? Math.round((onTime/checked)*100) : null;
}
function renderRentAnalytics(){
  const wrap=document.getElementById('rl-analytics-wrap');
  if(!wrap) return;
  const months=last6Months();
  const rates=months.map(rlCollectionRateForMonth);
  const bars=months.map((m,i)=>{
    const r=rates[i];
    const h=r==null?4:Math.max(4,Math.round((r/100)*90));
    const label=new Date(m+'-01').toLocaleDateString('en-KE',{month:'short'});
    const color=r==null?'var(--border)':r>=90?'#16a34a':r>=60?'#d97706':'#dc2626';
    return `<div style="flex:1;text-align:center">
      <div style="height:90px;display:flex;align-items:flex-end;justify-content:center">
        <div style="width:70%;height:${h}px;background:${color};border-radius:4px 4px 0 0;transition:height .3s" title="${r==null?'No active tenants':r+'% collected'}"></div>
      </div>
      <div style="font-size:10.5px;color:var(--text-3);margin-top:4px">${label}</div>
      <div style="font-size:11px;font-weight:700;color:var(--text)">${r==null?'—':r+'%'}</div>
    </div>`;
  }).join('');

  const overdueList=[];
  let checkedAll=0, onTimeAll=0;
  rentalUnitsCache.forEach(u=>{
    let overdueAmt=0, overdueMonths=0;
    last12Months().filter(m=>m<currentMonthKey()).forEach(m=>{
      const mt=rlTenantForMonth(u,m); if(!mt) return;
      if(rentStatusForMonth(mt,m)==='overdue'){ overdueAmt+=overdueAmountForUnit(u,1); overdueMonths++; }
    });
    const t=rlActiveTenant(u);
    if(overdueAmt>0 && t) overdueList.push({unit:u,tenant:t,amt:overdueAmt,months:overdueMonths});
    if(t) last12Months().filter(m=>m<=currentMonthKey()).forEach(m=>{
      const st=rentStatusForMonth(t,m);
      if(st==='paid'||st==='overdue'){checkedAll++; if(st==='paid')onTimeAll++;}
    });
  });
  overdueList.sort((a,b)=>b.amt-a.amt);
  const reliabilityAvg = checkedAll>0 ? Math.round((onTimeAll/checkedAll)*100) : null;
  const occupied=rentalUnitsCache.filter(u=>rlActiveTenant(u)).length;
  const occRate = rentalUnitsCache.length ? Math.round((occupied/rentalUnitsCache.length)*100) : 0;
  const portfolioValue = rentalUnitsCache.reduce((s,u)=>s+(Number(u.monthly_rent)||0),0)*12;

  wrap.innerHTML = `
    <div class="rl-summary-grid" style="margin-bottom:20px">
      <div class="rl-stat ${occRate>=85?'good':occRate>=60?'warn':'danger'}"><div class="rl-label">Occupancy rate</div><div class="rl-val">${occRate}%</div></div>
      <div class="rl-stat ${reliabilityAvg==null?'':reliabilityAvg>=85?'good':reliabilityAvg>=60?'warn':'danger'}"><div class="rl-label">On-time payment rate (12mo)</div><div class="rl-val">${reliabilityAvg==null?'—':reliabilityAvg+'%'}</div></div>
      <div class="rl-stat purple"><div class="rl-label">Annualized portfolio value</div><div class="rl-val">KES ${portfolioValue.toLocaleString('en-KE')}</div></div>
    </div>
    ${renderAgingCard()}
    ${renderForecastCard()}
    ${renderHeatmapCard()}
    ${renderLeaderboardCard()}
    <div class="card" style="padding:18px 20px;margin-bottom:16px">
      <h3 style="font-size:13.5px;font-weight:700;margin-bottom:14px">Collection rate — last 6 months</h3>
      <div style="display:flex;gap:6px">${bars}</div>
    </div>
    <div class="card" style="padding:18px 20px">
      <h3 style="font-size:13.5px;font-weight:700;margin-bottom:12px">⚠️ Tenants with overdue balances</h3>
      ${overdueList.length ? overdueList.map(o=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--border);font-size:13px">
          <div><strong>${escHtml(o.tenant.full_name)}</strong><div style="font-size:11.5px;color:var(--text-3)">${escHtml(o.unit.unit_label)} · ${o.months} month(s) overdue</div></div>
          <div style="text-align:right">
            <div style="font-weight:700;color:var(--red)">KES ${o.amt.toLocaleString('en-KE')}</div>
            <button class="btn btn-outline btn-sm" style="margin-top:4px" onclick="openTenantDetailModal('${o.unit.id}','${o.tenant.id}')">View</button>
          </div>
        </div>`).join('') : '<div style="font-size:12.5px;color:var(--text-3)">No overdue balances — great work! 🎉</div>'}
    </div>`;
}

async function sendAllOverdueReminders(){
  const targets=[],recentlyReminded=[];
  const now=Date.now(),cooldown=RL_REMINDER_COOLDOWN_MS;
  rentalUnitsCache.forEach(u=>{
    const t=rlActiveTenant(u); if(!t||!t.email) return;
    const overdue = last12Months().some(m=>m<currentMonthKey() && rentStatusForMonth(t,m)==='overdue');
    if(!overdue)return;
    const lastSent=Date.parse(t.last_reminder_sent_at||'');
    if(Number.isFinite(lastSent)&&lastSent<=now&&now-lastSent<cooldown){recentlyReminded.push(t);return;}
    targets.push({unit:u,tenant:t});
  });
  if(!targets.length){
    showToast(recentlyReminded.length?'Overdue tenants were already reminded within the last 24 hours.':'No overdue tenants with an email on file','error');
    return;
  }
  if(!await lcConfirm({title:'Send reminders?',message:`An overdue-rent reminder will be emailed to <strong>${targets.length} tenant(s)</strong>.${recentlyReminded.length?` ${recentlyReminded.length} recently reminded tenant(s) will be skipped.`:''}`,confirmLabel:'Send reminders'})) return;
  const btn=document.getElementById('btn-remind-overdue');
  if(btn){btn.disabled=true;btn.textContent='Sending…';}
  let delivered=0,notDelivered=0,recordingFailed=0;
  try{
    for(const {unit,tenant} of targets){
      const overdueMonths=last12Months().filter(m=>m<currentMonthKey()&&rentStatusForMonth(tenant,m)==='overdue');
      const overdueAmt=overdueAmountForUnit(unit,overdueMonths.length);
      const sent=await notifyByEmail('rent_overdue_alert',{
        tenantName:tenant.full_name,tenantEmail:tenant.email,unitLabel:unit.unit_label,
        monthlyRent:unit.monthly_rent,overdueAmount:overdueAmt,
        sellerName:currentProfile?.full_name,sellerEmail:currentUser?.email
      });
      if(!sent){notDelivered++;continue;}
      delivered++;
      const stage=overdueMonths.length>2?'final_notice':'notice';
      const sentAt=new Date().toISOString();
      const{error:updateError}=await db.from('tenants').update({reminder_stage:stage,last_reminder_sent_at:sentAt}).eq('id',tenant.id);
      if(updateError){console.error('Could not save rent reminder status:',updateError);recordingFailed++;continue;}
      tenant.reminder_stage=stage;tenant.last_reminder_sent_at=sentAt;
      const{error:logError}=await db.from('rent_reminder_log').insert({tenant_id:tenant.id,stage,channel:'email'});
      if(logError){console.error('Could not save rent reminder log:',logError);recordingFailed++;}
    }
  }finally{
    if(btn){btn.disabled=false;btn.textContent='✉️ Remind all overdue';}
  }
  if(delivered)renderRentalUnits();
  const summary=`${delivered} delivered, ${notDelivered} not delivered${recentlyReminded.length?`, ${recentlyReminded.length} skipped (sent in last 24h)`:''}${recordingFailed?`, ${recordingFailed} reminder record(s) need attention`:''}.`;
  showToast(summary,notDelivered||recordingFailed?'error':'success');
}

async function exportAnnualReport(){
  if(!rentalUnitsCache.length){showToast('No rental units to report on','error');return;}
  if(!await ensurePdfLibrary())return;
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'mm',format:'a4'});
  const year=new Date().getFullYear();
  doc.setFillColor(124,58,237);doc.rect(0,0,210,26,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(18);doc.setTextColor(255,255,255);
  doc.text(`${year} Annual Rent Report`,14,16);
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(230,230,255);
  doc.text(`${currentProfile?.full_name||currentUser?.email||''} · Nyumba254 Elite`,14,22);
  let y=36;
  let totalCollected=0, totalDue=0;
  const months=[]; for(let m=0;m<12;m++) months.push(`${year}-${String(m+1).padStart(2,'0')}`);
  rentalUnitsCache.forEach(u=>{
    const t=rlActiveTenant(u); if(!t) return;
    months.forEach(mk=>{
      totalDue += Number(u.monthly_rent)||0;
      const amt=rentAmountForMonth(t,mk); const st=rentStatusForMonth(t,mk);
      if(st==='paid') totalCollected += amt||Number(u.monthly_rent)||0;
      else if(st==='partial') totalCollected += amt;
    });
  });
  doc.setTextColor(26,26,24);doc.setFont('helvetica','bold');doc.setFontSize(12);
  doc.text(`Total rent due: KES ${totalDue.toLocaleString('en-KE')}`,14,y);y+=7;
  doc.text(`Total collected: KES ${totalCollected.toLocaleString('en-KE')}`,14,y);y+=7;
  doc.text(`Collection rate: ${totalDue>0?Math.round(totalCollected/totalDue*100):0}%`,14,y);y+=10;
  doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(255,255,255);
  doc.setFillColor(124,58,237);doc.rect(14,y-4,182,7,'F');
  doc.text('Unit',16,y);doc.text('Tenant',60,y);doc.text('Annual rent (KES)',110,y);doc.text('Collected (KES)',155,y);
  y+=7;
  doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(74,74,70);
  rentalUnitsCache.forEach(u=>{
    if(y>280){doc.addPage();y=20;}
    const t=rlActiveTenant(u);
    let collected=0;
    if(t) months.forEach(mk=>{
      const amt=rentAmountForMonth(t,mk); const st=rentStatusForMonth(t,mk);
      if(st==='paid') collected+=amt||Number(u.monthly_rent)||0; else if(st==='partial') collected+=amt;
    });
    doc.text(String(u.unit_label).slice(0,26),16,y);
    doc.text(t?String(t.full_name).slice(0,22):'(vacant)',60,y);
    doc.text((Number(u.monthly_rent)*12).toLocaleString('en-KE'),110,y);
    doc.text(collected.toLocaleString('en-KE'),155,y);
    y+=6.5;
    doc.setDrawColor(230,230,230);doc.line(14,y-4.5,196,y-4.5);
  });
  doc.save(`Nyumba254-Annual-Rent-Report-${year}.pdf`);
  showToast('Annual report downloaded ✓','success');
}

async function downloadTenantStatementPDF(unitId,tenantId){
  const u=rentalUnitsCache.find(x=>String(x.id)===String(unitId));
  const t=u?.tenants?.find(x=>String(x.id)===String(tenantId));
  if(!u||!t){showToast('Could not find tenant','error');return;}
  if(!await ensurePdfLibrary())return;
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'mm',format:'a4'});
  doc.setFillColor(124,58,237);doc.rect(0,0,210,24,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(16);doc.setTextColor(255,255,255);
  doc.text('Tenant Payment Statement',14,15);
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(230,230,255);
  doc.text(`${t.full_name} — ${u.unit_label}`,14,21);
  let y=34;
  doc.setTextColor(26,26,24);doc.setFont('helvetica','normal');doc.setFontSize(10);
  doc.text(`Landlord: ${currentProfile?.full_name||currentUser?.email||''}`,14,y);y+=6;
  doc.text(`Monthly rent: KES ${Number(u.monthly_rent).toLocaleString('en-KE')}`,14,y);y+=6;
  if(t.lease_end_date){ doc.text(`Lease ends: ${new Date(t.lease_end_date).toLocaleDateString('en-KE')}`,14,y); y+=6; }
  const rel=tenantReliability(t);
  doc.text(`Reliability score: ${rel==null?'Not enough history':rel+'% on-time'}`,14,y);y+=10;
  doc.setFont('helvetica','bold');doc.setFillColor(124,58,237);doc.setTextColor(255,255,255);
  doc.rect(14,y-4,182,7,'F');
  doc.text('Month',16,y);doc.text('Status',90,y);doc.text('Amount (KES)',140,y);
  y+=7;
  doc.setFont('helvetica','normal');doc.setTextColor(74,74,70);
  const payments=(t.rent_payments||[]).slice().sort((a,b)=>new Date(a.period_month)-new Date(b.period_month));
  let totalPaid=0;
  payments.forEach(p=>{
    if(y>280){doc.addPage();y=20;}
    doc.text(new Date(p.period_month).toLocaleDateString('en-KE',{month:'long',year:'numeric'}),16,y);
    doc.text(p.status,90,y);
    doc.text(Number(p.amount||0).toLocaleString('en-KE'),140,y);
    if(p.status==='paid') totalPaid+=Number(p.amount||0);
    y+=6.5;
    doc.setDrawColor(230,230,230);doc.line(14,y-4.5,196,y-4.5);
  });
  y+=6;
  doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(8,80,65);
  doc.text(`Total paid: KES ${totalPaid.toLocaleString('en-KE')}`,14,y);
  doc.save(`${t.full_name.replace(/[^a-z0-9]+/gi,'-')}-statement.pdf`);
}

function rlActiveTenant(u){return (u.tenants||[]).find(t=>t.status==='active');}

// Historical views (past months) must NOT assume "whoever is the CURRENT
// active tenant" was also the tenant during past months — that silently
// erases a former tenant's real payment history the moment they move out.
// This picks whichever tenant's [move_in_date, move_out_date] actually
// covers the given month.
function rlTenantForMonth(u,monthKey){
  const monthStart=monthKey+'-01';
  return (u.tenants||[]).find(t=>{
    if(!t.move_in_date) return t.status==='active'; // no move-in date on file — best guess
    const moveIn=t.move_in_date;
    const moveOut=t.move_out_date||'9999-12-31';
    return moveIn<=monthStart && monthStart<=moveOut;
  })||null;
}

// A past month with no payment record is now auto-flagged "overdue" instead
// of sitting forever as "due" — this alone is what makes the ledger useful.
function rentStatusForMonth(tenant,monthKey){
  const p=(tenant.rent_payments||[]).find(rp=>rp.period_month && rp.period_month.slice(0,7)===monthKey);
  if(p)return p.status;
  return monthKey<currentMonthKey() ? 'overdue' : 'due';
}
function rentAmountForMonth(tenant,monthKey){
  const p=(tenant.rent_payments||[]).find(rp=>rp.period_month && rp.period_month.slice(0,7)===monthKey);
  return p?Number(p.amount)||0:0;
}
function localMonthKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
function localDateKey(d){d=d||new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function lastNMonths(n){const out=[];const d=new Date();for(let i=n-1;i>=0;i--){out.push(localMonthKey(new Date(d.getFullYear(),d.getMonth()-i,1)));}return out;}
function last6Months(){return lastNMonths(6);}
function last12Months(){return lastNMonths(12);}

// Rent owed for a specific overdue month, including any configured late fee —
// used everywhere "overdue amount" is shown so the number a seller sees
// actually matches what they'd ask the tenant for.
function overdueAmountForUnit(u,monthsOverdue){
  const base=Number(u.monthly_rent)||0;
  const pct=Number(u.late_fee_percent)||0;
  return Math.round(base*monthsOverdue*(1+pct/100));
}

// ── Portfolio summary — the numbers a landlord actually opens this page for ──
function renderRentLedgerSummary(){
  const el=document.getElementById('rl-summary-grid');
  if(!el)return;
  const totalUnits=rentalUnitsCache.length;
  const occupied=rentalUnitsCache.filter(u=>rlActiveTenant(u)).length;
  const vacant=totalUnits-occupied;
  const rentRoll=rentalUnitsCache.reduce((s,u)=>s+(rlActiveTenant(u)?Number(u.monthly_rent)||0:0),0);
  const mKey=currentMonthKey();
  let collected=0,overdueAmt=0,overdueCount=0;
  rentalUnitsCache.forEach(u=>{
    const t=rlActiveTenant(u);if(!t)return;
    const status=rentStatusForMonth(t,mKey);
    const amt=rentAmountForMonth(t,mKey);
    if(status==='paid')collected+=amt||Number(u.monthly_rent)||0;
    else if(status==='partial')collected+=amt;
  });
  rentalUnitsCache.forEach(u=>{
    last12Months().filter(m=>m<mKey).forEach(m=>{
      const t=rlTenantForMonth(u,m);if(!t)return;
      if(rentStatusForMonth(t,m)==='overdue'){overdueAmt+=overdueAmountForUnit(u,1);overdueCount++;}
    });
  });
  const collectionRate=rentRoll>0?Math.round((collected/rentRoll)*100):0;
  el.innerHTML=`
    <div class="rl-stat"><div class="rl-label">Total units</div><div class="rl-val">${totalUnits}</div></div>
    <div class="rl-stat good"><div class="rl-label">Occupied</div><div class="rl-val">${occupied}</div></div>
    <div class="rl-stat ${vacant>0?'warn':''}"><div class="rl-label">Vacant</div><div class="rl-val">${vacant}</div></div>
    <div class="rl-stat purple"><div class="rl-label">Monthly rent roll</div><div class="rl-val">KES ${rentRoll.toLocaleString('en-KE')}</div></div>
    <div class="rl-stat good"><div class="rl-label">Collected — ${new Date(mKey+'-01').toLocaleDateString('en-KE',{month:'short'})}</div><div class="rl-val">KES ${collected.toLocaleString('en-KE')}</div></div>
    <div class="rl-stat ${collectionRate>=90?'good':collectionRate>=60?'warn':'danger'}"><div class="rl-label">Collection rate</div><div class="rl-val">${collectionRate}%</div></div>
    <div class="rl-stat ${overdueCount>0?'danger':''}"><div class="rl-label">Overdue (past months)</div><div class="rl-val">KES ${overdueAmt.toLocaleString('en-KE')}${overdueCount?` <span style="font-size:12px;font-weight:600">(${overdueCount})</span>`:''}</div></div>`;
  const badge=document.getElementById('nav-badge-rentledger');
  if(badge){badge.textContent=overdueCount;badge.style.display=overdueCount>0?'inline-block':'none';}
}

// ── Lease expiry alerts ──
function renderLeaseAlerts(){
  const el=document.getElementById('rl-lease-alerts');
  if(!el)return;
  const soon=[];const now=new Date();
  rentalUnitsCache.forEach(u=>{
    const t=rlActiveTenant(u);
    if(!t||!t.lease_end_date)return;
    const days=Math.ceil((new Date(t.lease_end_date)-now)/86400000);
    if(days<=30)soon.push({unit:u,tenant:t,days});
  });
  if(!soon.length){el.style.display='none';el.innerHTML='';return;}
  soon.sort((a,b)=>a.days-b.days);
  el.style.display='block';
  el.innerHTML=`<strong>⏰ ${soon.length} lease${soon.length!==1?'s':''} expiring soon</strong>` +
    soon.map(s=>`${escHtml(s.tenant.full_name)} (${escHtml(s.unit.unit_label)}) — ${s.days<0?`expired ${Math.abs(s.days)}d ago`:s.days===0?'expires today':`expires in ${s.days}d`}`).join(' · ');
}

function rlSetTab(tab){
  rlActiveTab=tab;
  document.querySelectorAll('.rl-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  document.getElementById('rental-units-list').style.display=tab==='units'?'block':'none';
  document.getElementById('rl-units-toolbar').style.display=tab==='units'?'flex':'none';
  document.getElementById('rl-ledger-wrap').style.display=tab==='ledger'?'block':'none';
  document.getElementById('rl-analytics-wrap').style.display=tab==='analytics'?'block':'none';
  document.getElementById('rl-pipeline-wrap').style.display=tab==='pipeline'?'block':'none';
  document.getElementById('rl-finances-wrap').style.display=tab==='finances'?'block':'none';
  document.getElementById('rl-maintenance-wrap').style.display=tab==='maintenance'?'block':'none';
  if(tab==='analytics') renderRentAnalytics();
  if(tab==='pipeline') renderPipeline();
  if(tab==='finances') renderFinancesTab();
  if(tab==='maintenance') renderMaintenanceTab();
}
function rlFilterInput(v){rlSearchQuery=(v||'').toLowerCase();renderRentalUnits();}

function renderRentalUnits(){
  const wrap=document.getElementById('rental-units-list');
  let units=rentalUnitsCache;
  if(rlSearchQuery)units=units.filter(u=>u.unit_label.toLowerCase().includes(rlSearchQuery)||rlActiveTenant(u)?.full_name?.toLowerCase().includes(rlSearchQuery));
  if(!rentalUnitsCache.length){
    wrap.innerHTML=`<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M5 21V7l8-4 8 4v14"/></svg><h3>No rental units yet</h3><p>Add a unit you rent out long-term to start tracking tenants and rent payments.</p><button class="btn btn-primary" onclick="openAddRentalUnitModal()">Add rental unit</button></div>`;
    return;
  }
  if(!units.length){wrap.innerHTML=`<div class="empty-state"><p>No units match "${escHtml(rlSearchQuery)}".</p></div>`;return;}
  const months=last6Months();
  wrap.innerHTML=units.map(u=>{
    const tenant=rlActiveTenant(u);
    const monthCells=tenant?months.map(m=>{
      const st=rentStatusForMonth(tenant,m);
      const label=new Date(m+'-01').toLocaleDateString('en-KE',{month:'short'});
      return `<span class="rl-chip ${st}" style="margin-right:4px" title="${m}">${label}: ${st}</span>`;
    }).join(''):'';
    const leaseTxt=tenant&&tenant.lease_end_date?`Lease ends ${new Date(tenant.lease_end_date).toLocaleDateString('en-KE',{day:'numeric',month:'short',year:'numeric'})}`:'';
    return `<div class="card" style="padding:18px 20px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
        <div>
          <div style="font-weight:700;font-size:14px">${escHtml(u.unit_label)}</div>
          <div style="font-size:12px;color:var(--text-3)">KES ${Number(u.monthly_rent).toLocaleString('en-KE')}/mo${u.notes?' · '+escHtml(u.notes):''}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${tenant?`<button class="btn btn-outline btn-sm" onclick="openLogRentPaymentModal('${u.id}','${tenant.id}')">Log payment</button>`:`<button class="btn btn-primary btn-sm" onclick="openAddTenantModal('${u.id}')">Add tenant</button>`}
          ${tenant?`<button class="btn btn-outline btn-sm" onclick="openTenantDetailModal('${u.id}','${tenant.id}')">View history</button>`:''}
          ${tenant&&tenant.email?`<button class="btn btn-outline btn-sm" onclick="sendStagedReminder('${u.id}','${tenant.id}')">🔔 Remind tenant</button>`:''}
          <button class="btn btn-outline btn-sm" onclick="openEscalationModal('${u.id}')">📈 Escalation</button>
          <button class="btn btn-outline btn-sm" style="color:var(--red);border-color:var(--red)" onclick="openDeleteRentalUnitFlow('${u.id}')">Delete</button>
        </div>
      </div>
      ${(()=>{const esc=rlNextEscalationInfo(u);return esc?`<div style="margin-top:8px"><span class="rl-badge-pill escalation">📈 +${u.escalation_percent}% in ${esc.daysLeft<0?'overdue':esc.daysLeft+'d'} → KES ${esc.newRent.toLocaleString('en-KE')}${esc.daysLeft<=0?` <button class="btn btn-outline btn-sm" style="margin-left:6px;padding:2px 8px" onclick="applyEscalationNow('${u.id}')">Apply now</button>`:''}</span></div>`:'';})()}
      ${tenant?.reminder_stage&&tenant.reminder_stage!=='none'?`<div style="margin-top:6px"><span class="rl-badge-pill reminder">🔔 Last sent: ${tenant.reminder_stage.replace('_',' ')}</span></div>`:''}
      ${tenant?`<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
        <div style="font-size:13px;font-weight:600;margin-bottom:2px">${escHtml(tenant.full_name)}${tenant.phone?' · '+escHtml(tenant.phone):''}</div>
        ${leaseTxt?`<div style="font-size:11.5px;color:var(--text-3);margin-bottom:6px">${leaseTxt}</div>`:''}
        <div style="display:flex;flex-wrap:wrap;gap:4px">${monthCells}</div>
      </div>`:(()=>{const v=rlVacancyInfo(u);return`<div style="margin-top:10px;font-size:12px;color:var(--red)">Vacant ${v.days} day${v.days!==1?'s':''} — approx. KES ${v.lost.toLocaleString('en-KE')} in lost rent. <a href="#" onclick="event.preventDefault();openAddTenantModal('${u.id}')" style="color:var(--red);font-weight:600;text-decoration:underline">Add tenant</a></div>`;})()}
    </div>`;
  }).join('');
}

// ── Full 12-month ledger table ──
function renderFullLedgerTable(){
  const el=document.getElementById('rl-ledger-wrap');
  if(!el)return;
  if(!rentalUnitsCache.length){el.innerHTML='';return;}
  const months=last12Months();
  const head=months.map(m=>`<th>${new Date(m+'-01').toLocaleDateString('en-KE',{month:'short',year:'2-digit'})}</th>`).join('');
  const rows=rentalUnitsCache.map(u=>{
    const activeT=rlActiveTenant(u);
    const cells=months.map(m=>{
      const t=rlTenantForMonth(u,m);
      if(!t)return `<td><span class="rl-chip due">—</span></td>`;
      const st=rentStatusForMonth(t,m);
      return `<td title="${escAttr(t.full_name)}"><span class="rl-chip ${st}">${st}</span></td>`;
    }).join('');
    return `<tr><td class="rl-unit-cell">${escHtml(u.unit_label)}${activeT?`<br><span style="font-weight:400;color:var(--text-3);font-size:11px">${escHtml(activeT.full_name)}</span>`:''}</td>${cells}</tr>`;
  }).join('');
  el.innerHTML=`<div class="rl-ledger-scroll"><table class="rl-ledger-table"><thead><tr><th>Unit / Tenant</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function openAddRentalUnitModal(){
  const sel=document.getElementById('ru-listing');
  sel.innerHTML='<option value="">Not linked to a listing</option>'+allListings.map(l=>`<option value="${l.id}">${escHtml(l.title)}</option>`).join('');
  document.getElementById('ru-label').value='';
  document.getElementById('ru-rent').value='';
  document.getElementById('ru-notes').value='';
  openModal('modal-add-rental-unit');
}
async function saveRentalUnit(){
  const label=document.getElementById('ru-label').value.trim();
  const rent=parseFloat(document.getElementById('ru-rent').value)||0;
  const lateFeePct=parseFloat(document.getElementById('ru-late-fee').value)||0;
  const listingId=document.getElementById('ru-listing').value||null;
  const notes=document.getElementById('ru-notes').value.trim()||null;
  if(!label){showToast('Please name the unit','error');return;}
  const btn=document.getElementById('btn-save-rental-unit');btn.disabled=true;btn.textContent='Saving…';
  const{error}=await db.from('rental_units').insert({seller_id:effectiveSellerId,listing_id:listingId,unit_label:label,monthly_rent:rent,late_fee_percent:lateFeePct,notes});
  btn.disabled=false;btn.textContent='Add unit';
  if(error){showToast('Could not save: '+error.message,'error');return;}
  closeModal('modal-add-rental-unit');
  showToast('Rental unit added ✓','success');
  loadRentalUnits();
}

let ruAddTenantUnitId=null;
function openAddTenantModal(unitId){
  ruAddTenantUnitId=unitId;
  document.getElementById('tn-name').value='';document.getElementById('tn-phone').value='';document.getElementById('tn-email').value='';document.getElementById('tn-movein').value='';document.getElementById('tn-deposit').value='';
  const leaseEl=document.getElementById('tn-lease-end');if(leaseEl)leaseEl.value='';
  openModal('modal-add-tenant');
}
async function saveTenant(){
  const name=document.getElementById('tn-name').value.trim();
  if(!name){showToast('Please enter the tenant name','error');return;}
  const payload={rental_unit_id:ruAddTenantUnitId,full_name:name,phone:document.getElementById('tn-phone').value.trim()||null,email:document.getElementById('tn-email').value.trim()||null,move_in_date:document.getElementById('tn-movein').value||null,deposit_amount:parseFloat(document.getElementById('tn-deposit').value)||null,lease_end_date:document.getElementById('tn-lease-end')?.value||null,status:'active'};
  const btn=document.getElementById('btn-save-tenant');btn.disabled=true;btn.textContent='Saving…';
  // Guard against a second tab/device adding a tenant to the same unit first
  const{count:activeCount}=await db.from('tenants').select('id',{count:'exact',head:true}).eq('rental_unit_id',ruAddTenantUnitId).eq('status','active');
  if(activeCount>0){btn.disabled=false;btn.textContent='Add tenant';showToast('This unit already has an active tenant — refreshing…','error');closeModal('modal-add-tenant');loadRentalUnits();return;}
  const{error}=await db.from('tenants').insert(payload);
  btn.disabled=false;btn.textContent='Add tenant';
  if(error){showToast('Could not save: '+error.message,'error');return;}
  closeModal('modal-add-tenant');
  showToast('Tenant added ✓','success');
  {
    const unit=rentalUnitsCache.find(u=>String(u.id)===String(ruAddTenantUnitId));
    notifyInApp('rent_ledger',`New tenant added: ${name}`,unit?`Moved into ${unit.unit_label}`:'Tenant added to your Rent Ledger.');
  }
  loadRentalUnits();
}

let rpTenantId=null,rpUnitId=null;
function openLogRentPaymentModal(unitId,tenantId){
  rpUnitId=unitId;rpTenantId=tenantId;
  document.getElementById('rp-month').value=currentMonthKey();
  document.getElementById('rp-amount').value='';
  document.getElementById('rp-paiddate').value=new Date().toISOString().slice(0,10);
  document.getElementById('rp-method').value='mpesa';
  document.getElementById('rp-status').value='paid';
  document.getElementById('rp-notes').value='';
  openModal('modal-log-rent-payment');
}
async function saveRentPayment(){
  const monthVal=document.getElementById('rp-month').value;
  if(!monthVal){showToast('Please pick a month','error');return;}
  const periodMonth=monthVal+'-01';
  const payload={tenant_id:rpTenantId,period_month:periodMonth,amount:parseFloat(document.getElementById('rp-amount').value)||0,paid_date:document.getElementById('rp-paiddate').value||null,method:document.getElementById('rp-method').value,status:document.getElementById('rp-status').value,notes:document.getElementById('rp-notes').value.trim()||null};
  const btn=document.getElementById('btn-save-rent-payment');btn.disabled=true;btn.textContent='Saving…';
  const{error}=await db.from('rent_payments').upsert(payload,{onConflict:'tenant_id,period_month'});
  btn.disabled=false;btn.textContent='Save payment';
  if(error){showToast('Could not save: '+error.message,'error');return;}
  closeModal('modal-log-rent-payment');
  showToast('Rent payment recorded ✓','success');
  {
    const u=rentalUnitsCache.find(u=>String(u.id)===String(rpUnitId));
    const t=u?.tenants?.find(t=>String(t.id)===String(rpTenantId));
    const monthLabel=new Date(periodMonth).toLocaleDateString('en-KE',{month:'long',year:'numeric'});
    notifyInApp('rent_ledger',`Rent payment logged — ${monthLabel}`,`${t?t.full_name+' · ':''}${u?u.unit_label+' · ':''}KES ${(payload.amount||0).toLocaleString('en-KE')} (${payload.status})`);
  }
  loadRentalUnits();
}

// ── Tenant detail modal — full history, lease, move-out ──
let tdActiveUnitId=null,tdActiveTenantId=null;
function openTenantDetailModal(unitId,tenantId){
  tdActiveUnitId=unitId;tdActiveTenantId=tenantId;
  const u=rentalUnitsCache.find(x=>String(x.id)===String(unitId));
  const t=u?.tenants?.find(x=>String(x.id)===String(tenantId));
  if(!u||!t){showToast('Could not find tenant','error');return;}
  document.getElementById('td-title').textContent=t.full_name+' — '+u.unit_label;
  const payments=(t.rent_payments||[]).slice().sort((a,b)=>new Date(b.period_month)-new Date(a.period_month));
  const totalPaid=payments.filter(p=>p.status==='paid').reduce((s,p)=>s+Number(p.amount||0),0);
  document.getElementById('td-body').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;font-size:12.5px">
      <div><strong>Phone:</strong> ${escHtml(t.phone||'—')}</div>
      <div><strong>Email:</strong> ${escHtml(t.email||'—')}</div>
      <div><strong>Move-in:</strong> ${t.move_in_date?new Date(t.move_in_date).toLocaleDateString('en-KE',{day:'numeric',month:'short',year:'numeric'}):'—'}</div>
      <div><strong>Lease ends:</strong> ${t.lease_end_date?new Date(t.lease_end_date).toLocaleDateString('en-KE',{day:'numeric',month:'short',year:'numeric'}):'—'}</div>
      <div><strong>Deposit:</strong> ${t.deposit_amount?'KES '+Number(t.deposit_amount).toLocaleString('en-KE'):'—'}</div>
      <div><strong>Total collected:</strong> KES ${totalPaid.toLocaleString('en-KE')}</div>
      <div><strong>Reliability score:</strong> ${(()=>{const r=tenantReliability(t);return r==null?'Not enough history':r+'% on-time';})()}</div>
    </div>
    <button class="btn btn-outline btn-sm" style="margin-bottom:14px" onclick="downloadTenantStatementPDF('${unitId}','${tenantId}')">⬇️ Download statement PDF</button>
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text-3);margin-bottom:8px">Payment history</div>
    <div style="max-height:220px;overflow-y:auto">
      ${payments.length?payments.map(p=>`<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);font-size:12.5px">
        <span>${new Date(p.period_month).toLocaleDateString('en-KE',{month:'long',year:'numeric'})}</span>
        <span class="rl-chip ${p.status}">${p.status}</span>
        <span style="font-weight:600">KES ${Number(p.amount||0).toLocaleString('en-KE')}</span>
      </div>`).join(''):'<div style="color:var(--text-3);font-size:12.5px">No payments logged yet.</div>'}
    </div>
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text-3);margin:16px 0 8px">Documents</div>
    <div id="td-doc-list" style="max-height:160px;overflow-y:auto;margin-bottom:10px"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <select id="td-doc-type" style="padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:12.5px;background:white">
        <option value="lease">Lease</option>
        <option value="id_copy">ID copy</option>
        <option value="inspection_photo">Inspection photo</option>
        <option value="other">Other</option>
      </select>
      <input type="file" id="td-doc-file" accept="image/*,.pdf" style="flex:1;min-width:140px;font-size:12px"/>
      <button class="btn btn-outline btn-sm" id="td-doc-upload-btn" onclick="uploadTenantDocument('${unitId}','${tenantId}')">Upload</button>
    </div>`;
  openModal('modal-tenant-detail');
  loadTenantDocuments(unitId,tenantId);
}
const TENANT_DOCS_BUCKET = 'tenant-docs';

async function loadTenantDocuments(unitId,tenantId){
  const el=document.getElementById('td-doc-list');
  if(!el)return;
  el.innerHTML='<div style="color:var(--text-3);font-size:12px">Loading documents…</div>';
  const{data,error}=await db.from('tenant_documents').select('*').eq('tenant_id',tenantId).order('created_at',{ascending:false});
  if(error){el.innerHTML=`<div style="color:var(--red);font-size:12px">Could not load: ${escHtml(error.message)}</div>`;return;}
  if(!data||!data.length){el.innerHTML='<div style="color:var(--text-3);font-size:12.5px">No documents uploaded yet.</div>';return;}
  const rows=await Promise.all(data.map(async d=>{
    const{data:signed,error:signedError}=await db.storage.from(TENANT_DOCS_BUCKET).createSignedUrl(d.file_path,3600);
    if(signedError) console.error('Could not create tenant document link:',signedError);
    return{...d,url:signedError?null:safeHttpLink(signed?.signedUrl)};
  }));
  el.innerHTML=rows.map(d=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);font-size:12.5px">
      ${d.url?`<a href="${escAttr(d.url)}" target="_blank" rel="noopener noreferrer" style="color:var(--green-dark);font-weight:600;text-decoration:underline;word-break:break-all">${escHtml(d.doc_type||'Document')} — ${escHtml(d.file_name||'')}</a>`:`<span style="color:var(--text-3)">${escHtml(d.doc_type||'Document')} — ${escHtml(d.file_name||'')} (link unavailable)</span>`}
      <button class="btn btn-outline btn-sm" style="color:var(--red);border-color:var(--red);flex-shrink:0;margin-left:8px" onclick="deleteTenantDocument(${d.id},'${unitId}','${tenantId}')">Delete</button>
    </div>`).join('');
}

async function uploadTenantDocument(unitId,tenantId){
  const fileInput=document.getElementById('td-doc-file');
  const typeSelect=document.getElementById('td-doc-type');
  const file=fileInput.files[0];
  if(!file){showToast('Please choose a file first','error');return;}
  const btn=document.getElementById('td-doc-upload-btn');
  btn.disabled=true;btn.textContent='Uploading…';
  try{
    const ext=(file.name.split('.').pop()||'pdf').toLowerCase();
    const path=`${effectiveSellerId}/${tenantId}/${typeSelect.value}-${Date.now()}.${ext}`;
    const{error:upErr}=await db.storage.from(TENANT_DOCS_BUCKET).upload(path,file,{upsert:false});
    if(upErr)throw upErr;
    const{error:insErr}=await db.from('tenant_documents').insert({tenant_id:tenantId,rental_unit_id:unitId,seller_id:effectiveSellerId,doc_type:typeSelect.value,file_name:file.name,file_path:path});
    if(insErr)throw insErr;
    fileInput.value='';
    showToast('Document uploaded ✓','success');
    loadTenantDocuments(unitId,tenantId);
  }catch(e){
    showToast('Upload failed: '+(e.message||String(e)),'error');
  }finally{
    btn.disabled=false;btn.textContent='Upload';
  }
}

async function deleteTenantDocument(docId,unitId,tenantId){
  if(!await lcConfirm({title:'Delete document?',message:'This document will be permanently removed.',confirmLabel:'Delete',danger:true}))return;
  const{data:row}=await db.from('tenant_documents').select('file_path').eq('id',docId).maybeSingle();
  const{error}=await db.from('tenant_documents').delete().eq('id',docId);
  if(error){showToast('Could not delete: '+error.message,'error');return;}
  if(row?.file_path){await db.storage.from(TENANT_DOCS_BUCKET).remove([row.file_path]).catch(()=>{});}
  showToast('Document deleted','success');
  loadTenantDocuments(unitId,tenantId);
}

async function moveOutTenant(){
  if(!tdActiveTenantId)return;
  if(!await lcConfirm({title:'Mark as moved out?',message:'The unit will become vacant and ready for a new tenant.',confirmLabel:'Mark moved out'}))return;
  const{error}=await db.from('tenants').update({status:'past',move_out_date:new Date().toISOString().slice(0,10)}).eq('id',tdActiveTenantId);
  if(error){showToast('Could not update: '+error.message,'error');return;}
  closeModal('modal-tenant-detail');
  showToast('Tenant marked as moved out ✓','success');
  {
    const u=rentalUnitsCache.find(x=>String(x.id)===String(tdActiveUnitId));
    const t=u?.tenants?.find(x=>String(x.id)===String(tdActiveTenantId));
    notifyInApp('rent_ledger',`Tenant moved out${t?': '+t.full_name:''}`,u?`${u.unit_label} is now vacant.`:'A unit is now vacant.');
  }
  loadRentalUnits();
}

async function openDeleteRentalUnitFlow(id){
  const label=(rentalUnitsCache.find(u=>String(u.id)===String(id))||{}).unit_label||'this unit';
  if(!await lcConfirm({title:'Delete rental unit?',message:`<strong>${escHtml(label)}</strong> and its tenant and payment history will be removed.`,confirmLabel:'Delete',danger:true}))return;
  deleteRentalUnit(id);
}
async function deleteRentalUnit(id){
  const{data:tRows}=await db.from('tenants').select('id').eq('rental_unit_id',id);
  const tenantIds=(tRows||[]).map(t=>t.id);
  if(tenantIds.length)await db.from('rent_payments').delete().in('tenant_id',tenantIds);
  await db.from('tenants').delete().eq('rental_unit_id',id);
  const{error}=await db.from('rental_units').delete().eq('id',id);
  if(error){showToast('Could not delete: '+error.message,'error');return;}
  showToast('Rental unit deleted','success');
  loadRentalUnits();
}

async function sendRentReminder(unitId,tenantId){
  const u=rentalUnitsCache.find(x=>x.id===unitId);
  const tenant=u?.tenants?.find(t=>t.id===tenantId);
  if(!tenant?.email){showToast('This tenant has no email on file','error');return;}
  await notifyByEmail('rent_reminder',{tenantName:tenant.full_name,tenantEmail:tenant.email,unitLabel:u.unit_label,monthlyRent:u.monthly_rent,sellerName:currentProfile?.full_name,sellerEmail:currentUser?.email});
  showToast('Reminder sent ✓','success');
}

// ── Exports — CSV (raw data) + PDF (formatted rent-roll report) ──
function rlDownloadBlob(filename,content,mime){
  const blob=new Blob([mime==='text/csv'?'\uFEFF'+content:content],{type:mime});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportRentLedgerCSV(){
  if(!rentalUnitsCache.length){showToast('No rental units to export','error');return;}
  const months=last12Months();
  const rows=[['Unit','Tenant','Monthly Rent',...months.map(m=>new Date(m+'-01').toLocaleDateString('en-KE',{month:'short',year:'numeric'}))]];
  rentalUnitsCache.forEach(u=>{
    const t=rlActiveTenant(u);
    rows.push([u.unit_label,t?t.full_name:'(vacant)',u.monthly_rent,...months.map(m=>t?rentStatusForMonth(t,m):'—')]);
  });
  const csv=rows.map(r=>r.map(v=>csvCell(v)).join(',')).join('\n');
  rlDownloadBlob(`Nyumba254-Rent-Ledger-${currentMonthKey()}.csv`,csv,'text/csv');
  showToast('CSV exported ✓','success');
}
async function exportRentLedgerPDF(){
  if(!rentalUnitsCache.length){showToast('No rental units to export','error');return;}
  if(!await ensurePdfLibrary())return;
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'mm',format:'a4'});
  const mKey=currentMonthKey();
  doc.setFillColor(124,58,237);doc.rect(0,0,210,24,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(16);doc.setTextColor(255,255,255);
  doc.text('Nyumba254 — Rent Roll Report',14,15);
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(230,230,255);
  doc.text(`${currentProfile?.full_name||currentUser?.email||''} · Generated ${new Date().toLocaleDateString('en-KE',{day:'numeric',month:'long',year:'numeric'})}`,14,21);

  let y=34;
  const rentRoll=rentalUnitsCache.reduce((s,u)=>s+(rlActiveTenant(u)?Number(u.monthly_rent)||0:0),0);
  const occupied=rentalUnitsCache.filter(u=>rlActiveTenant(u)).length;
  doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(26,26,24);
  doc.text(`${occupied} of ${rentalUnitsCache.length} units occupied · Monthly rent roll KES ${rentRoll.toLocaleString('en-KE')}`,14,y);
  y+=10;

  doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(255,255,255);
  doc.setFillColor(124,58,237);doc.rect(14,y-4,182,7,'F');
  doc.text('Unit',16,y);doc.text('Tenant',60,y);doc.text('Rent (KES)',110,y);doc.text('This month',150,y);
  y+=7;
  doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(74,74,70);
  rentalUnitsCache.forEach(u=>{
    if(y>280){doc.addPage();y=20;}
    const t=rlActiveTenant(u);
    const status=t?rentStatusForMonth(t,mKey):'vacant';
    doc.text(String(u.unit_label).slice(0,26),16,y);
    doc.text(t?String(t.full_name).slice(0,26):'—',60,y);
    doc.text(Number(u.monthly_rent).toLocaleString('en-KE'),110,y);
    doc.text(status,150,y);
    y+=6.5;
    doc.setDrawColor(230,230,230);doc.line(14,y-4.5,196,y-4.5);
  });
  doc.save(`Nyumba254-Rent-Roll-${mKey}.pdf`);
  showToast('Rent roll PDF downloaded ✓','success');
}

// ══════════════════════════════════════
// RENT LEDGER v3 — automation, health scoring, finances, pipeline
// ══════════════════════════════════════
let unitExpensesCache=[],maintenanceCache=[];

async function rlLoadExtras(){
  if(!ledgerAccessActive())return;
  const[{data:exp},{data:maint}]=await Promise.all([
    db.from('unit_expenses').select('*').eq('seller_id',effectiveSellerId).order('expense_date',{ascending:false}),
    db.from('maintenance_requests').select('*').eq('seller_id',effectiveSellerId).order('reported_date',{ascending:false}),
  ]);
  unitExpensesCache=exp||[];
  maintenanceCache=maint||[];
}

// ── Health Score: 0-100 composite per unit ──
function rlHealthScore(u){
  const t=rlActiveTenant(u);
  let score=0;
  // Occupancy (30 pts)
  score += t ? 30 : 0;
  if(!t) return Math.round(score);
  // Collection rate this month (30 pts)
  const st=rentStatusForMonth(t,currentMonthKey());
  score += st==='paid'?30:st==='partial'?15:0;
  // Reliability last 12mo (25 pts)
  const rel=tenantReliability(t);
  score += rel==null?12:Math.round((rel/100)*25);
  // Lease risk (15 pts) — full points unless expiring soon/expired
  if(t.lease_end_date){
    const days=Math.ceil((new Date(t.lease_end_date)-new Date())/86400000);
    score += days<0?0:days<=30?7:15;
  }else{
    score += 15;
  }
  return Math.max(0,Math.min(100,Math.round(score)));
}
function rlHealthClass(score){return score>=75?'health-good':score>=45?'health-warn':'health-bad';}
function rlHealthColor(score){return score>=75?'#16a34a':score>=45?'var(--amber)':'var(--red)';}

function renderPortfolioHealthCard(){
  const el=document.getElementById('rl-portfolio-health-card');
  if(!el)return;
  if(!rentalUnitsCache.length){el.innerHTML='';return;}
  const scores=rentalUnitsCache.map(rlHealthScore);
  const avg=Math.round(scores.reduce((a,b)=>a+b,0)/scores.length);
  const circumference=2*Math.PI*28;
  const offset=circumference*(1-avg/100);
  el.innerHTML=`
    <div class="rl-health-ring">
      <svg viewBox="0 0 64 64"><circle class="rl-ring-bg" cx="32" cy="32" r="28"/><circle class="rl-ring-fill" cx="32" cy="32" r="28" stroke="${rlHealthColor(avg)}" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"/></svg>
      <div class="rl-ring-num">${avg}</div>
    </div>
    <div style="flex:1;min-width:200px">
      <div style="font-weight:700;font-size:14px;margin-bottom:2px">Portfolio Health Score</div>
      <div style="font-size:12.5px;color:var(--text-3);line-height:1.6">Blends occupancy, this month's collection, 12-month payment reliability, and lease-expiry risk into one number. ${avg>=75?'Your portfolio is in great shape. 🎉':avg>=45?'A few things need attention — check units flagged amber/red below.':'Several units need attention — check overdue rent and expiring leases.'}</div>
    </div>`;
}

// ── Arrears aging buckets ──
function rlAgingBuckets(){
  const buckets={b30:0,b60:0,b90:0,b90p:0};
  const now=new Date();
  rentalUnitsCache.forEach(u=>{
    last12Months().filter(m=>m<currentMonthKey()).forEach(m=>{
      const t=rlTenantForMonth(u,m);if(!t)return;
      if(rentStatusForMonth(t,m)!=='overdue')return;
      const days=Math.floor((now-new Date(m+'-01'))/86400000);
      const amt=overdueAmountForUnit(u,1);
      if(days<=30)buckets.b30+=amt;
      else if(days<=60)buckets.b60+=amt;
      else if(days<=90)buckets.b90+=amt;
      else buckets.b90p+=amt;
    });
  });
  return buckets;
}
function renderAgingCard(){
  const b=rlAgingBuckets();
  const total=b.b30+b.b60+b.b90+b.b90p;
  const pct=(v)=>total>0?Math.round((v/total)*100):0;
  const wrap=document.getElementById('rl-goal-card'); // reused container area below, see finances tab instead
  return `<div class="card" style="padding:18px 20px;margin-bottom:16px">
    <h3 style="font-size:13.5px;font-weight:700;margin-bottom:10px">⏳ Arrears aging</h3>
    ${total===0?'<div style="font-size:12.5px;color:var(--text-3)">No arrears — clean sheet! 🎉</div>':`
    <div class="rl-aging-bar">
      <div class="rl-aging-seg" style="width:${pct(b.b30)}%;background:var(--amber)"></div>
      <div class="rl-aging-seg" style="width:${pct(b.b60)}%;background:#f97316"></div>
      <div class="rl-aging-seg" style="width:${pct(b.b90)}%;background:#dc2626"></div>
      <div class="rl-aging-seg" style="width:${pct(b.b90p)}%;background:#7f1d1d"></div>
    </div>
    <div class="rl-aging-legend">
      <span><i class="rl-aging-dot" style="background:var(--amber)"></i>0–30d: KES ${b.b30.toLocaleString('en-KE')}</span>
      <span><i class="rl-aging-dot" style="background:#f97316"></i>31–60d: KES ${b.b60.toLocaleString('en-KE')}</span>
      <span><i class="rl-aging-dot" style="background:#dc2626"></i>61–90d: KES ${b.b90.toLocaleString('en-KE')}</span>
      <span><i class="rl-aging-dot" style="background:#7f1d1d"></i>90d+: KES ${b.b90p.toLocaleString('en-KE')}</span>
    </div>`}
  </div>`;
}

// ── Cash-flow forecast (next 3 months) ──
function renderForecastCard(){
  const months=[];
  const d=new Date();d.setDate(1);
  for(let i=1;i<=3;i++){const m=new Date(d.getFullYear(),d.getMonth()+i,1);months.push(m);}
  const activeRent=rentalUnitsCache.reduce((s,u)=>s+(rlActiveTenant(u)?Number(u.monthly_rent)||0:0),0);
  const rows=months.map(m=>{
    // account for known upcoming lease expiries reducing forecast
    const expiring=rentalUnitsCache.filter(u=>{
      const t=rlActiveTenant(u);
      if(!t||!t.lease_end_date)return false;
      const le=new Date(t.lease_end_date);
      return le.getFullYear()===m.getFullYear()&&le.getMonth()===m.getMonth();
    });
    const atRisk=expiring.reduce((s,u)=>s+(Number(u.monthly_rent)||0),0);
    return`<div class="rl-forecast-row"><span>${m.toLocaleDateString('en-KE',{month:'long',year:'numeric'})}</span><span style="text-align:right"><strong>KES ${activeRent.toLocaleString('en-KE')}</strong>${atRisk>0?`<div style="font-size:11px;color:var(--amber)">⚠️ KES ${atRisk.toLocaleString('en-KE')} at risk — lease(s) expiring</div>`:''}</span></div>`;
  }).join('');
  return `<div class="card" style="padding:18px 20px;margin-bottom:16px">
    <h3 style="font-size:13.5px;font-weight:700;margin-bottom:6px">📈 3-month cash-flow forecast</h3>
    <p style="font-size:11.5px;color:var(--text-3);margin-bottom:10px">Based on currently active leases. Amounts at risk reflect leases expiring that month.</p>
    ${rows||'<div style="font-size:12.5px;color:var(--text-3)">No active tenants to forecast yet.</div>'}
  </div>`;
}

// ── Payment calendar heatmap (12 months) ──
function renderHeatmapCard(){
  const months=last12Months();
  const rate=months.map(rlCollectionRateForMonth);
  const cellColor=(r)=>{if(r==null)return'var(--border)';if(r>=90)return'#16a34a';if(r>=70)return'#86efac';if(r>=40)return'var(--amber)';return'var(--red)';};
  const cells=rate.map((r,i)=>`<div class="rl-heatmap-cell" style="background:${cellColor(r)}" title="${new Date(months[i]+'-01').toLocaleDateString('en-KE',{month:'long',year:'numeric'})}: ${r==null?'no active tenants':r+'% collected'}"></div>`).join('');
  const labels=months.map(m=>`<span>${new Date(m+'-01').toLocaleDateString('en-KE',{month:'short'})}</span>`).join('');
  return `<div class="card" style="padding:18px 20px;margin-bottom:16px">
    <h3 style="font-size:13.5px;font-weight:700;margin-bottom:10px">🗓️ Collection heatmap — 12 months</h3>
    <div class="rl-heatmap">${cells}</div>
    <div class="rl-heatmap-labels">${labels}</div>
  </div>`;
}

// ── Reliability leaderboard ──
function renderLeaderboardCard(){
  const rows=rentalUnitsCache.map(u=>({u,t:rlActiveTenant(u)})).filter(x=>x.t)
    .map(x=>({name:x.t.full_name,unit:x.u.unit_label,rel:tenantReliability(x.t)}))
    .filter(x=>x.rel!==null).sort((a,b)=>b.rel-a.rel);
  if(!rows.length)return'';
  const medal=(i)=>i===0?'gold':i===1?'silver':i===2?'bronze':'';
  return `<div class="card" style="padding:18px 20px;margin-bottom:16px">
    <h3 style="font-size:13.5px;font-weight:700;margin-bottom:8px">🏆 Tenant reliability leaderboard</h3>
    ${rows.slice(0,8).map((r,i)=>`<div class="rl-leaderboard-row"><span class="rl-leaderboard-rank ${medal(i)}">${i+1}</span><span style="flex:1"><strong>${escHtml(r.name)}</strong><div style="color:var(--text-3);font-size:11px">${escHtml(r.unit)}</div></span><span style="font-weight:700;color:${r.rel>=85?'#16a34a':r.rel>=60?'var(--amber)':'var(--red)'}">${r.rel}%</span></div>`).join('')}
  </div>`;
}

// ── Rent-roll goal tracker ──
function renderGoalCard(){
  const el=document.getElementById('rl-goal-card');
  if(!el)return;
  const goal=Number(currentProfile?.rent_roll_goal)||0;
  const current=rentalUnitsCache.reduce((s,u)=>s+(rlActiveTenant(u)?Number(u.monthly_rent)||0:0),0);
  if(!goal){el.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px"><div><strong style="font-size:13.5px">Set a rent-roll goal</strong><div style="font-size:12px;color:var(--text-3)">Track your progress toward a monthly income target</div></div><button class="btn btn-outline btn-sm" onclick="openRentGoalModal()">Set goal</button></div>`;return;}
  const pct=Math.min(100,Math.round((current/goal)*100));
  el.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px"><strong style="font-size:13.5px">🎯 Rent-roll goal</strong><span style="font-size:12px;color:var(--text-3)">KES ${current.toLocaleString('en-KE')} of ${goal.toLocaleString('en-KE')}</span></div>
    <div class="rl-goal-bar"><div class="rl-goal-fill" style="width:${pct}%"><span>${pct}%</span></div></div>
    <div style="text-align:right"><button class="btn btn-outline btn-sm" onclick="openRentGoalModal()">Edit goal</button></div>`;
}
function openRentGoalModal(){document.getElementById('goal-amount').value=currentProfile?.rent_roll_goal||'';openModal('modal-rent-goal');}
async function saveRentGoal(){
  const val=parseFloat(document.getElementById('goal-amount').value)||0;
  const isBnbGoal=document.getElementById('modal-rent-goal').dataset.mode==='bnb';
  const error=await updateOwnerProfile(isBnbGoal?{bnb_revenue_goal:val}:{rent_roll_goal:val});
  if(error){showToast('Could not save: '+error.message,'error');return;}
  closeModal('modal-rent-goal');
  if(isBnbGoal){ renderBnbGoalCard(); delete document.getElementById('modal-rent-goal').dataset.mode; document.getElementById('modal-rent-goal').querySelector('h3').textContent='Set a rent-roll goal'; }
  else renderGoalCard();
  showToast('Goal saved ✓','success');
}

// ── Lease pipeline (Kanban: 30/60/90 day expiry buckets) ──
function renderPipeline(){
  const wrap=document.getElementById('rl-pipeline-wrap');
  if(!wrap)return;
  const now=new Date();
  const buckets={b30:[],b60:[],b90:[]};
  rentalUnitsCache.forEach(u=>{
    const t=rlActiveTenant(u);
    if(!t||!t.lease_end_date)return;
    const days=Math.ceil((new Date(t.lease_end_date)-now)/86400000);
    if(days<0||days>90)return;
    const item={u,t,days};
    if(days<=30)buckets.b30.push(item);else if(days<=60)buckets.b60.push(item);else buckets.b90.push(item);
  });
  const col=(title,items,color)=>`<div class="rl-kanban-col"><h4>${title}<span>${items.length}</span></h4>${items.length?items.map(i=>`<div class="rl-kanban-card"><strong>${escHtml(i.t.full_name)}</strong>${escHtml(i.u.unit_label)}<div style="margin-top:4px;color:${color};font-weight:700">${i.days}d left · ${new Date(i.t.lease_end_date).toLocaleDateString('en-KE',{day:'numeric',month:'short'})}</div><button class="btn btn-outline btn-sm" style="margin-top:6px" onclick="openTenantDetailModal('${i.u.id}','${i.t.id}')">Renew / view</button></div>`).join(''):'<div style="font-size:11.5px;color:var(--text-3)">Nothing here</div>'}</div>`;
  wrap.innerHTML=`<div class="rl-kanban">${col('⚠️ Expiring in 30 days',buckets.b30,'var(--red)')}${col('Expiring in 60 days',buckets.b60,'var(--amber)')}${col('Expiring in 90 days',buckets.b90,'#2563eb')}</div>`;
}

// ── Finances tab: P&L, expenses, deposits ──
function renderFinancesTab(){
  const wrap=document.getElementById('rl-finances-wrap');
  if(!wrap)return;
  const rentCollected=(()=>{let s=0;rentalUnitsCache.forEach(u=>{const t=rlActiveTenant(u);if(!t)return;last12Months().forEach(m=>{const st=rentStatusForMonth(t,m);const amt=rentAmountForMonth(t,m);if(st==='paid')s+=amt||Number(u.monthly_rent)||0;else if(st==='partial')s+=amt;});});return s;})();
  const totalExpenses=unitExpensesCache.filter(e=>last12Months().includes(String(e.expense_date).slice(0,7))).reduce((s,e)=>s+(Number(e.amount)||0),0);
  const net=rentCollected-totalExpenses;
  const byCategory={};
  unitExpensesCache.forEach(e=>{byCategory[e.category]=(byCategory[e.category]||0)+Number(e.amount||0);});
  const catMax=Math.max(...Object.values(byCategory),1);
  wrap.innerHTML=`
    <div class="rl-summary-grid" style="margin-bottom:16px">
      <div class="rl-stat good"><div class="rl-label">Rent collected (12mo)</div><div class="rl-val">KES ${rentCollected.toLocaleString('en-KE')}</div></div>
      <div class="rl-stat danger"><div class="rl-label">Expenses (12mo)</div><div class="rl-val">KES ${totalExpenses.toLocaleString('en-KE')}</div></div>
      <div class="rl-stat ${net>=0?'good':'danger'}"><div class="rl-label">Net income</div><div class="rl-val">KES ${net.toLocaleString('en-KE')}</div></div>
    </div>
    <div class="card" style="padding:18px 20px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3 style="font-size:13.5px;font-weight:700">Expenses by category</h3><button class="btn btn-primary btn-sm" style="background:#7c3aed" onclick="openAddExpenseModal()">+ Log expense</button></div>
      ${Object.keys(byCategory).length?Object.entries(byCategory).map(([k,v])=>`<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span style="text-transform:capitalize">${k.replace('_',' ')}</span><span style="color:var(--text-3)">KES ${v.toLocaleString('en-KE')}</span></div><div style="background:var(--surface);border-radius:6px;height:6px;overflow:hidden"><div style="background:#7c3aed;height:100%;width:${Math.round((v/catMax)*100)}%"></div></div></div>`).join(''):'<div style="font-size:12.5px;color:var(--text-3)">No expenses logged yet.</div>'}
      <div style="max-height:220px;overflow-y:auto;margin-top:10px">
        ${unitExpensesCache.slice(0,20).map(e=>{const u=rentalUnitsCache.find(x=>x.id===e.rental_unit_id);return`<div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid var(--border);font-size:12px"><span>${new Date(e.expense_date).toLocaleDateString('en-KE',{day:'numeric',month:'short'})} · ${escHtml(u?.unit_label||'—')} · ${escHtml(e.description||e.category)}</span><span style="font-weight:600">KES ${Number(e.amount).toLocaleString('en-KE')}</span></div>`;}).join('')}
      </div>
    </div>
    <div class="card" style="padding:18px 20px">
      <h3 style="font-size:13.5px;font-weight:700;margin-bottom:12px">🔐 Deposits</h3>
      ${rentalUnitsCache.map(u=>{const t=rlActiveTenant(u);if(!t||!t.deposit_amount)return'';const status=t.deposit_status||'held';const refunded=Number(t.deposit_refunded_amount)||0;return`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:12.5px"><span><strong>${escHtml(t.full_name)}</strong> · ${escHtml(u.unit_label)}<div style="color:var(--text-3);font-size:11px">Deposit: KES ${Number(t.deposit_amount).toLocaleString('en-KE')}${refunded?' · Refunded: KES '+refunded.toLocaleString('en-KE'):''}</div></span><span style="display:flex;gap:8px;align-items:center"><span class="rl-chip ${status==='refunded'?'paid':status==='forfeited'?'overdue':'due'}">${status.replace('_',' ')}</span><button class="btn btn-outline btn-sm" onclick="openDepositModal('${u.id}','${t.id}')">Manage</button></span></div>`;}).join('')||'<div style="font-size:12.5px;color:var(--text-3)">No deposits on file.</div>'}
    </div>`;
}

let depActiveUnitId=null,depActiveTenantId=null;
function openDepositModal(unitId,tenantId){
  const u=rentalUnitsCache.find(x=>String(x.id)===String(unitId));
  const t=u?.tenants?.find(x=>String(x.id)===String(tenantId));
  if(!t)return;
  depActiveUnitId=unitId;depActiveTenantId=tenantId;
  document.getElementById('dep-status').value=t.deposit_status||'held';
  document.getElementById('dep-refund-amount').value=t.deposit_refunded_amount||'';
  document.getElementById('dep-refund-date').value=t.deposit_refund_date||'';
  document.getElementById('dep-notes').value=t.deposit_deduction_notes||'';
  openModal('modal-deposit');
}
async function saveDeposit(){
  const payload={deposit_status:document.getElementById('dep-status').value,deposit_refunded_amount:parseFloat(document.getElementById('dep-refund-amount').value)||0,deposit_refund_date:document.getElementById('dep-refund-date').value||null,deposit_deduction_notes:document.getElementById('dep-notes').value.trim()||null};
  const{error}=await db.from('tenants').update(payload).eq('id',depActiveTenantId);
  if(error){showToast('Could not save: '+error.message,'error');return;}
  closeModal('modal-deposit');showToast('Deposit updated ✓','success');loadRentalUnits();
}

function openAddExpenseModal(){
  const sel=document.getElementById('exp-unit');
  sel.innerHTML=rentalUnitsCache.map(u=>`<option value="${u.id}">${escHtml(u.unit_label)}</option>`).join('');
  document.getElementById('exp-amount').value='';document.getElementById('exp-desc').value='';
  document.getElementById('exp-date').value=new Date().toISOString().slice(0,10);
  openModal('modal-add-expense');
}
async function saveExpense(){
  const selEl=document.getElementById('exp-unit');
  const isBnbExp=selEl.dataset.mode==='bnb';
  const payload={seller_id:effectiveSellerId,category:document.getElementById('exp-category').value,amount:parseFloat(document.getElementById('exp-amount').value)||0,expense_date:document.getElementById('exp-date').value||new Date().toISOString().slice(0,10),description:document.getElementById('exp-desc').value.trim()||null,rental_unit_id:isBnbExp?null:selEl.value,bnb_property_id:isBnbExp?selEl.value:null};
  const{error}=await db.from('unit_expenses').insert(payload);
  if(error){showToast('Could not save: '+error.message,'error');return;}
  closeModal('modal-add-expense');showToast('Expense logged ✓','success');
  delete selEl.dataset.mode;
  await rlLoadExtras();
  if(isBnbExp) renderBnbFinances(); else renderFinancesTab();
}

// ── Maintenance tab ──
function renderMaintenanceTab(){
  const wrap=document.getElementById('rl-maintenance-wrap');
  if(!wrap)return;
  const open=maintenanceCache.filter(m=>m.status!=='done');
  const done=maintenanceCache.filter(m=>m.status==='done');
  const row=(m)=>{const u=rentalUnitsCache.find(x=>x.id===m.rental_unit_id);return`<div class="card" style="padding:14px 16px;margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
      <div><strong style="font-size:13px">${escHtml(m.title)}</strong><div style="font-size:11.5px;color:var(--text-3)">${escHtml(u?.unit_label||'—')} · Reported ${new Date(m.reported_date).toLocaleDateString('en-KE',{day:'numeric',month:'short'})}</div></div>
      <span class="rl-chip ${m.status==='done'?'paid':m.status==='in_progress'?'partial':'due'}">${m.status.replace('_',' ')}</span>
    </div>
    ${m.notes?`<div style="font-size:12.5px;color:var(--text-2);margin-top:6px">${escHtml(m.notes)}</div>`:''}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
      <span style="font-size:12px;font-weight:700;color:var(--text)">${m.cost?'KES '+Number(m.cost).toLocaleString('en-KE'):'No cost logged'}</span>
      ${m.status!=='done'?`<button class="btn btn-outline btn-sm" onclick="markMaintenanceDone(${m.id})">Mark done</button>`:''}
    </div></div>`;};
  wrap.innerHTML=`<div style="display:flex;justify-content:flex-end;margin-bottom:12px"><button class="btn btn-primary btn-sm" style="background:#7c3aed" onclick="openAddMaintenanceModal()">+ Log request</button></div>
    <h3 style="font-size:13px;font-weight:700;margin-bottom:8px">Open (${open.length})</h3>
    ${open.length?open.map(row).join(''):'<div style="font-size:12.5px;color:var(--text-3);margin-bottom:16px">Nothing open — nice! 🎉</div>'}
    ${done.length?`<h3 style="font-size:13px;font-weight:700;margin:16px 0 8px">Completed (${done.length})</h3>${done.slice(0,10).map(row).join('')}`:''}`;
}
function openAddMaintenanceModal(){
  const sel=document.getElementById('mt-unit');
  sel.innerHTML=rentalUnitsCache.map(u=>`<option value="${u.id}">${escHtml(u.unit_label)}</option>`).join('');
  document.getElementById('mt-title').value='';document.getElementById('mt-notes').value='';document.getElementById('mt-cost').value='';document.getElementById('mt-status').value='open';
  openModal('modal-add-maintenance');
}
async function saveMaintenance(){
  const selEl=document.getElementById('mt-unit');
  const isBnbMaint=selEl.dataset.mode==='bnb';
  const payload={seller_id:effectiveSellerId,title:document.getElementById('mt-title').value.trim(),notes:document.getElementById('mt-notes').value.trim()||null,status:document.getElementById('mt-status').value,cost:parseFloat(document.getElementById('mt-cost').value)||0,rental_unit_id:isBnbMaint?null:selEl.value,bnb_property_id:isBnbMaint?selEl.value:null};
  if(!payload.title){showToast('Please give the request a title','error');return;}
  const{error}=await db.from('maintenance_requests').insert(payload);
  if(error){showToast('Could not save: '+error.message,'error');return;}
  closeModal('modal-add-maintenance');showToast('Maintenance request logged ✓','success');
  delete selEl.dataset.mode;
  await rlLoadExtras();
  if(isBnbMaint) renderBnbMaintenance(); else renderMaintenanceTab();
}
async function markMaintenanceDone(id){
  const{error}=await db.from('maintenance_requests').update({status:'done',resolved_date:new Date().toISOString().slice(0,10)}).eq('id',id);
  if(error){showToast('Could not update: '+error.message,'error');return;}
  showToast('Marked done ✓','success');
  await rlLoadExtras();renderMaintenanceTab();
}

// ── Rent escalation ──
let escActiveUnitId=null;
function openEscalationModal(unitId){
  const u=rentalUnitsCache.find(x=>String(x.id)===String(unitId));if(!u)return;
  escActiveUnitId=unitId;
  document.getElementById('esc-percent').value=u.escalation_percent||'';
  document.getElementById('esc-freq').value=u.escalation_frequency_months||12;
  openModal('modal-escalation');
}
async function saveEscalation(){
  const payload={escalation_percent:parseFloat(document.getElementById('esc-percent').value)||0,escalation_frequency_months:parseInt(document.getElementById('esc-freq').value)||12};
  const{error}=await db.from('rental_units').update(payload).eq('id',escActiveUnitId);
  if(error){showToast('Could not save: '+error.message,'error');return;}
  closeModal('modal-escalation');showToast('Escalation schedule saved ✓','success');
  loadRentalUnits();
}
function rlNextEscalationInfo(u){
  if(!u.escalation_percent)return null;
  const base=u.last_escalation_date?new Date(u.last_escalation_date):new Date(u.created_at);
  const next=new Date(base);next.setMonth(next.getMonth()+(u.escalation_frequency_months||12));
  const daysLeft=Math.ceil((next-new Date())/86400000);
  const newRent=Math.round(Number(u.monthly_rent)*(1+u.escalation_percent/100));
  return{next,daysLeft,newRent};
}
async function applyEscalationNow(unitId){
  const u=rentalUnitsCache.find(x=>String(x.id)===String(unitId));if(!u)return;
  const info=rlNextEscalationInfo(u);if(!info)return;
  if(!await lcConfirm({title:'Apply rent increase?',message:`Rent will change from <strong>KES ${Number(u.monthly_rent).toLocaleString('en-KE')}</strong> to <strong>KES ${info.newRent.toLocaleString('en-KE')}</strong>.`,confirmLabel:'Apply increase'}))return;
  const{error}=await db.from('rental_units').update({monthly_rent:info.newRent,last_escalation_date:new Date().toISOString().slice(0,10)}).eq('id',unitId);
  if(error){showToast('Could not update: '+error.message,'error');return;}
  showToast('Rent escalation applied ✓','success');
  notifyInApp('rent_ledger',`Rent escalation applied — ${u.unit_label}`,`New rent: KES ${info.newRent.toLocaleString('en-KE')} (was KES ${Number(u.monthly_rent).toLocaleString('en-KE')})`);
  loadRentalUnits();
}

// ── Automatic reminder engine (manual-trigger version; pair with a Supabase
// cron + edge function for true unattended auto-send) ──
function openReminderSettingsModal(){
  document.getElementById('rs-auto-enabled').checked=currentProfile?.rent_reminder_auto_enabled!==false;
  document.getElementById('rs-days-before').value=currentProfile?.rent_reminder_days_before??3;
  openModal('modal-reminder-settings');
}
async function saveReminderSettings(){
  const payload={rent_reminder_auto_enabled:document.getElementById('rs-auto-enabled').checked,rent_reminder_days_before:parseInt(document.getElementById('rs-days-before').value)||3};
  const error=await updateOwnerProfile(payload);
  if(error){showToast('Could not save: '+error.message,'error');return;}
  closeModal('modal-reminder-settings');showToast('Reminder settings saved ✓','success');
}
function rlReminderStageFor(tenant,unit){
  const daysBefore=currentProfile?.rent_reminder_days_before??3;
  const now=new Date();
  const dueDate=new Date(now.getFullYear(),now.getMonth(),1); // rent due 1st, adjust if you track a custom due-day
  const daysSinceDue=Math.floor((now-dueDate)/86400000);
  const st=rentStatusForMonth(tenant,currentMonthKey());
  if(st==='paid')return null;
  if(daysSinceDue<-daysBefore)return null;
  if(daysSinceDue<0)return'reminder';
  if(daysSinceDue<=14)return'notice';
  return'final_notice';
}
const RL_STAGE_COPY={
  reminder:{subject:'Rent reminder',tone:'A friendly heads-up that rent is due soon.'},
  notice:{subject:'Rent overdue notice',tone:'A firmer notice that rent is now overdue.'},
  final_notice:{subject:'FINAL notice — rent seriously overdue',tone:'A final, formal notice before further action.'},
};
const RL_REMINDER_COOLDOWN_MS=24*60*60*1000;
async function sendStagedReminder(unitId,tenantId){
  const u=rentalUnitsCache.find(x=>String(x.id)===String(unitId));
  const t=u?.tenants?.find(x=>String(x.id)===String(tenantId));
  if(!t?.email){showToast('This tenant has no email on file','error');return;}
  const lastSent=Date.parse(t.last_reminder_sent_at||'');
  if(Number.isFinite(lastSent)&&lastSent<=Date.now()&&Date.now()-lastSent<RL_REMINDER_COOLDOWN_MS){
    showToast('This tenant was reminded within the last 24 hours. Try again later.','error');return;
  }
  const stage=rlReminderStageFor(t,u)||'reminder';
  const copy=RL_STAGE_COPY[stage];
  const sent=await notifyByEmail('rent_reminder',{tenantName:t.full_name,tenantEmail:t.email,unitLabel:u.unit_label,monthlyRent:u.monthly_rent,sellerName:currentProfile?.full_name,sellerEmail:currentUser?.email,stage,stageSubject:copy.subject});
  if(!sent){showToast('Reminder was not delivered. A retry may run if it was saved on this device; send status was not changed.','error');return;}
  const sentAt=new Date().toISOString();
  const{error:updateError}=await db.from('tenants').update({reminder_stage:stage,last_reminder_sent_at:sentAt}).eq('id',tenantId);
  if(updateError){console.error('Could not save rent reminder status:',updateError);showToast('Reminder was sent, but its status could not be saved: '+updateError.message,'error');return;}
  const{error:logError}=await db.from('rent_reminder_log').insert({tenant_id:tenantId,stage,channel:'email'});
  if(logError)console.error('Could not save rent reminder log:',logError);
  t.reminder_stage=stage;t.last_reminder_sent_at=sentAt;
  showToast(logError?'Reminder was sent, but its activity log could not be saved: '+logError.message:`${copy.subject} sent ✓`,logError?'error':'success');
  renderRentalUnits();
}

// ── Vacancy tracking ──
function rlVacancyInfo(u){
  if(rlActiveTenant(u))return null;
  const lastTenant=(u.tenants||[]).filter(t=>t.status==='past').sort((a,b)=>new Date(b.move_out_date||0)-new Date(a.move_out_date||0))[0];
  const since=lastTenant?.move_out_date?new Date(lastTenant.move_out_date):new Date(u.created_at);
  const days=Math.floor((new Date()-since)/86400000);
  const lost=Math.round((days/30)*(Number(u.monthly_rent)||0));
  return{days,lost};
}

// ── Demand Insights — portfolio-aware "where to expand" ──
function renderDemandPortfolioOverlay(){
  const wrap=document.getElementById('demand-mine-list');
  if(!wrap||!ledgerAccessActive()||isBnbLedgerMode())return;
  if(!rentalUnitsCache.length)return; // only adds value once they have rental units tracked
  const occupied=rentalUnitsCache.filter(u=>rlActiveTenant(u)).length;
  const myOccRate=rentalUnitsCache.length?Math.round((occupied/rentalUnitsCache.length)*100):0;
  const note=document.createElement('div');
  note.style.cssText='margin-top:14px;padding-top:14px;border-top:1px dashed var(--border);font-size:12.5px;color:#5b21b6';
  note.innerHTML=`📊 Your portfolio occupancy is <strong>${myOccRate}%</strong>. ${myOccRate<80?'Below-average occupancy combined with high-demand areas below could mean it\'s time to review pricing or list a vacant unit more aggressively.':'Solid occupancy — consider whether any high-demand areas below are worth expanding into.'}`;
  wrap.appendChild(note);
}

// ── Demand Insights (Elite) — full market-intelligence dashboard ──
let diRangeDays=90;

function diCutoff(days){return new Date(Date.now()-days*86400000).toISOString();}
function diMyAreas(){return new Set(allListings.map(l=>l.area).filter(Boolean));}

function diSetRange(days,el){
  diRangeDays=days;
  document.querySelectorAll('.di-tabs .filter-pill').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  loadDemandInsights();
}

async function loadDemandInsights(){
  if(!ledgerAccessActive())return;
  const wrap=document.getElementById('demand-area-bars');
  const catWrap=document.getElementById('demand-category-bars');
  const typeWrap=document.getElementById('demand-type-bars');
  const mineWrap=document.getElementById('demand-mine-list');
  wrap.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-3);font-size:13px">Loading…</div>';

  const cutoff=diCutoff(diRangeDays);
  const prevCutoff=diCutoff(diRangeDays*2);

  const[{data:curData,error:curErr},{data:prevData}]=await Promise.all([
    db.from('enquiries').select('listing_id,listings(area,category,price_type)').gte('created_at',cutoff),
    db.from('enquiries').select('listings(area)').gte('created_at',prevCutoff).lt('created_at',cutoff)
  ]);
  if(curErr){wrap.innerHTML=`<div class="empty-state"><p>Could not load: ${escHtml(curErr.message)}</p></div>`;return;}

  const rows=curData||[];
  const areaCounts={},catCounts={},typeCounts={},prevAreaCounts={};
  rows.forEach(r=>{
    const area=r.listings?.area,cat=r.listings?.category,pt=r.listings?.price_type;
    if(area)areaCounts[area]=(areaCounts[area]||0)+1;
    if(cat)catCounts[cat]=(catCounts[cat]||0)+1;
    if(pt)typeCounts[pt]=(typeCounts[pt]||0)+1;
  });
  (prevData||[]).forEach(r=>{const area=r.listings?.area;if(area)prevAreaCounts[area]=(prevAreaCounts[area]||0)+1;});

  const sortedAreas=Object.entries(areaCounts).sort((a,b)=>b[1]-a[1]).slice(0,10);
  if(!sortedAreas.length){
    wrap.innerHTML='<div class="empty-state"><p>Not enough enquiry activity yet in this window. Try a longer time range.</p></div>';
    catWrap.innerHTML='';typeWrap.innerHTML='';mineWrap.innerHTML='';
    return;
  }

  const topAreaNames=sortedAreas.map(([a])=>a);
  const{data:supplyRows}=await db.from('listings').select('area').eq('status','active').in('area',topAreaNames);
  const supplyCounts={};
  (supplyRows||[]).forEach(r=>{if(r.area)supplyCounts[r.area]=(supplyCounts[r.area]||0)+1;});

  const max=sortedAreas[0][1];
  const myAreas=diMyAreas();
  window.__diLastData={sortedAreas,catCounts,typeCounts,supplyCounts,rangeDays:diRangeDays};

  wrap.innerHTML=sortedAreas.map(([area,count])=>{
    const prevCount=prevAreaCounts[area]||0;
    const pct=prevCount>0?Math.round(((count-prevCount)/prevCount)*100):(count>0?100:0);
    const trend=(prevCount===0&&count===0)?'':`<span class="di-trend ${pct>=0?'up':'down'}">${pct>=0?'▲':'▼'} ${Math.abs(pct)}%</span>`;
    const supply=supplyCounts[area]||0;
    const ratio=supply>0?(count/supply):count;
    const isOpportunity=ratio>=1.5&&count>=3;
    const isMine=myAreas.has(area);
    return `<div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:12.5px;margin-bottom:4px;flex-wrap:wrap;gap:4px">
        <span style="font-weight:600">${escHtml(area)}${isMine?'<span class="di-mine-badge">You list here</span>':''}${isOpportunity?'<span class="di-opportunity">🔥 High demand, low supply</span>':''}</span>
        <span style="color:var(--text-3)">${count} enquir${count!==1?'ies':'y'} · ${supply} active listing${supply!==1?'s':''}${trend}</span>
      </div>
      <div style="background:var(--surface);border-radius:6px;height:8px;overflow:hidden"><div style="background:#7c3aed;height:100%;width:${Math.round((count/max)*100)}%"></div></div>
    </div>`;
  }).join('');

  const catLabels={apartment:'Apartment',house:'House',boarding:'Boarding House',airbnb:'Airbnb / Holiday Rental',commercial:'Shops & Offices'};
  const catMax=Math.max(...Object.values(catCounts),1);
  catWrap.innerHTML=Object.keys(catLabels).map(k=>{
    const c=catCounts[k]||0;
    return `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span>${catLabels[k]}</span><span style="color:var(--text-3)">${c}</span></div><div style="background:var(--surface);border-radius:6px;height:6px;overflow:hidden"><div style="background:var(--green);height:100%;width:${Math.round((c/catMax)*100)}%"></div></div></div>`;
  }).join('');

  const rentCt=typeCounts.rent||0,saleCt=typeCounts.sale||0,typeTotal=rentCt+saleCt||1;
  typeWrap.innerHTML=`
    <div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span>To let (rent)</span><span style="color:var(--text-3)">${rentCt} (${Math.round(rentCt/typeTotal*100)}%)</span></div><div style="background:var(--surface);border-radius:6px;height:6px;overflow:hidden"><div style="background:var(--gold);height:100%;width:${Math.round(rentCt/typeTotal*100)}%"></div></div></div>
    <div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span>For sale</span><span style="color:var(--text-3)">${saleCt} (${Math.round(saleCt/typeTotal*100)}%)</span></div><div style="background:var(--surface);border-radius:6px;height:6px;overflow:hidden"><div style="background:#2563eb;height:100%;width:${Math.round(saleCt/typeTotal*100)}%"></div></div></div>`;

  if(allListings.length){
    const{data:myEnqRows}=await db.from('enquiries').select('listing_id').in('listing_id',allListings.map(l=>l.id)).gte('created_at',cutoff);
    const myCounts={};
    (myEnqRows||[]).forEach(r=>{myCounts[r.listing_id]=(myCounts[r.listing_id]||0)+1;});
    mineWrap.innerHTML=allListings.slice(0,8).map(l=>{
      const mine=myCounts[l.id]||0;
      const areaAvgCount=areaCounts[l.area]||0;
      const areaListingCount=supplyCounts[l.area]||1;
      const areaAvg=areaAvgCount/Math.max(areaListingCount,1);
      const diff=areaAvg>0?Math.round(((mine-areaAvg)/areaAvg)*100):0;
      const cls=diff>0?'up':diff<0?'down':'';
      const tip = mine===0 ? '💡 Zero enquiries — try the <button type="button" onclick="openValuationModal()" style="background:none;border:none;padding:0;color:#7c3aed;font-weight:700;text-decoration:underline;cursor:pointer;font-size:inherit;font-family:inherit">Instant Valuation tool</button> to check your price against similar listings.'
        : (diff<-30 ? '💡 Underperforming this area — consider a price review or refreshed photos.' : '');
      return `<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:12.5px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60%">${escHtml(l.title)}</span>
          <span>${mine} enquir${mine!==1?'ies':'y'}${areaAvg>0?` <span class="di-trend ${cls}">${diff>=0?'▲':'▼'} ${Math.abs(diff)}% vs area avg</span>`:''}</span>
        </div>
        ${tip?`<div style="color:#7c3aed;margin-top:3px">${tip}</div>`:''}
      </div>`;
    }).join('');
  }else{
    mineWrap.innerHTML='<div style="font-size:12.5px;color:var(--text-3)">Post a listing to see how it compares to area demand.</div>';
  }
  renderDemandPortfolioOverlay();
  renderBnbDemandTip();
}
function renderBnbDemandTip(){
  const wrap=document.getElementById('demand-mine-list');
  if(!wrap||!ledgerAccessActive()||!isBnbLedgerMode())return;
  const note=document.createElement('div');
  note.style.cssText='margin-top:14px;padding-top:14px;border-top:1px dashed var(--border);font-size:12.5px;color:#5b21b6';
  const avgNightly=bnbPropertiesCache.length?Math.round(bnbPropertiesCache.reduce((s,p)=>s+(Number(p.nightly_rate)||0),0)/bnbPropertiesCache.length):0;
  note.innerHTML=`🏖️ Your average nightly rate across properties is <strong>KES ${avgNightly.toLocaleString('en-KE')}</strong>. Compare that against the demand areas above — high-demand areas with a low nightly rate here may be underpriced.`;
  wrap.appendChild(note);
}

function diDownloadBlob(filename,content,mime){
  const blob=new Blob([mime==='text/csv'?'\uFEFF'+content:content],{type:mime});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportDemandCSV(){
  const d=window.__diLastData;
  if(!d||!d.sortedAreas.length){showToast('No demand data to export yet','error');return;}
  const rows=[['Area','Enquiries','Active listings','Enquiries per listing']];
  d.sortedAreas.forEach(([area,count])=>{
    const supply=d.supplyCounts[area]||0;
    rows.push([area,count,supply,supply>0?(count/supply).toFixed(2):count]);
  });
  const csv=rows.map(r=>r.map(v=>csvCell(v)).join(',')).join('\n');
  diDownloadBlob(`Nyumba254-Demand-Insights-${d.rangeDays}d.csv`,csv,'text/csv');
  showToast('CSV exported ✓','success');
}
async function exportDemandPDF(){
  const d=window.__diLastData;
  if(!d||!d.sortedAreas.length){showToast('No demand data to export yet','error');return;}
  if(!await ensurePdfLibrary())return;
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'mm',format:'a4'});
  doc.setFillColor(124,58,237);doc.rect(0,0,210,24,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(16);doc.setTextColor(255,255,255);
  doc.text('Nyumba254 — Demand Insights',14,15);
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(230,230,255);
  doc.text(`Last ${d.rangeDays} days · Generated ${new Date().toLocaleDateString('en-KE',{day:'numeric',month:'long',year:'numeric'})}`,14,21);

  let y=34;
  doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(255,255,255);
  doc.setFillColor(124,58,237);doc.rect(14,y-4,182,7,'F');
  doc.text('Area',16,y);doc.text('Enquiries',110,y);doc.text('Active listings',140,y);doc.text('Ratio',175,y);
  y+=7;
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(74,74,70);
  d.sortedAreas.forEach(([area,count])=>{
    if(y>280){doc.addPage();y=20;}
    const supply=d.supplyCounts[area]||0;
    doc.text(String(area).slice(0,40),16,y);
    doc.text(String(count),110,y);
    doc.text(String(supply),140,y);
    doc.text(supply>0?(count/supply).toFixed(2):'—',175,y);
    y+=6.5;
    doc.setDrawColor(230,230,230);doc.line(14,y-4.5,196,y-4.5);
  });
  doc.save(`Nyumba254-Demand-Insights-${d.rangeDays}d.pdf`);
  showToast('Demand insights PDF downloaded ✓','success');
}

async function copyStorefrontLink(){
  const btn = document.getElementById('elite-storefront-btn');
  if(btn) btn.disabled = true;
  const slug = await ensureStorefrontSlug();
  if(btn) btn.disabled = false;
  const url = `${location.origin}/storefront?seller=${slug}`;
  navigator.clipboard.writeText(url).then(()=>{
    showToast('Storefront link copied ✓','success');
  }).catch(()=>{
    showToast(url,'');
  });
}

// ── Instant Valuation Tool (Elite) ──────────────────────────────────
// Pure-data feature — compares a spec against other active listings on
// the platform (same county/area/category/price type, optionally bedrooms)
// and returns min/median/average/max. Usage is capped per calendar month
// via elite_valuation_uses_monthly in platform_settings, tracked on
// profiles.valuation_uses_month/_count.
let eliteValuationLimit = 20, eliteValuationLimitLoaded = false;
async function loadValuationLimit(){
  if(eliteValuationLimitLoaded)return;
  try{
    const{data}=await db.from('platform_settings').select('value').eq('key','elite_valuation_uses_monthly').maybeSingle();
    if(data?.value) eliteValuationLimit = Number(data.value)||eliteValuationLimit;
    eliteValuationLimitLoaded = true;
  }catch(e){/* fall back to default */}
}

function valPopulateCounties(){
  const sel=document.getElementById('val-county');
  if(!sel)return;
  sel.innerHTML = NK_COUNTIES.map(c=>`<option value="${c}">${nkCountyLabel(c)}</option>`).join('');
}
function valPopulateAreas(){
  const county=document.getElementById('val-county')?.value;
  const sel=document.getElementById('val-area');
  if(!sel)return;
  const areas=NK_AREAS_BY_COUNTY[county]||[];
  sel.innerHTML = '<option value="">Any area in county</option>' + areas.map(a=>`<option value="${a}">${a}</option>`).join('');
}

function currentMonthKey(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }

async function openValuationModal(){
  valPopulateCounties();
  const savedArea = allListings[0]?.area;
  const savedCounty = savedArea ? NK_AREA_TO_COUNTY[savedArea] : null;
  if(savedCounty){ document.getElementById('val-county').value = savedCounty; }
  valPopulateAreas();
  document.getElementById('val-results').innerHTML = '';
  document.getElementById('val-usage-note').textContent = 'Loading usage…';
  openModal('modal-valuation');
  await loadValuationLimit();
  const monthKey = currentMonthKey();
  const usedThisMonth = (currentProfile?.valuation_uses_month===monthKey) ? (currentProfile?.valuation_uses_count||0) : 0;
  document.getElementById('val-usage-note').textContent = `${Math.max(0,eliteValuationLimit-usedThisMonth)} of ${eliteValuationLimit} valuations left this month`;
}

async function runValuation(){
  const monthKey = currentMonthKey();
  const usedThisMonth = (currentProfile?.valuation_uses_month===monthKey) ? (currentProfile?.valuation_uses_count||0) : 0;
  if(usedThisMonth >= eliteValuationLimit){
    showToast(`You've used all ${eliteValuationLimit} valuations for this month — resets next month.`,'error');
    return;
  }

  const county = document.getElementById('val-county').value;
  const area = document.getElementById('val-area').value;
  const category = document.getElementById('val-category').value;
  const priceType = document.getElementById('val-price-type').value;
  const bedroomsRaw = document.getElementById('val-bedrooms').value;
  const bedrooms = bedroomsRaw==='' ? null : parseInt(bedroomsRaw);

  const btn=document.getElementById('btn-run-valuation');
  btn.disabled=true; btn.textContent='Calculating…';
  const resultsEl = document.getElementById('val-results');
  resultsEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-3);font-size:13px">Looking at similar listings…</div>';

  try{
    async function fetchComparables(withBedrooms, withArea){
      let q = db.from('listings').select('price').eq('status','active').eq('category',category).eq('price_type',priceType).eq('county',county);
      if(withArea && area) q = q.eq('area',area);
      if(withBedrooms && bedrooms!==null) q = q.eq('bedrooms',bedrooms);
      const{data,error} = await q.limit(500);
      if(error) throw error;
      return (data||[]).map(r=>Number(r.price)).filter(p=>p>0);
    }

    let prices = await fetchComparables(true, true);
    let note = area ? `${area}, matching bedrooms` : `${nkCountyLabel(county)}-wide, matching bedrooms`;
    if(prices.length < 3 && area){
      prices = await fetchComparables(true, false);
      note = `${nkCountyLabel(county)}-wide (widened from ${area}), matching bedrooms`;
    }
    if(prices.length < 3 && bedrooms!==null){
      prices = await fetchComparables(false, false);
      note = `${nkCountyLabel(county)}-wide, any bedroom count`;
    }

    if(!prices.length){
      resultsEl.innerHTML = `<div class="empty-state" style="padding:24px"><p>No comparable active listings found yet for this combination. Try a nearby area or a different category.</p></div>`;
      return;
    }

    prices.sort((a,b)=>a-b);
    const min = prices[0], max = prices[prices.length-1];
    const avg = Math.round(prices.reduce((s,p)=>s+p,0)/prices.length);
    const mid = Math.floor(prices.length/2);
    const median = prices.length%2 ? prices[mid] : Math.round((prices[mid-1]+prices[mid])/2);
    const suffix = priceType==='rent' ? '/mo' : '';

    resultsEl.innerHTML = `
      <div style="background:var(--green-light);border-radius:var(--radius);padding:16px 18px;margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--green-dark);margin-bottom:6px">Suggested price range</div>
        <div style="font-size:22px;font-weight:700;color:var(--green-dark)">KES ${min.toLocaleString('en-KE')}${suffix} – KES ${max.toLocaleString('en-KE')}${suffix}</div>
        <div style="font-size:12.5px;color:var(--green-dark);margin-top:4px">Median KES ${median.toLocaleString('en-KE')}${suffix} · Average KES ${avg.toLocaleString('en-KE')}${suffix}</div>
      </div>
      <div style="font-size:12px;color:var(--text-3)">Based on ${prices.length} active listing${prices.length!==1?'s':''} — ${escHtml(note)}.</div>`;

    const newCount = usedThisMonth + 1;
    await updateOwnerProfile({ valuation_uses_month: monthKey, valuation_uses_count: newCount });
    document.getElementById('val-usage-note').textContent = `${Math.max(0,eliteValuationLimit-newCount)} of ${eliteValuationLimit} valuations left this month`;
  }catch(e){
    resultsEl.innerHTML = `<div class="empty-state" style="padding:24px"><p>Could not run the valuation: ${escHtml(e.message||String(e))}</p></div>`;
  }finally{
    btn.disabled=false; btn.textContent='Get valuation';
  }
}

// ── AI Listing Assistant (Elite) ──────────────────────────────────
let eliteAiListingLimit = 20, eliteAiListingLimitLoaded = false;
let aiListingLastResult = null;

async function loadAiListingLimit(){
  if(eliteAiListingLimitLoaded)return;
  try{
    const{data}=await db.from('platform_settings').select('value').eq('key','elite_ai_listing_uses_monthly').maybeSingle();
    if(data?.value) eliteAiListingLimit = Number(data.value)||eliteAiListingLimit;
    eliteAiListingLimitLoaded = true;
  }catch(e){/* fall back to default */}
}

async function openAiListingModal(){
  const sel=document.getElementById('ai-listing-select');
  sel.innerHTML='<option value="">Just generate text — I\'ll copy it myself</option>'+allListings.map(l=>`<option value="${l.id}">${escHtml(l.title)}</option>`).join('');
  document.getElementById('ai-listing-category').value='apartment';
  document.getElementById('ai-listing-price-type').value='rent';
  document.getElementById('ai-listing-bedrooms').value='';
  document.getElementById('ai-listing-area').value=allListings[0]?.area||'';
  document.getElementById('ai-listing-notes').value='';
  document.getElementById('ai-listing-price').value='';
  document.getElementById('ai-listing-results').style.display='none';
  document.getElementById('btn-apply-ai-listing').style.display='none';
  aiListingLastResult=null;
  document.getElementById('ai-listing-usage-note').textContent = 'Loading usage…';
  openModal('modal-ai-listing');
  await loadAiListingLimit();
  const monthKey = currentMonthKey();
  const usedThisMonth = (currentProfile?.ai_listing_uses_month===monthKey) ? (currentProfile?.ai_listing_uses_count||0) : 0;
  document.getElementById('ai-listing-usage-note').textContent = `${Math.max(0,eliteAiListingLimit-usedThisMonth)} of ${eliteAiListingLimit} generations left this month`;
}

async function generateAiListing(){
  const monthKey = currentMonthKey();
  const usedThisMonth = (currentProfile?.ai_listing_uses_month===monthKey) ? (currentProfile?.ai_listing_uses_count||0) : 0;
  if(usedThisMonth >= eliteAiListingLimit){
    showToast(`You've used all ${eliteAiListingLimit} AI generations for this month — resets next month.`,'error');
    return;
  }
  const notes = document.getElementById('ai-listing-notes').value.trim();
  if(!notes){ showToast('Add a few bullet points about the property first','error'); return; }

  const payload = {
    category: document.getElementById('ai-listing-category').value,
    priceType: document.getElementById('ai-listing-price-type').value,
    bedrooms: document.getElementById('ai-listing-bedrooms').value || null,
    area: document.getElementById('ai-listing-area').value.trim(),
    notes,
    currentPrice: document.getElementById('ai-listing-price').value || null,
  };

  const btn=document.getElementById('btn-generate-ai-listing');
  btn.disabled=true; btn.textContent='Generating…';
  const resultsEl=document.getElementById('ai-listing-results');

  try{
    const{data:{session}}=await db.auth.getSession();
    if(!session) throw new Error('Please sign in again');
    const res=await fetch(`${EDGE_URL}/ai-listing-generate`,{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':`Bearer ${session.access_token}`},
      body:JSON.stringify(payload),
    });
    const body=await res.json();
    if(!res.ok||body.error) throw new Error(body.error||'Generation failed');

    aiListingLastResult = body;
    document.getElementById('ai-listing-out-title').value = body.title||'';
    document.getElementById('ai-listing-out-desc').value = body.description||'';
    const priceEl=document.getElementById('ai-listing-out-price');
    if(body.suggestedPriceMin && body.suggestedPriceMax){
      const suffix = payload.priceType==='rent' ? '/mo' : '';
      priceEl.textContent = body.suggestedPriceMin===body.suggestedPriceMax
        ? `KES ${Number(body.suggestedPriceMin).toLocaleString('en-KE')}${suffix}`
        : `KES ${Number(body.suggestedPriceMin).toLocaleString('en-KE')} – ${Number(body.suggestedPriceMax).toLocaleString('en-KE')}${suffix}`;
    } else {
      priceEl.textContent = 'Not enough comparable listings yet in this area/category';
    }
    resultsEl.style.display='block';
    document.getElementById('btn-apply-ai-listing').style.display = document.getElementById('ai-listing-select').value ? 'inline-flex' : 'none';

    currentProfile = { ...currentProfile, ai_listing_uses_month: monthKey, ai_listing_uses_count: body.usedCount };
    document.getElementById('ai-listing-usage-note').textContent = `${Math.max(0,eliteAiListingLimit-body.usedCount)} of ${eliteAiListingLimit} generations left this month`;
  }catch(e){
    showToast('Could not generate: '+(e.message||String(e)),'error');
  }finally{
    btn.disabled=false; btn.textContent='✨ Generate';
  }
}

function copyAiField(id){
  const el=document.getElementById(id);
  navigator.clipboard.writeText(el.value).then(()=>showToast('Copied ✓','success')).catch(()=>showToast('Could not copy','error'));
}

async function applyAiListingToSelected(){
  const listingId=document.getElementById('ai-listing-select').value;
  if(!listingId||!aiListingLastResult){showToast('Nothing to apply','error');return;}
  const title=document.getElementById('ai-listing-out-title').value.trim();
  const description=document.getElementById('ai-listing-out-desc').value.trim();
  if(!title||!description){showToast('Title and description can\'t be empty','error');return;}
  const btn=document.getElementById('btn-apply-ai-listing');
  btn.disabled=true;btn.textContent='Applying…';
  const{error}=await db.from('listings').update({title,description}).eq('id',listingId);
  btn.disabled=false;btn.textContent='Apply to selected listing';
  if(error){showToast('Could not apply: '+error.message,'error');return;}
  const idx=allListings.findIndex(l=>l.id===listingId);
  if(idx!==-1){allListings[idx]={...allListings[idx],title,description};}
  renderListingsTable();renderQuickListings();
  showToast('Applied to listing ✓','success');
  closeModal('modal-ai-listing');
}

function updateConciergeGate(sub){
  const toggle = document.getElementById('concierge-toggle');
  const lockNote = document.getElementById('concierge-lock-note');
  if(!toggle) return;
  const conciergeEligible = sub.active || bnbSubscriptionInfo().active;
  toggle.disabled = !conciergeEligible;
  if(lockNote) lockNote.style.display = conciergeEligible ? 'none' : 'block';
}
function updateSmsAlertsGate(sub){
  const toggle = document.getElementById('sms-alerts-toggle');
  const lockNote = document.getElementById('sms-alerts-lock-note');
  if(!toggle) return;
  toggle.disabled = !sub.active;
  if(lockNote) lockNote.style.display = sub.active ? 'none' : 'block';
}
async function toggleSmsAlerts(enabled) {
  const error = await updateOwnerProfile({ sms_alerts_enabled: enabled });
  if (error) { showToast('Could not update: '+error.message,'error'); document.getElementById('sms-alerts-toggle').checked = !enabled; return; }
  showToast(enabled ? 'SMS alerts turned on ✓' : 'SMS alerts turned off','success');
  notifyInApp('plan_feature', enabled?'SMS enquiry alerts turned on':'SMS enquiry alerts turned off', enabled?"You'll now get a text the moment a buyer enquires.":'SMS alerts have been disabled.');
}

const VERIFY_BUCKET = 'verification-docs';

// ── Live Premium/Elite prices — reads the same platform_settings rows the
// admin's Pricing settings page writes, so this dashboard never shows a
// stale hardcoded number after an admin changes a price. ──
  let platformPrices = { premium_monthly_price: 1200, elite_monthly_price: 3000, bnb_basic_price: 700, bnb_bundle_price: 2000 };
async function loadPlatformPrices(){
  try{
    const{data,error}=await db.from('platform_settings').select('key,value').in('key',['premium_monthly_price','elite_monthly_price','bnb_basic_price','bnb_bundle_price']);
    if(error||!data)return;
    data.forEach(row=>{ if(row.key in platformPrices) platformPrices[row.key]=Number(row.value)||platformPrices[row.key]; });
    const pBtn=document.getElementById('premium-upgrade-btn');
    if(pBtn) pBtn.textContent=`Upgrade — from KES ${platformPrices.premium_monthly_price.toLocaleString('en-KE')}/mo`;
    const eBtn=document.getElementById('elite-upgrade-btn');
    if(eBtn) eBtn.textContent=`Upgrade to Elite — from KES ${platformPrices.elite_monthly_price.toLocaleString('en-KE')}/mo`;
    const bBasic=document.getElementById('bnb-basic-price-label'); if(bBasic) bBasic.textContent=`KES ${platformPrices.bnb_basic_price.toLocaleString('en-KE')}/mo`;
    const bBundle=document.getElementById('bnb-bundle-price-label'); if(bBundle) bBundle.textContent=`KES ${platformPrices.bnb_bundle_price.toLocaleString('en-KE')}/mo`;
    updateBnbStatusBanner();
  }catch(e){console.error('loadPlatformPrices failed:',e);}
}
function updateBnbStatusBanner(){
  const banner=document.getElementById('bnb-status-banner');
  if(!banner)return;
  const p=currentProfile;
  const bnbPlanActive=p?.bnb_plan && p?.bnb_expires_at && new Date(p.bnb_expires_at)>new Date();
  if(bnbPlanActive){
    const labelMap={bnb_basic:'BNB Basic',bnb_bundle:'BNB Bundle',bnb_unlimited:'BNB Unlimited'};
    banner.style.display='block';
    banner.textContent=`✓ ${labelMap[p.bnb_plan]||'BNB plan'} active — renews/expires ${fmtSubDate(p.bnb_expires_at)}`;
  } else if (eliteActive()) {
    banner.style.display='block';
    banner.textContent=`✓ Unlimited BNB listings included with your Elite plan — no separate BNB plan needed`;
  } else {
    banner.style.display='none';
  }
}

function kycStatusMeta(status){
  return {
    unverified: {pill:'unverified',pillLabel:'Not started',dotIdx:0},
    pending:    {pill:'pending',pillLabel:'Under review',dotIdx:1},
    verified:   {pill:'verified',pillLabel:'Verified ✓',dotIdx:2},
    rejected:   {pill:'rejected',pillLabel:'Needs changes',dotIdx:0},
  }[status] || {pill:'unverified',pillLabel:'Not started',dotIdx:0};
}

function loadVerificationUI() {
  const v = currentProfile || {};
  const status = v.verification_status || 'unverified';
  const meta = kycStatusMeta(status);

  const pillEl = document.getElementById('kyc-settings-pill');
  const subEl = document.getElementById('kyc-settings-sub');
  if (pillEl) { pillEl.className = 'kyc-pill '+meta.pill; pillEl.textContent = meta.pillLabel; }
  if (subEl) {
    subEl.textContent =
      status==='verified' ? "You're verified — buyers see a trust badge on your listings, and your listing space is unlimited." :
      status==='pending' ? "We're reviewing your documents — usually within 24 hours." :
      status==='rejected' ? (v.verification_rejection_reason || 'Your submission needs changes — open the KYC Center for details.') :
      'Verify your identity to unlock a trust badge and unlimited listings.';
  }

  const steps=['Identity','Ownership','Review'];
  const stepperEl=document.getElementById('kyc-stepper');
  if(stepperEl){
    stepperEl.innerHTML = steps.map((label,i)=>{
      const cls = i<meta.dotIdx ? 'done' : (i===meta.dotIdx ? 'current' : '');
      const dot = i<meta.dotIdx ? '✓' : (i+1);
      const line = i<steps.length-1 ? '<div class="kyc-step-line"></div>' : '';
      return `<div class="kyc-step ${cls}"><div class="kyc-step-dot">${dot}</div><div class="kyc-step-label">${label}</div></div>${line}`;
    }).join('');
  }

  const bodyEl=document.getElementById('kyc-body-content');
  const footEl=document.getElementById('kyc-footer-actions');
  const headStatusEl=document.getElementById('kyc-header-status-text');
  if(!bodyEl||!footEl)return;

  if (status === 'verified') {
    if(headStatusEl) headStatusEl.innerHTML = "<strong>You're fully verified.</strong> Buyers see a trust badge on every listing, and your listing space is unlimited.";
    bodyEl.innerHTML = `
      <div class="kyc-checklist">
        <div class="kyc-checklist-item"><svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>Identity document verified</div>
        <div class="kyc-checklist-item"><svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>Ownership / authority document verified</div>
        <div class="kyc-checklist-item"><svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>Trust badge active on all listings</div>
      </div>`;
    footEl.innerHTML = `<button class="btn btn-outline" onclick="closeModal('modal-kyc')">Close</button>`;
    return;
  }

  if (status === 'pending') {
    if(headStatusEl) headStatusEl.innerHTML = "<strong>Your documents are under review.</strong> Our team typically completes this within 24 hours.";
    bodyEl.innerHTML = `
      <div class="kyc-section-title">Submitted for review</div>
      <div class="kyc-checklist">
        <div class="kyc-checklist-item"><svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>National ID (front &amp; back) received</div>
        <div class="kyc-checklist-item"><svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>${v.verification_is_owner===false?'Authority letter':'Proof of ownership'} received</div>
      </div>
      ${v.extra_verification_status==='requested' ? `
      <div class="kyc-section-title">⚠️ Additional document requested</div>
      <div class="kyc-upload-card">
        <p style="font-size:12.5px;color:var(--text-2);margin-bottom:10px">${escHtml(v.extra_verification_reason||'')}</p>
        <div class="kyc-upload-input"><input type="file" id="kyc-extra-doc-file" accept="image/*,.pdf"/></div>
        <button class="btn btn-primary btn-sm" style="margin-top:10px" onclick="submitExtraVerification()">Upload document</button>
      </div>` : ''}
      <div class="kyc-trust-row">
        <div class="kyc-trust-item"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>Encrypted upload</div>
        <div class="kyc-trust-item"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>~24hr review</div>
      </div>`;
    footEl.innerHTML = `<button class="btn btn-outline" onclick="closeModal('modal-kyc')">Close</button>`;
    return;
  }

  if(headStatusEl){
    headStatusEl.innerHTML = status==='rejected'
      ? `<strong>Your last submission needs changes.</strong> ${v.verification_rejection_reason?escHtml(v.verification_rejection_reason):'Please review and resubmit below.'}`
      : `Verifying your identity keeps buyers safe and unlocks <strong>unlimited listings</strong> plus a visible trust badge.`;
  }
  bodyEl.innerHTML = `
    <div class="kyc-section-title">Before you start</div>
    <div class="kyc-checklist">
      <div class="kyc-checklist-item"><svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>A valid, unexpired national ID (front and back)</div>
      <div class="kyc-checklist-item"><svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>Proof of ownership (title deed / lease) or an authority letter if listing on someone's behalf</div>
      <div class="kyc-checklist-item"><svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>Clear, uncropped photos or scans — takes about 2 minutes</div>
    </div>

    <div class="kyc-section-title">Ownership status</div>
    <div class="form-group" style="margin-bottom:16px">
      <select id="kyc-is-owner" onchange="updateVerifyProofLabel()">
        <option value="yes">Yes, I own this property</option>
        <option value="no">No — I'm listing on someone's behalf</option>
      </select>
    </div>

    <div class="kyc-section-title">Step 1 · Identity document</div>
    <div class="kyc-upload-card">
      <div class="kyc-upload-top">
        <div class="kyc-upload-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="11" r="2.4"/><path d="M4 18c1-2.2 2.8-3.4 4-3.4s3 1.2 4 3.4M15 9h5M15 13h5"/></svg></div>
        <div class="kyc-upload-info"><div class="kyc-upload-title">National ID — front side</div><div class="kyc-upload-sub">Clear photo or scan, all corners visible</div></div>
        <span class="kyc-required-tag">Required</span>
      </div>
      <div class="kyc-upload-input"><input type="file" id="kyc-id-front-file" accept="image/*,.pdf"/></div>
    </div>
    <div class="kyc-upload-card">
      <div class="kyc-upload-top">
        <div class="kyc-upload-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="9" x2="18" y2="9"/><line x1="6" y1="13" x2="18" y2="13"/><line x1="6" y1="17" x2="12" y2="17"/></svg></div>
        <div><div class="kyc-upload-title">National ID — back side</div><div class="kyc-upload-sub">Both sides are required to verify authenticity</div></div>
        <span class="kyc-required-tag">Required</span>
      </div>
      <div class="kyc-upload-input"><input type="file" id="kyc-id-back-file" accept="image/*,.pdf"/></div>
    </div>

    <div class="kyc-section-title">Step 2 · <span id="kyc-proof-label-text">Proof of ownership</span></div>
    <div class="kyc-upload-card">
      <div class="kyc-upload-top">
        <div class="kyc-upload-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
        <div class="kyc-upload-info"><div class="kyc-upload-title" id="kyc-proof-title">Title deed or lease copy</div><div class="kyc-upload-sub" id="kyc-proof-sub">Confirms your right to list this property</div></div>
        <span class="kyc-required-tag">Required</span>
      </div>
      <div class="kyc-upload-input"><input type="file" id="kyc-proof-file" accept="image/*,.pdf"/></div>
    </div>

    <div class="kyc-trust-row">
      <div class="kyc-trust-item"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>Encrypted upload</div>
      <div class="kyc-trust-item"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>~24hr review</div>
      <div class="kyc-trust-item"><svg viewBox="0 0 24 24" fill="none"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/></svg>Team-reviewed, never automated</div>
    </div>
  `;
  footEl.innerHTML = `<button class="btn btn-outline" onclick="closeModal('modal-kyc')">Not now</button><button class="btn btn-primary" id="kyc-submit-btn" onclick="submitVerification()">Submit for review</button>`;
  updateVerifyProofLabel();

  ['kyc-id-front-file','kyc-id-back-file','kyc-proof-file'].forEach(id=>{
    const inp=document.getElementById(id);
    if(inp) inp.addEventListener('change',()=>{ inp.closest('.kyc-upload-card')?.classList.toggle('has-file', inp.files.length>0); });
  });
}

function updateVerifyProofLabel() {
  const sel=document.getElementById('kyc-is-owner');
  if(!sel)return;
  const isOwner = sel.value === 'yes';
  const labelText=document.getElementById('kyc-proof-label-text');
  const title=document.getElementById('kyc-proof-title');
  const sub=document.getElementById('kyc-proof-sub');
  if(labelText) labelText.textContent = isOwner ? 'Proof of ownership' : 'Authority to list';
  if(title) title.textContent = isOwner ? 'Title deed or lease copy' : "Authority letter, or the owner's ID + written consent";
  if(sub) sub.textContent = isOwner ? 'Confirms your right to list this property' : 'Confirms the owner has authorized you to list on their behalf';
}

async function uploadVerifyFile(file, kind) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${currentUser.id}/${kind}-${Date.now()}.${ext}`;
  const { error } = await db.storage.from(VERIFY_BUCKET).upload(path, file, { upsert:false });
  if (error) throw error;
  return path;
}

const KYC_MAX_FILE_MB=10;
const KYC_ALLOWED_TYPES=['image/jpeg','image/png','image/webp','application/pdf'];
function kycValidateFile(file,label){
  if(!file)return null;
  if(!KYC_ALLOWED_TYPES.includes(file.type)){showToast(`${label}: please upload a JPG, PNG, or PDF file`,'error');return false;}
  if(file.size>KYC_MAX_FILE_MB*1024*1024){showToast(`${label} is too large (max ${KYC_MAX_FILE_MB}MB) — try a lower-resolution photo`,'error');return false;}
  return true;
}
async function submitVerification() {
  const idFile = document.getElementById('kyc-id-front-file').files[0];
  const idFile2 = document.getElementById('kyc-id-back-file').files[0];
  const proofFile = document.getElementById('kyc-proof-file').files[0];
  const isOwner = document.getElementById('kyc-is-owner').value === 'yes';
  if (!idFile || !idFile2) { showToast('Please upload both the front and back of your ID','error'); return; }
  if (!proofFile) { showToast('Please attach your proof of ownership document','error'); return; }
  if(kycValidateFile(idFile,'ID front')===false)return;
  if(kycValidateFile(idFile2,'ID back')===false)return;
  if(kycValidateFile(proofFile,'Proof document')===false)return;
  const btn = document.getElementById('kyc-submit-btn');
  btn.disabled = true; btn.textContent = 'Uploading…';
  try {
    const idPath = await uploadVerifyFile(idFile, 'id-front');
    const idPath2 = await uploadVerifyFile(idFile2, 'id-back');
    const proofPath = await uploadVerifyFile(proofFile, isOwner ? 'ownership' : 'authority');
    const { error } = await db.from('profiles').update({
      verification_status: 'pending', verification_is_owner: isOwner,
      verification_id_url: idPath, verification_id_url_2: idPath2, verification_proof_url: proofPath,
      verification_proof_type: isOwner ? 'title_deed_or_lease' : 'authority_letter',
      verification_submitted_at: new Date().toISOString(), verification_rejection_reason: null,
    }).eq('id', currentUser.id);
    if (error) throw error;
    await db.from('verification_activity_log').insert({ seller_id: currentUser.id, action:'submitted' });
    currentProfile = { ...currentProfile, verification_status:'pending', verification_is_owner:isOwner };
    loadVerificationUI();
    updateVerifyWarningBanner();
    showToast('Submitted for review ✓','success');
    fetch(`${EDGE_URL}/send-notification-email`, { method:'POST', headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`}, body: JSON.stringify({
      type:'verification_submitted', sellerName: currentProfile?.full_name, sellerEmail: currentUser.email, isOwner, proofType: isOwner?'Title deed / lease':'Authority letter',
    })}).catch(()=>{});
  } catch(e) {
    showToast('Upload failed: '+e.message,'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Submit for review';
  }
}

async function submitExtraVerification() {
  const file = document.getElementById('kyc-extra-doc-file')?.files[0];
  if (!file) { showToast('Please attach a file','error'); return; }
  if(kycValidateFile(file,'Document')===false)return;
  try {
    const path = await uploadVerifyFile(file, 'extra');
    const docs = Array.isArray(currentProfile?.extra_verification_docs) ? [...currentProfile.extra_verification_docs] : [];
    docs.push({ url: path, uploaded_at: new Date().toISOString() });
    const { error } = await db.from('profiles').update({ extra_verification_docs: docs, extra_verification_status: 'submitted' }).eq('id', currentUser.id);
    if (error) throw error;
    await db.from('verification_activity_log').insert({ seller_id: currentUser.id, action:'extra_submitted' });
    currentProfile = { ...currentProfile, extra_verification_docs: docs, extra_verification_status:'submitted' };
    loadVerificationUI();
    showToast('Uploaded ✓ — our team will review it shortly','success');
    fetch(`${EDGE_URL}/send-notification-email`, { method:'POST', headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`}, body: JSON.stringify({
      type:'extra_verification_submitted', sellerName: currentProfile?.full_name, sellerEmail: currentUser.email,
    })}).catch(()=>{});
  } catch(e) { showToast('Upload failed: '+e.message,'error'); }
}

async function toggleConcierge(enabled) {
  const error = await updateOwnerProfile({ concierge_enabled: enabled, concierge_enabled_at: enabled ? new Date().toISOString() : null });
  if (error) { showToast('Could not update: '+error.message,'error'); document.getElementById('concierge-toggle').checked = !enabled; return; }
  document.getElementById('concierge-note').textContent = enabled
    ? "On — our team can now reply to your buyer messages for you. You'll still see everything in your Messages tab."
    : 'Off — you handle all your own enquiries.';
  showToast(enabled ? 'Managed chat turned on ✓' : 'Managed chat turned off','success');
  fetch(`${EDGE_URL}/send-notification-email`, { method:'POST', headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`}, body: JSON.stringify({
    type: enabled ? 'concierge_enabled' : 'concierge_disabled', sellerName: currentProfile?.full_name, sellerEmail: currentUser.email,
  })}).catch(()=>{});
  notifyInApp('plan_feature', enabled?'Managed chat turned on':'Managed chat turned off', enabled?'Our team can now reply to buyer messages on your behalf.':'You are handling all enquiries yourself again.');
}
async function toggleContactPrivacy(enabled) {
  const error = await updateOwnerProfile({ hide_buyer_contact: enabled });
  if (error) { showToast('Could not update: '+error.message,'error'); document.getElementById('hide-contact-toggle').checked = !enabled; return; }
  document.getElementById('hide-contact-note').textContent = enabled
    ? 'On — every listing shows "Chat only" to buyers. Call/WhatsApp buttons are hidden platform-wide.'
    : 'Off — buyers can reveal your number to call or WhatsApp you (rate-limited for your safety).';
  showToast(enabled ? 'Contact buttons hidden on all listings ✓' : 'Call/WhatsApp buttons re-enabled','success');
}
async function saveNotificationPrefs(){
  const prefs={
    notif_enquiry: document.getElementById('notif-enquiry').checked,
    notif_approved: document.getElementById('notif-approved').checked,
    notif_expiring: document.getElementById('notif-expiring').checked,
    notif_payment: document.getElementById('notif-payment').checked,
    notif_weekly_digest: document.getElementById('notif-weekly-digest')?.checked || false,
  };
  const{error}=await db.from('profiles').update(prefs).eq('id',currentUser.id);
  if(error){showToast('Could not save: '+error.message,'error');return;}
  currentProfile={...currentProfile,...prefs};
  showToast('Notification preferences saved','success');
}

const DASHBOARD_BACKUP_FORMAT='nyumba254-dashboard-backup';
const DASHBOARD_BACKUP_VERSION=2;
const DASHBOARD_BACKUP_PAGE_SIZE=500;
const DASHBOARD_BACKUP_MAX_BYTES=50*1024*1024;
const DASHBOARD_BACKUP_MAX_ROWS=100000;
const DASHBOARD_BACKUP_TABLES=[
  'profiles','listings','listing_photos','listing_units','enquiries','messages','payments','reviews','notifications',
  'rental_units','tenants','rent_payments','tenant_documents','unit_expenses','maintenance_requests',
  'bnb_properties','bnb_bookings','chat_sessions','chat_messages'
];
const DASHBOARD_RESTORE_ORDER=[
  'listings','listing_photos','listing_units','rental_units','bnb_properties',
  'enquiries','messages','reviews','notifications','tenants','rent_payments','tenant_documents',
  'unit_expenses','maintenance_requests','bnb_bookings','chat_sessions','chat_messages'
];
let pendingDashboardRestore=null;
let dashboardBackupBusy=false;

function dashboardBackupHistoryKey(){
  return effectiveSellerId?`ny_dashboard_backup_history_${effectiveSellerId}`:null;
}

function readDashboardBackupHistory(){
  const key=dashboardBackupHistoryKey();
  if(!key)return[];
  try{
    const history=JSON.parse(localStorage.getItem(key)||'[]');
    return Array.isArray(history)?history.filter(item=>item&&typeof item.fileName==='string'&&typeof item.digest==='string').slice(0,5):[];
  }catch(error){
    console.error('Could not read backup history:',error);
    return[];
  }
}

function renderDashboardBackupHistory(){
  const el=document.getElementById('dashboard-backup-history');
  if(!el)return;
  const history=readDashboardBackupHistory();
  el.textContent=history.length
    ?'Recent local backup records: '+history.map(item=>`${item.fileName} · ${new Date(item.createdAt).toLocaleString('en-KE')} · SHA-256 ${item.digest.slice(0,12)}…`).join(' | ')
    :'Backup history will appear here after you download a backup on this device.';
}

function rememberDashboardBackup(item){
  const key=dashboardBackupHistoryKey();
  if(!key){console.error('Could not save backup history: seller account is unavailable.');return;}
  try{
    const history=[item,...readDashboardBackupHistory().filter(existing=>existing.fileName!==item.fileName)].slice(0,5);
    localStorage.setItem(key,JSON.stringify(history));
    renderDashboardBackupHistory();
  }catch(error){console.error('Could not save backup history:',error);}
}

async function dashboardBackupDigest(data){
  if(!globalThis.crypto?.subtle)throw new Error('Secure SHA-256 checks are not available in this browser.');
  const bytes=new TextEncoder().encode(JSON.stringify(data));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}

async function verifyDashboardBackupIntegrity(backup){
  if(backup.version===1)return false;
  if(backup.version!==DASHBOARD_BACKUP_VERSION||backup.integrity?.algorithm!=='SHA-256'||typeof backup.integrity.digest!=='string')
    throw new Error('The backup has no supported SHA-256 integrity record.');
  const unsigned={...backup};
  delete unsigned.integrity;
  const actual=await dashboardBackupDigest(unsigned);
  if(actual!==backup.integrity.digest)throw new Error('The backup integrity check failed. The file may be damaged or modified.');
  return true;
}

function updateDashboardBackupControls(){
  const restoreBtn=document.getElementById('dashboard-backup-restore');
  if(restoreBtn)restoreBtn.disabled=dashboardBackupBusy||isTeamMember||!pendingDashboardRestore;
}

async function fetchDashboardBackupRows(table,configure){
  const rows=[];
  for(let offset=0;;offset+=DASHBOARD_BACKUP_PAGE_SIZE){
    const{data,error}=await configure(db.from(table).select('*'))
      .range(offset,offset+DASHBOARD_BACKUP_PAGE_SIZE-1);
    if(error)throw new Error(`Could not back up ${table}: ${error.message}`);
    const page=data||[];
    rows.push(...page);
    if(rows.length>DASHBOARD_BACKUP_MAX_ROWS)throw new Error(`Backup exceeds the ${DASHBOARD_BACKUP_MAX_ROWS.toLocaleString()}-record safety limit.`);
    if(page.length<DASHBOARD_BACKUP_PAGE_SIZE)return rows;
  }
}

async function fetchDashboardBackupByIds(table,column,ids){
  const rows=[];
  for(let start=0;start<ids.length;start+=DASHBOARD_BACKUP_PAGE_SIZE){
    const chunk=ids.slice(start,start+DASHBOARD_BACKUP_PAGE_SIZE);
    rows.push(...await fetchDashboardBackupRows(table,q=>q.in(column,chunk)));
  }
  return rows;
}

async function collectDashboardBackup(){
  if(!currentUser||!effectiveSellerId)throw new Error('Your seller account is not ready for backup.');
  const tables=Object.fromEntries(DASHBOARD_BACKUP_TABLES.map(name=>[name,[]]));
  const[profileRows,listings,rentalUnits,bnbProperties]=await Promise.all([
    fetchDashboardBackupRows('profiles',q=>q.eq('id',effectiveSellerId)),
    fetchDashboardBackupRows('listings',q=>q.eq('seller_id',effectiveSellerId)),
    fetchDashboardBackupRows('rental_units',q=>q.eq('seller_id',effectiveSellerId)),
    fetchDashboardBackupRows('bnb_properties',q=>q.eq('seller_id',effectiveSellerId))
  ]);
  if(!profileRows.length)throw new Error('Your account profile could not be found; no backup was created.');
  tables.profiles=profileRows;
  tables.listings=listings;
  tables.rental_units=rentalUnits;
  tables.bnb_properties=bnbProperties;

  const listingIds=listings.map(row=>row.id);
  const rentalUnitIds=rentalUnits.map(row=>row.id);
  const bnbPropertyIds=bnbProperties.map(row=>row.id);
  const[
    listingPhotos,listingUnits,enquiries,messages,payments,reviews,notifications,
    tenantDocuments,unitExpenses,maintenanceRequests,chatSessions,tenants
  ]=await Promise.all([
    fetchDashboardBackupByIds('listing_photos','listing_id',listingIds),
    fetchDashboardBackupByIds('listing_units','listing_id',listingIds),
    fetchDashboardBackupByIds('enquiries','listing_id',listingIds),
    fetchDashboardBackupByIds('messages','listing_id',listingIds),
    fetchDashboardBackupRows('payments',q=>q.eq('seller_id',effectiveSellerId)),
    fetchDashboardBackupRows('reviews',q=>q.eq('review_type','seller').eq('target_seller_id',effectiveSellerId)),
    fetchDashboardBackupRows('notifications',q=>q.eq('seller_id',effectiveSellerId)),
    fetchDashboardBackupRows('tenant_documents',q=>q.eq('seller_id',effectiveSellerId)),
    fetchDashboardBackupRows('unit_expenses',q=>q.eq('seller_id',effectiveSellerId)),
    fetchDashboardBackupRows('maintenance_requests',q=>q.eq('seller_id',effectiveSellerId)),
    fetchDashboardBackupRows('chat_sessions',q=>q.eq('session_type','seller').eq('seller_id',effectiveSellerId)),
    fetchDashboardBackupByIds('tenants','rental_unit_id',rentalUnitIds)
  ]);
  Object.assign(tables,{
    listing_photos:listingPhotos,listing_units:listingUnits,enquiries,messages,payments,reviews,notifications,
    tenant_documents:tenantDocuments,unit_expenses:unitExpenses,maintenance_requests:maintenanceRequests,
    chat_sessions:chatSessions,tenants
  });
  const tenantIds=tenants.map(row=>row.id);
  const chatSessionIds=chatSessions.map(row=>row.id);
  const[rentPayments,bnbBookings,chatMessages]=await Promise.all([
    fetchDashboardBackupByIds('rent_payments','tenant_id',tenantIds),
    fetchDashboardBackupByIds('bnb_bookings','bnb_property_id',bnbPropertyIds),
    fetchDashboardBackupByIds('chat_messages','session_id',chatSessionIds)
  ]);
  Object.assign(tables,{rent_payments:rentPayments,bnb_bookings:bnbBookings,chat_messages:chatMessages});
  const totalRows=DASHBOARD_BACKUP_TABLES.reduce((total,name)=>total+tables[name].length,0);
  if(totalRows>DASHBOARD_BACKUP_MAX_ROWS)throw new Error(`Backup exceeds the ${DASHBOARD_BACKUP_MAX_ROWS.toLocaleString()}-record safety limit.`);
  return{format:DASHBOARD_BACKUP_FORMAT,version:DASHBOARD_BACKUP_VERSION,createdAt:new Date().toISOString(),sellerId:effectiveSellerId,tables};
}

function dashboardBackupSummary(tables){
  return DASHBOARD_BACKUP_TABLES
    .filter(name=>(tables[name]||[]).length)
    .map(name=>`${name.replace(/_/g,' ')}: ${tables[name].length}`)
    .join(' · ')||'No records found';
}

async function downloadDashboardBackup(){
  if(dashboardBackupBusy)return;
  const button=document.getElementById('dashboard-backup-download');
  const status=document.getElementById('dashboard-backup-status');
  dashboardBackupBusy=true;
  if(button){button.disabled=true;button.textContent='Preparing backup…';}
  updateDashboardBackupControls();
  status.textContent='Reading account records securely…';
  try{
    const backup=await collectDashboardBackup();
    backup.version=DASHBOARD_BACKUP_VERSION;
    backup.integrity={algorithm:'SHA-256',digest:await dashboardBackupDigest(backup)};
    const blob=new Blob([JSON.stringify(backup)],{type:'application/json'});
    if(blob.size>DASHBOARD_BACKUP_MAX_BYTES)throw new Error('This backup is larger than the 50 MB restore limit and was not downloaded.');
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;
    link.download=`Nyumba254-Backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    rememberDashboardBackup({fileName:link.download,createdAt:backup.createdAt,bytes:blob.size,digest:backup.integrity.digest});
    status.textContent=`Backup downloaded. ${dashboardBackupSummary(backup.tables)}.`;
    showToast('Account backup downloaded ✓','success');
  }catch(error){
    console.error('Dashboard backup failed:',error);
    status.textContent=`Backup failed: ${error.message||String(error)}`;
    showToast('Could not create backup: '+(error.message||String(error)),'error');
  }finally{
    dashboardBackupBusy=false;
    if(button){button.disabled=false;button.textContent='Download account backup';}
    updateDashboardBackupControls();
  }
}

function validateDashboardBackup(backup){
  if(!backup||typeof backup!=='object'||Array.isArray(backup))throw new Error('The selected file is not a valid Nyumba254 backup.');
  if(backup.format!==DASHBOARD_BACKUP_FORMAT||(backup.version!==1&&backup.version!==DASHBOARD_BACKUP_VERSION))throw new Error('This backup format or version is not supported.');
  if(String(backup.sellerId)!==String(effectiveSellerId))throw new Error('This backup belongs to a different seller account.');
  if(!backup.tables||typeof backup.tables!=='object'||Array.isArray(backup.tables))throw new Error('The backup has no valid records section.');
  const unknown=Object.keys(backup.tables).filter(name=>!DASHBOARD_BACKUP_TABLES.includes(name));
  if(unknown.length)throw new Error(`The backup contains unsupported data tables: ${unknown.join(', ')}.`);
  const tables=Object.fromEntries(DASHBOARD_BACKUP_TABLES.map(name=>{
    const rows=backup.tables[name];
    if(!Array.isArray(rows))throw new Error(`The backup is missing the ${name} record list.`);
    return[name,rows];
  }));
  const totalRows=DASHBOARD_BACKUP_TABLES.reduce((total,name)=>total+tables[name].length,0);
  if(totalRows>DASHBOARD_BACKUP_MAX_ROWS)throw new Error(`The backup exceeds the ${DASHBOARD_BACKUP_MAX_ROWS.toLocaleString()}-record safety limit.`);
  const idSet=name=>new Set(tables[name].map(row=>String(row?.id)));
  const listingIds=idSet('listings'),rentalUnitIds=idSet('rental_units'),tenantIds=idSet('tenants');
  const bnbPropertyIds=idSet('bnb_properties'),chatSessionIds=idSet('chat_sessions');
  const requireOwner=(table,field='seller_id')=>{
    for(const row of tables[table]){
      if(!row||typeof row!=='object'||Array.isArray(row)||row[field]==null||String(row[field])!==String(effectiveSellerId))
        throw new Error(`The backup contains an out-of-account record in ${table}.`);
    }
  };
  for(const name of DASHBOARD_BACKUP_TABLES){
    for(const row of tables[name]){
      if(!row||typeof row!=='object'||Array.isArray(row)||row.id==null||
        (typeof row.id==='string'&&!row.id.trim())||
        (typeof row.id==='number'&&!Number.isFinite(row.id))||
        !['string','number'].includes(typeof row.id))
        throw new Error(`The backup contains an invalid record in ${name}.`);
    }
  }
  requireOwner('profiles','id');
  ['listings','rental_units','bnb_properties','payments','notifications','tenant_documents','unit_expenses','maintenance_requests'].forEach(name=>requireOwner(name));
  requireOwner('reviews','target_seller_id');
  requireOwner('chat_sessions');
  if(tables.chat_sessions.some(row=>row.session_type!=='seller'))throw new Error('The backup contains an unsupported support conversation.');
  const requireParent=(table,field,parents)=>{
    for(const row of tables[table])if(row[field]==null||!parents.has(String(row[field])))
      throw new Error(`The backup contains an unlinked record in ${table}.`);
  };
  ['listing_photos','listing_units','enquiries','messages'].forEach(name=>requireParent(name,'listing_id',listingIds));
  requireParent('tenants','rental_unit_id',rentalUnitIds);
  requireParent('rent_payments','tenant_id',tenantIds);
  requireParent('bnb_bookings','bnb_property_id',bnbPropertyIds);
  requireParent('chat_messages','session_id',chatSessionIds);
  for(const row of tables.tenant_documents){
    if(row.tenant_id!=null&&!tenantIds.has(String(row.tenant_id)))throw new Error('The backup contains a tenant document linked outside this account.');
    if(row.rental_unit_id!=null&&!rentalUnitIds.has(String(row.rental_unit_id)))throw new Error('The backup contains a tenant document linked outside this account.');
  }
  for(const table of ['unit_expenses','maintenance_requests']){
    for(const row of tables[table]){
      if(row.rental_unit_id!=null&&!rentalUnitIds.has(String(row.rental_unit_id)))throw new Error(`The backup contains an out-of-account property reference in ${table}.`);
      if(row.bnb_property_id!=null&&!bnbPropertyIds.has(String(row.bnb_property_id)))throw new Error(`The backup contains an out-of-account BNB reference in ${table}.`);
    }
  }
  return{...backup,tables};
}

async function previewDashboardBackup(file){
  pendingDashboardRestore=null;
  updateDashboardBackupControls();
  const status=document.getElementById('dashboard-backup-status');
  const input=document.getElementById('dashboard-backup-file');
  try{
    if(!file)throw new Error('Choose a backup file first.');
    if(file.size>DASHBOARD_BACKUP_MAX_BYTES)throw new Error('Backup files must be 50 MB or smaller.');
    const parsed=JSON.parse(await file.text());
    const integrityVerified=await verifyDashboardBackupIntegrity(parsed);
    const backup=validateDashboardBackup(parsed);
    pendingDashboardRestore=backup;
    status.textContent=isTeamMember
      ?`Backup is valid for this account, but only the account owner can restore it. ${dashboardBackupSummary(backup.tables)}.`
      :`Ready to restore from ${file.name}. ${integrityVerified?'SHA-256 integrity verified.':'Legacy backup: no integrity hash.'} ${dashboardBackupSummary(backup.tables)}. Existing records will not be overwritten.`;
  }catch(error){
    console.error('Dashboard backup validation failed:',error);
    status.textContent=`Backup not ready: ${error.message||String(error)}`;
    showToast('Could not read backup: '+(error.message||String(error)),'error');
  }finally{
    if(input)input.value='';
    updateDashboardBackupControls();
  }
}

async function restoreDashboardBackup(){
  if(dashboardBackupBusy||!pendingDashboardRestore)return;
  if(isTeamMember){showToast('Only the account owner can restore a backup.','error');return;}
  const backup=pendingDashboardRestore;
  const summary=dashboardBackupSummary(backup.tables);
  if(!await lcConfirm({
    title:'Restore account backup?',
    message:`This will add missing records from this account's backup. Existing records will not be replaced. Restored listings will return as pending review. Platform payment history is not recreated. Continue?<br><br><strong>${escHtml(summary)}</strong>`,
    confirmLabel:'Restore missing records',requireText:'RESTORE'
  }))return;
  const status=document.getElementById('dashboard-backup-status');
  const button=document.getElementById('dashboard-backup-restore');
  const inserted={};
  dashboardBackupBusy=true;
  updateDashboardBackupControls();
  if(button)button.textContent='Restoring…';
  status.textContent='Restoring missing records. Keep this page open until it finishes…';
  try{
    for(const table of DASHBOARD_RESTORE_ORDER){
      const rows=backup.tables[table];
      if(!rows.length)continue;
      inserted[table]=0;
      for(let offset=0;offset<rows.length;offset+=100){
        let batch=rows.slice(offset,offset+100).map(row=>({...row}));
        if(table==='listings'){
          batch=batch.map(row=>({...row,status:'pending',payment_status:null,is_featured:false,views:0}));
        }
        const onConflict=table==='rent_payments'?'tenant_id,period_month':'id';
        const{data,error}=await db.from(table).upsert(batch,{onConflict,ignoreDuplicates:true}).select('id');
        if(error)throw new Error(`Restore stopped at ${table} records ${offset+1}–${Math.min(offset+batch.length,rows.length)}: ${error.message}`);
        inserted[table]+=(data||[]).length;
      }
    }
    const restored=Object.entries(inserted).filter(([,count])=>count>0).map(([name,count])=>`${name.replace(/_/g,' ')}: ${count}`).join(' · ');
    const paymentsSkipped=backup.tables.payments.length;
    status.textContent=`Restore completed. Added ${restored||'no new records'}. ${paymentsSkipped} platform payment record(s) were left untouched.`;
    pendingDashboardRestore=null;
    updateDashboardBackupControls();
    showToast('Backup restore completed ✓','success');
    try{
      await loadAllData();
      await Promise.all([loadRentalUnits(),loadBnbLedger(),loadNotifBell()]);
      renderOverview();
    }catch(refreshError){
      console.error('Backup restored, but dashboard refresh failed:',refreshError);
      status.textContent+=` Dashboard refresh failed: ${refreshError.message||String(refreshError)}. Reload the page to refresh.`;
      showToast('Backup restored, but the dashboard could not refresh. Reload the page.','error');
    }
  }catch(error){
    console.error('Dashboard restore failed:',error,inserted);
    const partial=Object.entries(inserted).filter(([,count])=>count>0).map(([name,count])=>`${name.replace(/_/g,' ')}: ${count}`).join(' · ');
    status.textContent=`Restore stopped: ${error.message||String(error)}${partial?` Records already added: ${partial}. You can safely select the same backup and retry.`:''}`;
    showToast('Restore incomplete: '+(error.message||String(error)),'error');
  }finally{
    dashboardBackupBusy=false;
    if(button)button.textContent='Restore missing records';
    updateDashboardBackupControls();
  }
}

async function loadAllData(){
  const{data:listingsData,error:listingsError}=await db.from('listings').select('*, listing_photos(*), listing_units(*)').eq('seller_id',effectiveSellerId).order('created_at',{ascending:false});
  if(listingsError) throw new Error(`Could not load your listings: ${listingsError.message}`);
  allListings=listingsData||[];
  const ids=allListings.map(l=>l.id);
  if(ids.length){
    const{data:feeRows,error:feeError}=await db.rpc('get_my_listing_viewing_fees',{p_listing_ids:ids});
    if(feeError)throw new Error(`Could not load listing viewing fees: ${feeError.message}`);
    if((feeRows||[]).length!==ids.length)throw new Error('The viewing-fee service did not return every listing. Reload the dashboard and try again.');
    const fees=new Map((feeRows||[]).map(row=>[row.listing_id,Number(row.viewing_fee)||0]));
    allListings=allListings.map(listing=>({...listing,viewing_fee:fees.get(listing.id)??0}));
  }
  const msgCutoff=new Date(Date.now()-MSG_HISTORY_DAYS*86400000).toISOString();

  const[enqRes,msgRes,payRes,revRes]=await Promise.all([
    ids.length ? db.from('enquiries').select('*, listings(title, area)').in('listing_id',ids).order('created_at',{ascending:false}) : Promise.resolve({data:[]}),
    ids.length ? db.from('messages').select('*').in('listing_id',ids).gte('created_at',msgCutoff).order('created_at',{ascending:true}) : Promise.resolve({data:[]}),
    db.from('payments').select('*, listings(title)').eq('seller_id',effectiveSellerId).order('created_at',{ascending:false}),
    db.from('reviews').select('*, listings(title)').eq('review_type','seller').eq('target_seller_id',effectiveSellerId).order('created_at',{ascending:false}),
  ]);

  const failedQuery=[['enquiries',enqRes],['messages',msgRes],['payments',payRes],['reviews',revRes]].find(([,result])=>result.error);
  if(failedQuery) throw new Error(`Could not load ${failedQuery[0]}: ${failedQuery[1].error.message}`);
  allEnquiries=enqRes.data||[];
  allMessages=msgRes.data||[];
  allPayments=payRes.data||[];
  allReviews=revRes.data||[];

  buildThreads();updateNavBadges();
  listingStatusSnapshot={};
  allListings.forEach(l=>{listingStatusSnapshot[l.id]=l.status;});
  subscribeMessagesRealtime();
}

function subscribeMessagesRealtime(){
  if(messagesChannel){messagesChannel.unsubscribe();messagesChannel=null;}
  const ids=allListings.map(l=>l.id);
  if(!ids.length)return;
  messagesChannel=db.channel('dash-messages-'+currentUser.id)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`listing_id=in.(${ids.join(',')})`},payload=>{
      handleIncomingMessage(payload.new);
    })
    .subscribe((status)=>{
      if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
        console.warn('Messages realtime status:',status,'— relying on 30s poll fallback');
      }
    });
}

function handleIncomingMessage(msg){
  // Skip if we already have it (e.g. our own optimistic insert from sendChatReply)
  if(allMessages.some(m=>m.id===msg.id))return;
  allMessages.push(msg);
  buildThreads();updateNavBadges();

  const onMessagesPage=document.getElementById('page-messages').classList.contains('active');
  const matchesActive=activeThread&&msg.listing_id===activeThread.listing_id&&((msg.buyer_token&&msg.buyer_token===activeThread.buyer_token)||(msg.buyer_phone&&msg.buyer_phone===activeThread.buyer_phone));

  if(onMessagesPage){
    renderThreadList();
    if(matchesActive){
      activeThread=threads.find(t=>t.key===activeThread.key)||activeThread;
      renderChatMessages(activeThread);
      setTimeout(()=>{const mc=document.getElementById('chat-messages');if(mc)mc.scrollTop=mc.scrollHeight;},30);
      if(msg.sender==='buyer')markThreadRead(activeThread);
    }
  }
  if(msg.sender==='buyer'&&!(onMessagesPage&&matchesActive)){
    playActivitySound();
    showToast('New message received','success');
  }
  if(document.getElementById('page-overview').classList.contains('active'))renderOverview();
}

function buildThreads(){
  const map=new Map();
  allEnquiries.forEach(e=>{const key=`${e.listing_id}__${e.buyer_phone||e.buyer_token||e.id}`;if(!map.has(key)){map.set(key,{key,listing_id:e.listing_id,buyer_token:e.buyer_token||null,buyer_name:e.buyer_name||'Unknown buyer',buyer_phone:e.buyer_phone||'',listing_title:e.listings?.title||'Listing',listing_area:e.listings?.area||'',messages:[{id:'enq-'+e.id,enquiry_id:e.id,sender:'buyer',message:e.message||'',created_at:e.created_at,read_at:e.read_at}],last_at:e.created_at,unread_count:e.read_at?0:1});}});
  allMessages.forEach(m=>{const key=`${m.listing_id}__${m.buyer_phone||m.buyer_token||''}`;if(map.has(key)){const t=map.get(key);const isDupe=t.messages.some(x=>x.id==='enq-'+m.id||((x.content||x.message)===(m.content||m.message)&&Math.abs(new Date(x.created_at)-new Date(m.created_at))<2000));if(!isDupe){t.messages.push(m);if(m.sender==='buyer'&&!m.read_at)t.unread_count=(t.unread_count||0)+1;}if(new Date(m.created_at)>new Date(t.last_at))t.last_at=m.created_at;}else{const listing=allListings.find(l=>l.id===m.listing_id);map.set(key,{key,listing_id:m.listing_id,buyer_token:m.buyer_token||null,buyer_name:m.buyer_name||'Buyer',buyer_phone:m.buyer_phone||'',listing_title:listing?.title||'Listing',listing_area:listing?.area||'',messages:[m],last_at:m.created_at,unread_count:(m.sender==='buyer'&&!m.read_at)?1:0});}});
  threads=Array.from(map.values()).map(t=>{t.messages.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));return t;}).sort((a,b)=>new Date(b.last_at)-new Date(a.last_at));
}

async function pollNewMessages(){
  if(!allListings.length)return;
  const ids=allListings.map(l=>l.id);
  const msgCutoff=new Date(Date.now()-MSG_HISTORY_DAYS*86400000).toISOString();
  const{data:msgData}=await db.from('messages').select('*').in('listing_id',ids).gte('created_at',msgCutoff).order('created_at',{ascending:true});
  const hadCount=allMessages.length;
  allMessages=msgData||[];
  buildThreads();updateNavBadges();
  if(document.getElementById('page-messages').classList.contains('active')){renderThreadList();if(activeThread){const r=threads.find(t=>t.key===activeThread.key);if(r){activeThread=r;renderChatPane(activeThread);}}}
  if(allMessages.length>hadCount){playActivitySound();showToast(`${allMessages.length-hadCount} new message(s) received`,'success');}
}

function updateNavBadges(){
  lcBuildStats();
  const attnCount=allListings.filter(lcNeedsAttention).length;
  const lb=document.getElementById('nav-badge-listings');
  lb.textContent=attnCount;lb.style.display=attnCount?'inline-block':'none';lb.classList.add('red');
  const totalUnread=threads.reduce((s,t)=>s+(t.unread_count||0),0);
  const msgBadge=document.getElementById('nav-badge-messages');msgBadge.textContent=totalUnread;msgBadge.style.display=totalUnread>0?'inline-block':'none';
  const enqBadge=document.getElementById('nav-badge-enquiries');enqBadge.textContent=totalUnread;enqBadge.style.display=totalUnread>0?'inline-block':'none';
  const unrespondedReviews=allReviews.filter(r=>!r.response_text).length;
  const revBadge=document.getElementById('nav-badge-reviews');
  if(revBadge){revBadge.textContent=unrespondedReviews;revBadge.style.display=unrespondedReviews>0?'inline-block':'none';}
  document.title=(totalUnread>0?`(${totalUnread}) `:'')+'Dashboard — Nyumba254';
  updateMarkAllBtn();
}

function getListingStatusDisplay(l){
  if(l.recycle_bin){const d=l.purge_at?Math.max(0,Math.ceil((new Date(l.purge_at)-new Date())/86400000)):null;return{label:'In recycle bin',cls:'status-disabled',banner:`Disabled by admin${l.disabled_reason?': '+escHtml(l.disabled_reason):''}. Contact admin for more information.`+(d!==null?` Removed in ${d} day(s).`:'')};}
  if(l.is_disabled)return{label:l.disabled_by_subscription?'Plan expired':'Disabled by admin',cls:'status-disabled',banner:l.disabled_by_subscription?'Your BNB plan expired — subscribe again from Settings to bring this listing back.':`Disabled by admin${l.disabled_reason?': '+escHtml(l.disabled_reason):''}. Contact admin for more information.`};
  if(l.status==='occupied'){const word=l.price_type==='rent'?'occupied':'sold';return{label:l.price_type==='rent'?'Occupied':'Sold',cls:'status-occupied',banner:`Marked as ${word} — still visible to buyers, shown as unavailable.`};}
  if(l.status==='scheduled')return{label:'Scheduled',cls:'status-pending',banner:l.publish_at?`Approved — goes live automatically on ${new Date(l.publish_at).toLocaleString('en-KE')}.`:null};
  if(l.status==='approved_unpaid'&&l.payment_status==='pending_verification')return{label:'Verifying payment',cls:'status-pending',banner:'Your M-Pesa payment is being verified — this usually takes a few minutes.'};
  if(l.status==='approved_unpaid')return{label:'Awaiting payment',cls:'status-pending',banner:'Approved — pay the listing fee to make it live.'};
  if(l.status==='approved_unpaid_bnb')return{label:'Awaiting BNB plan',cls:'status-pending',banner:'Approved — subscribe to a BNB plan to make it live.'};
  return{label:statusLabel(l.status),cls:'status-'+l.status,banner:null};
}
// BNB (airbnb) listings expire with the seller's BNB plan, not with a fixed
// trial window — this mirrors getTrialDaysLeft() but reads bnb_expires_at
// off the owner profile instead of the listing itself.
function getBnbDaysLeft(l){
  if(l.category!=='airbnb')return null;
  const p=ownerProfile||currentProfile;
  if(p?.plan_category!=='bnb'||!p?.bnb_expires_at)return null;
  const diffMs=new Date(p.bnb_expires_at)-new Date();
  return Math.max(0,Math.ceil(diffMs/86400000));
}

async function loadDemandMatches(){
  const wrap=document.getElementById('demand-matches-list');
  if(!wrap)return;
  if(!subscriptionInfo().active){
    wrap.innerHTML=`<div style="text-align:center;padding:14px 0"><p style="font-size:12.5px;color:var(--text-3);margin-bottom:10px">See when buyers' saved searches match one of your listings.</p><a href="/plans" class="btn btn-primary btn-sm">Upgrade to unlock</a></div>`;
    return;
  }
  const{data,error}=await db.from('seller_demand_notices').select('*, listings(title)').eq('seller_id',currentUser.id).order('created_at',{ascending:false}).limit(5);
  if(error||!data?.length){wrap.innerHTML='<div style="padding:10px 0;color:var(--text-3);font-size:13px">No buyer matches yet — you\'ll see them here when a buyer\'s saved search matches one of your listings.</div>';return;}
  wrap.innerHTML=data.map(n=>`<div class="quick-row"><span>${n.match_count} buyer${n.match_count!==1?'s':''} searching ${n.category?'for '+escHtml(n.category):''} in ${escHtml(n.area||'your area')}${n.listings?.title?' — '+escHtml(n.listings.title):''}</span><span>${timeAgo(n.created_at)}</span></div>`).join('');
}

function renderOverview(){
  const active=allListings.filter(l=>l.status==='active'&&!l.is_disabled).length;
  const unread=threads.reduce((s,t)=>s+(t.unread_count||0),0);
  const confirmed=allPayments.filter(p=>p.status==='confirmed'||p.status==='paid');
  const totalPaid=confirmed.reduce((s,p)=>s+(Number(p.amount)||0),0);
  const views=allListings.reduce((s,l)=>s+(Number(l.views)||0),0);
  renderRoleTrustOverview();
  document.getElementById('stat-active').textContent=active;
  document.getElementById('stat-active-delta').textContent=`of ${allListings.length} total listing${allListings.length!==1?'s':''}`;
  const buyerThreadCount=threads.filter(t=>t.messages.some(m=>m.sender==='buyer')).length;
  document.getElementById('stat-enquiries').textContent=buyerThreadCount;
  const now7=Date.now(), d7=7*86400000;
  const enqThis7=allEnquiries.filter(e=>Date.now()-new Date(e.created_at)<d7).length;
  const enqPrev7=allEnquiries.filter(e=>{const age=Date.now()-new Date(e.created_at);return age>=d7&&age<2*d7;}).length;
  const enqTrendPct=enqPrev7>0?Math.round(((enqThis7-enqPrev7)/enqPrev7)*100):(enqThis7>0?100:0);
  const enqTrendHtml=(enqThis7||enqPrev7)?` <span style="font-weight:700;color:${enqTrendPct>=0?'#065f46':'var(--red)'}">${enqTrendPct>=0?'▲':'▼'} ${Math.abs(enqTrendPct)}% vs last week</span>`:'';
  document.getElementById('stat-enquiries-delta').innerHTML=`${buyerThreadCount} buyer${buyerThreadCount!==1?'s':''} reached out${enqTrendHtml}`;
  document.getElementById('stat-new-enq').textContent=unread;
  document.getElementById('stat-new-enq-delta').textContent=unread>0?`${unread} unread — check messages`:'All caught up ✓';
  document.getElementById('stat-paid').textContent=`KES ${totalPaid.toLocaleString('en-KE')}`;
  document.getElementById('stat-paid-delta').textContent=`${confirmed.length} payment${confirmed.length!==1?'s':''}`;
  document.getElementById('stat-views').textContent=views.toLocaleString('en-KE');
  const avgViewsPerListing=allListings.length?Math.round(views/allListings.length):0;
  document.getElementById('stat-views-delta').textContent=`~${avgViewsPerListing} views per listing`;
  renderActivityFeed();renderChart();renderQuickListings();loadDemandMatches();renderPerformanceSummary();renderGettingStarted();renderWeekMomentum();renderSmartInsight();renderListingPerformance();renderActionCenter();
}

function renderActivityFeed(){
  const items=[];
  threads.slice(0,6).forEach(t=>{const lb=[...t.messages].reverse().find(m=>m.sender==='buyer');if(!lb)return;const isFirstContact=String(lb.id).startsWith('enq-');items.push({type:isFirstContact?'enquiry':'message',time:lb.created_at,html:isFirstContact?`<strong>${escHtml(t.buyer_name)}</strong> enquired about <strong>${escHtml(t.listing_title)}</strong>`:`<strong>${escHtml(t.buyer_name)}</strong> sent a message about <strong>${escHtml(t.listing_title)}</strong>`,action:()=>{showAllMessages();openThread(t.key);}});});
  allListings.slice(0,3).forEach(l=>items.push({type:'listing',time:l.created_at,html:`You posted <strong>${escHtml(l.title)}</strong> in ${escHtml(l.area)}`,action:()=>showPage('listings')}));
  allPayments.slice(0,2).forEach(p=>items.push({type:'payment',time:p.created_at,html:`Payment of <strong>KES ${Number(p.amount||0).toLocaleString('en-KE')}</strong> recorded`,action:()=>showPage('payments')}));
  items.sort((a,b)=>new Date(b.time)-new Date(a.time));
  const icons={enquiry:`<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13"/></svg>`,message:`<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,listing:`<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>`,payment:`<svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`};
  const feed=document.getElementById('activity-feed');const top=items.slice(0,8);
  if(!top.length){feed.innerHTML=`<div style="text-align:center;padding:30px 0;color:var(--text-3);font-size:13px">No activity yet. <a href="/post-listing" style="color:var(--green);font-weight:500">Post your first listing →</a></div>`;return;}
  feed.innerHTML=top.map((i,idx)=>`<div class="activity-item" data-idx="${idx}" role="button" tabindex="0" aria-label="${escAttr(i.html.replace(/<[^>]+>/g,''))}"><div class="activity-dot ${i.type}">${icons[i.type]||icons.enquiry}</div><div class="activity-text">${i.html}</div><div class="activity-time">${timeAgo(i.time)}</div></div>`).join('');
  feed.querySelectorAll('.activity-item').forEach((el,idx)=>{
    el.onclick=top[idx].action;
    el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();top[idx].action();}};
  });
}

function renderChart(){
  const labels=[],counts=[];
  for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const k=d.toISOString().slice(0,10);labels.push(d.toLocaleDateString('en-KE',{weekday:'short'}));counts.push(allEnquiries.filter(e=>e.created_at&&e.created_at.slice(0,10)===k).length+allMessages.filter(m=>m.sender==='buyer'&&m.created_at&&m.created_at.slice(0,10)===k).length);}
  const max=Math.max(...counts,1);
  document.getElementById('chart-bars').innerHTML=counts.map((c,i)=>`<div class="chart-bar" style="height:${Math.round((c/max)*68)+8}px"><div class="bar-tip">${labels[i]}: ${c}</div></div>`).join('');
  document.getElementById('chart-labels').innerHTML=labels.map(l=>`<div class="chart-label">${l}</div>`).join('');
}

function renderWeekMomentum(){
  const card=document.getElementById('week-momentum-card');
  if(!card)return;
  const now=Date.now(), d7=7*86400000;
  const enqThis=allEnquiries.filter(e=>now-new Date(e.created_at)<d7).length;
  const enqPrev=allEnquiries.filter(e=>{const age=now-new Date(e.created_at);return age>=d7&&age<2*d7;}).length;
  const confirmedPay=p=>p.status==='confirmed'||p.status==='paid';
  const payThis=allPayments.filter(p=>confirmedPay(p)&&now-new Date(p.created_at)<d7).reduce((s,p)=>s+(Number(p.amount)||0),0);
  const payPrev=allPayments.filter(p=>{const age=now-new Date(p.created_at);return confirmedPay(p)&&age>=d7&&age<2*d7;}).reduce((s,p)=>s+(Number(p.amount)||0),0);
  if(!enqThis&&!enqPrev&&!payThis&&!payPrev){card.style.display='none';return;}
  const enqDiff=enqThis-enqPrev;
  const payDiff=payThis-payPrev;
  const parts=[];
  if(enqPrev||enqThis)parts.push(`<strong style="color:${enqDiff>=0?'#065f46':'var(--red)'}">${enqDiff>=0?'↑':'↓'} ${Math.abs(enqDiff)} ${Math.abs(enqDiff)===1?'enquiry':'enquiries'}</strong> vs last week`);
  if(payPrev||payThis)parts.push(`<strong style="color:${payDiff>=0?'#065f46':'var(--red)'}">${payDiff>=0?'↑':'↓'} KES ${Math.abs(payDiff).toLocaleString('en-KE')}</strong> collected vs last week`);
  card.style.display='block';
  card.innerHTML=`<div style="font-size:13px;color:var(--green-dark);font-weight:600">📈 This week: ${parts.join(' · ')}</div>`;
}

function renderSmartInsight(){
  const card=document.getElementById('smart-insight-card');
  if(!card)return;
  const tips=[];
  const live=allListings.filter(l=>l.status==='active'&&!l.is_disabled);
  live.forEach(l=>{
    const dow=[0,0,0,0,0,0,0];
    threads.filter(t=>t.listing_id===l.id).forEach(t=>t.messages.forEach(m=>{if(m.sender==='buyer')dow[new Date(m.created_at).getDay()]++;}));
    const weekendCount=dow[0]+dow[6], weekdayCount=dow[1]+dow[2]+dow[3]+dow[4]+dow[5];
    if(weekendCount>=4&&weekendCount>weekdayCount*1.5){
      tips.push(`Your listing "${l.title}" gets noticeably more buyer messages on weekends — consider timing new posts or price updates for a Friday.`);
    }
  });
  const noPhotoCount=allListings.filter(l=>lcIsLive(l)&&lcPhotoCount(l)<=2).length;
  if(noPhotoCount>0)tips.push(`${noPhotoCount} of your live listing${noPhotoCount!==1?'s have':' has'} 2 or fewer photos — listings with 6+ photos consistently get more enquiries.`);
  const staleCount=allListings.filter(l=>{const d=lcDaysSinceEnquiry(l);return lcIsLive(l)&&d!==null&&d>=lcStaleThresholds(l).quiet;}).length;
  if(staleCount>0)tips.push(`${staleCount} listing${staleCount!==1?'s have':' has'} not had a buyer message in a while — a small price check might help (see Demand Insights or the Valuation tool).`);
  if(!tips.length){card.style.display='none';return;}
  const idx=Math.floor(Date.now()/86400000)%tips.length;
  card.style.display='block';
  card.innerHTML=`<div style="font-size:13px;color:#8a5a0f;font-weight:600">💡 ${escHtml(tips[idx])}</div>`;
}

function renderListingPerformance(){
  const card=document.getElementById('listing-performance-card');
  if(!card)return;
  const now=Date.now(),week=7*86400000,month=30*86400000;
  const enquiryStats=new Map();
  let currentWeek=0,previousWeek=0;
  allEnquiries.forEach(enquiry=>{
    const createdAt=new Date(enquiry.created_at).getTime();
    if(!Number.isFinite(createdAt))return;
    const age=now-createdAt;
    if(age>=0&&age<week)currentWeek++;
    else if(age>=week&&age<week*2)previousWeek++;
    const key=String(enquiry.listing_id);
    const stats=enquiryStats.get(key)||{total:0,recent:0};
    stats.total++;
    if(age>=0&&age<month)stats.recent++;
    enquiryStats.set(key,stats);
  });
  const change=previousWeek?Math.round((currentWeek-previousWeek)/previousWeek*100):(currentWeek?null:0);
  const active=allListings.filter(l=>lcIsLive(l));
  const perListing=active.map(listing=>{
    const stats=enquiryStats.get(String(listing.id))||{total:0,recent:0};
    const views=Number(listing.views);
    const createdAt=new Date(listing.created_at).getTime();
    return{listing,views:Number.isFinite(views)&&views>0?views:0,recent:stats.recent,total:stats.total,createdAt};
  }).sort((a,b)=>b.views-a.views);
  const opportunities=perListing.filter(row=>row.views>=20&&row.recent===0&&Number.isFinite(row.createdAt)&&now-row.createdAt>=14*86400000).slice(0,3);
  const top=perListing.slice(0,3);
  card.style.display='block';
  card.innerHTML=`<div class="section-head" style="margin-bottom:12px">
    <h2 style="font-size:15px">📊 Listing performance</h2>
    <span style="font-size:12px;color:var(--text-3)">Buyer enquiries compare the last 7 days with the previous 7</span>
  </div>
  <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">
    <div style="padding:10px 14px;background:var(--surface);border-radius:8px"><strong>${currentWeek}</strong><span style="font-size:12px;color:var(--text-3)"> enquiries this week</span></div>
    <div style="padding:10px 14px;background:var(--surface);border-radius:8px"><strong style="color:${change===null||change>=0?'var(--green)':'var(--red)'}">${change===null?'New':`${change>=0?'↑':'↓'} ${Math.abs(change)}%`}</strong><span style="font-size:12px;color:var(--text-3)"> vs previous week</span></div>
  </div>
  ${opportunities.length?`<div style="font-size:12.5px;color:var(--amber);font-weight:600;margin:4px 0 8px">⚠️ ${opportunities.length} live listing${opportunities.length===1?' has':'s have'} 20+ lifetime views but no enquiry in 30 days.</div>`:''}
  ${top.length?top.map(row=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--border)">
    <div style="min-width:0;flex:1"><strong style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(row.listing.title||'Untitled listing')}</strong><span style="font-size:11.5px;color:var(--text-3)">${row.views.toLocaleString('en-KE')} lifetime views · ${row.recent} enquiries in 30 days</span></div>
    <button type="button" class="btn btn-outline btn-sm" data-performance-listing="${escAttr(row.listing.id)}">Review</button>
  </div>`).join(''):'<div style="font-size:12.5px;color:var(--text-3)">No live listings to compare yet.</div>'}`;
  card.querySelectorAll('[data-performance-listing]').forEach(button=>{
    button.addEventListener('click',()=>openListingPreview(button.dataset.performanceListing));
  });
}

function dismissGettingStarted(){
  try{localStorage.setItem('ny_gs_dismissed_'+(currentUser?.id||''),'1');}catch(e){}
  const card=document.getElementById('getting-started-card');
  if(card)card.style.display='none';
}
function gettingStartedAction(i){
  const steps=window.__gsSteps;
  if(steps&&steps[i]&&typeof steps[i].action==='function')steps[i].action();
}
function renderGettingStarted(){
  const card=document.getElementById('getting-started-card');
  const list=document.getElementById('getting-started-list');
  if(!card||!list)return;
  let dismissed=false;
  try{dismissed=localStorage.getItem('ny_gs_dismissed_'+(currentUser?.id||''))==='1';}catch(e){}
  const steps=[
    {done:currentProfile?.verification_status==='verified',label:'Verify your account',sub:'Unlocks unlimited listings and a trust badge',action:()=>{showPage('settings');setTimeout(()=>settingsJumpTo('verification-settings-section'),150);}},
    {done:allListings.length>0,label:'Post your first listing',sub:'Takes about 3 minutes',action:()=>{window.location.href='/post-listing';}},
    {done:allListings.length>0 && allListings.every(l=>(l.listing_photos||[]).length>0),label:'Add photos to every listing',sub:'Listings with 6+ photos get far more enquiries',action:()=>showPage('listings')},
    {done:threads.some(t=>t.messages.some(m=>m.sender==='seller')),label:'Reply to a buyer message',sub:'Fast replies win more viewings',action:()=>showAllMessages()},
  ];
  const allDone=steps.every(s=>s.done);
  if(dismissed||allDone){card.style.display='none';return;}
  card.style.display='block';
  window.__gsSteps=steps;
  list.innerHTML=steps.map((s,i)=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--white);border-radius:8px;border:1px solid var(--border)">
    <span style="width:22px;height:22px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;background:${s.done?'var(--green)':'var(--surface)'};color:${s.done?'white':'var(--text-3)'}">${s.done?'✓':''}</span>
    <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;${s.done?'text-decoration:line-through;color:var(--text-3)':''}">${escHtml(s.label)}</div><div style="font-size:11.5px;color:var(--text-3)">${escHtml(s.sub)}</div></div>
    ${!s.done?`<button class="btn btn-primary btn-sm" onclick="gettingStartedAction(${i})">Go</button>`:''}
  </div>`).join('');
}
function renderPerformanceSummary(){
  const el=document.getElementById('quick-listing-top');
  if(!el)return;
  if(!allListings.length){el.innerHTML='';return;}
  const withThreads=allListings.map(l=>({l,count:threads.filter(t=>t.listing_id===l.id).reduce((s,t)=>s+t.messages.length,0)}));
  const top=withThreads.sort((a,b)=>b.count-a.count)[0];
  if(!top||top.count===0){el.innerHTML='';return;}
  el.innerHTML=`<div style="background:var(--green-light);border-radius:10px;padding:10px 14px;font-size:12.5px;color:var(--green-dark);display:flex;align-items:center;gap:8px">
    <span style="font-size:15px">🏆</span>
    <span><strong>${escHtml(top.l.title)}</strong> is your top performer — ${top.count} message${top.count!==1?'s':''} so far.</span>
  </div>`;
}
function renderQuickListings(){
  const el=document.getElementById('quick-listings');
  if(!allListings.length){el.innerHTML=`<div style="text-align:center;padding:20px 0;color:var(--text-3);font-size:13px">No listings yet. <a href="/post-listing" style="color:var(--green);font-weight:500">Post one →</a></div>`;return;}
  el.innerHTML=allListings.slice(0,5).map(l=>{const cover=(l.listing_photos||[]).find(p=>p.is_cover)||(l.listing_photos||[])[0];const img=cover?`<img src="${escAttr(cover.url)}" alt=""/>`:`<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;const d=getListingStatusDisplay(l);const trialDays=getTrialDaysLeft(l);const trialTxt=trialDays!==null?` · Trial: ${trialDays}d left`:'';const hasUnitTypes=(l.listing_units&&l.listing_units.length>0);const priceTxt=hasUnitTypes?muPriceRangeText(l):`KES ${Number(l.price).toLocaleString('en-KE')}${NK_DASH_FREQ_SUFFIX[l.price_frequency||(l.price_type==='rent'?'month':'once')]||''}`;return `<div class="quick-listing"><div class="quick-img">${img}</div><div style="flex:1;min-width:0"><div class="quick-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(l.title)}</div><div class="quick-meta" style="${l.is_disabled?'color:var(--red)':''}">${escHtml(l.area)} · ${d.label}${trialTxt}</div></div><div class="quick-price">${priceTxt}</div></div>`;}).join('');
}

function debounce(fn,ms){let t;return function(...args){clearTimeout(t);t=setTimeout(()=>fn.apply(this,args),ms);};}
const debouncedRenderListingsTable=debounce(renderListingsTable,180);

function lcOnSearchInput(){
  const input=document.getElementById('listing-search');
  document.getElementById('lc-search-wrap')?.classList.toggle('has-value',!!(input&&input.value));
  lcRenderLimit=LC_PAGE_SIZE;
  debouncedRenderListingsTable();
}
function lcClearSearch(){
  const input=document.getElementById('listing-search');
  if(!input)return;
  input.value='';
  document.getElementById('lc-search-wrap')?.classList.remove('has-value');
  renderListingsTable();
  input.focus();
}
function filterListings(status){
  listingFilter=status;
  try{localStorage.setItem('ny_listing_filter',status);}catch(e){}
  if(selectedListingIds.size){selectedListingIds.clear();}
  lcRenderLimit=LC_PAGE_SIZE;
  lcFocusIndex=-1;
  renderListingsTable();
  document.getElementById('listings-filter-bar')?.scrollIntoView({block:'nearest',behavior:'smooth'});
}
function setListingSort(v){
  listingSort=v;
  try{localStorage.setItem('ny_listing_sort',v);}catch(e){}
  closeActionMenu();
  renderListingsTable();
  lcAnnounce('Sorted by '+(LC_SORTS.find(s=>s.id===v)?.label||v));
}
function setListingDensity(d){
  listingDensity=d;
  try{localStorage.setItem('ny_listing_density',d);}catch(e){}
  document.getElementById('listings-tbody')?.classList.toggle('density-compact',d==='compact');
  closeActionMenu();
}

function getTrialDaysLeft(l){
  if(l.payment_status!=='trial'&&!l.is_trial)return null;
  if(!l.trial_expires_at)return null;
  const diffMs=new Date(l.trial_expires_at)-new Date();
  return Math.max(0,Math.ceil(diffMs/86400000));
}

// ── Multi-unit helpers used across the table, quick list, and the modal ──
const NK_DASH_FREQ_SUFFIX = { month:'/mo', once:'', night:'/night', term:'/term', semester:'/semester', week:'/week' };
function muPriceRangeText(l){
  const units=l.listing_units||[];
  const prices=units.map(u=>Number(u.price)).filter(p=>!isNaN(p));
  const min=prices.length?Math.min(...prices):Number(l.price_min)||Number(l.price)||0;
  const max=prices.length?Math.max(...prices):Number(l.price_max)||Number(l.price)||0;
  const suffix=NK_DASH_FREQ_SUFFIX[l.price_frequency||(l.price_type==='rent'?'month':'once')]||'';
  return min===max?`KES ${min.toLocaleString('en-KE')}${suffix}`:`KES ${min.toLocaleString('en-KE')}–${max.toLocaleString('en-KE')}${suffix}`;
}
function muAvailabilitySummary(l){
  const units=l.listing_units||[];
  if(!units.length)return null;
  const totalAvail=units.reduce((s,u)=>s+(u.quantity_available??0),0);
  const totalUnits=units.reduce((s,u)=>s+(u.quantity_total??u.quantity_available??0),0);
  return`${totalAvail} of ${totalUnits} available`;
}

function requestTrialUpgrade(title){
  if(!scwOpen)scwToggle();
  scwCreateTicket('payments').then(()=>{
    setTimeout(()=>{
      const input=document.getElementById('scw-input');
      if(input){input.value=`Hi, I'd like to upgrade my listing "${title}" from the free trial to a paid plan. Could you help me with payment?`;scwSend();}
    },500);
  });
}

function openOccupiedModal(id,title){
  const l=allListings.find(x=>x.id===id);if(!l)return;
  occupiedTargetId=id;
  const isRent=l.price_type==='rent';
  document.getElementById('occupied-modal-title').textContent=isRent?'Mark as occupied?':'Mark as sold?';
  document.getElementById('occupied-listing-name').textContent=title;
  document.getElementById('occupied-modal-copy').innerHTML=`This will mark <strong>${escHtml(title)}</strong> as ${isRent?'occupied':'sold'} — it stays visible on the site but shown to buyers as unavailable, and you keep all your messages and history. You can reactivate it later if that falls through.`;
  document.getElementById('btn-confirm-occupied').textContent=isRent?'Yes, mark as occupied':'Yes, mark as sold';
  openModal('modal-occupied');
}

let payListingTargetId=null;
let editPhotosListingId=null;
const LISTING_PHOTOS_BUCKET = 'listing-photos'; // ← must match the bucket admin's dashboard uses
function storagePathFromPublicUrl(url) {
  const marker = `/storage/v1/object/public/${LISTING_PHOTOS_BUCKET}/`;
  const i = (url||'').indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}
function renderEditPhotosGrid(l) {
  const photos = l.listing_photos || [];
  if (!photos.length) return `<div style="font-size:12px;color:var(--text-3)">No photos yet</div>`;
  return photos.map(p => `
    <div style="position:relative;border-radius:8px;overflow:hidden;border:2px solid ${p.is_cover?'var(--green)':'var(--border)'};aspect-ratio:1">
      <img src="${escAttr(p.url)}" style="width:100%;height:100%;object-fit:cover;display:block"/>
      ${p.is_cover?`<span style="position:absolute;top:3px;left:3px;background:var(--green);color:white;font-size:9px;font-weight:700;padding:1px 5px;border-radius:6px">COVER</span>`:''}
      <div style="position:absolute;bottom:0;left:0;right:0;display:flex;gap:2px;padding:3px;background:rgba(0,0,0,0.55)">
        ${!p.is_cover?`<button type="button" title="Set as cover" onclick="setEditCoverPhoto('${p.id}')" style="flex:1;background:none;border:none;color:white;font-size:13px;cursor:pointer;padding:2px">★</button>`:''}
        <button type="button" title="Delete photo" onclick="deleteEditPhoto('${p.id}')" style="flex:1;background:none;border:none;color:white;font-size:13px;cursor:pointer;padding:2px">🗑</button>
      </div>
    </div>`).join('');
}
async function handleEditPhotoUpload(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length || !editPhotosListingId) return;
  const statusEl = document.getElementById('edit-photo-upload-status');
  const l = allListings.find(x=>x.id===editPhotosListingId);
  if (!l) return;
  l.listing_photos = l.listing_photos || [];
  for (let i = 0; i < files.length; i++) {
    const file = await compressImage(files[i]);
    statusEl.textContent = `Uploading ${i+1}/${files.length}…`;
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${editPhotosListingId}/${Date.now()}_${i}.${ext}`;
    const { error: upErr } = await db.storage.from(LISTING_PHOTOS_BUCKET).upload(path, file);
    if (upErr) { statusEl.textContent = 'Upload failed: ' + upErr.message; continue; }
    const { data: pub } = db.storage.from(LISTING_PHOTOS_BUCKET).getPublicUrl(path);
    const isCover = l.listing_photos.length === 0;
    const { data: row, error: insErr } = await db.from('listing_photos').insert({
      listing_id: editPhotosListingId, url: pub.publicUrl, is_cover: isCover,
    }).select().single();
    if (insErr) { statusEl.textContent = 'Save failed: ' + insErr.message; continue; }
    l.listing_photos.push(row);
  }
  statusEl.textContent = 'Done ✓';
  document.getElementById('edit-photos-grid').innerHTML = renderEditPhotosGrid(l);
  document.getElementById('edit-photo-upload').value = '';
  renderListingsTable();renderQuickListings();
}
async function deleteEditPhoto(photoId) {
  const l = allListings.find(x=>x.id===editPhotosListingId); if (!l) return;
  const photo = (l.listing_photos||[]).find(p=>p.id===photoId); if (!photo) return;
  if (!await lcConfirm({title:'Delete photo?',message:'This photo will be removed from the listing.',confirmLabel:'Delete',danger:true})) return;
  const path = storagePathFromPublicUrl(photo.url);
  const { count: sharedCount } = await db.from('listing_photos').select('id',{count:'exact',head:true}).eq('url', photo.url).neq('id', photoId);
if (path && !sharedCount) await db.storage.from(LISTING_PHOTOS_BUCKET).remove([path]);
  const { error } = await db.from('listing_photos').delete().eq('id', photoId);
  if (error) { showToast('Error deleting photo: '+error.message,'error'); return; }
  l.listing_photos = (l.listing_photos||[]).filter(p=>p.id!==photoId);
  if (photo.is_cover && l.listing_photos.length) {
    const newCover = l.listing_photos[0];
    await db.from('listing_photos').update({is_cover:true}).eq('id', newCover.id);
    newCover.is_cover = true;
  }
  document.getElementById('edit-photos-grid').innerHTML = renderEditPhotosGrid(l);
  showToast('Photo deleted','success');
  renderListingsTable();renderQuickListings();
}
async function setEditCoverPhoto(photoId) {
  const l = allListings.find(x=>x.id===editPhotosListingId); if (!l) return;
  await db.from('listing_photos').update({is_cover:false}).eq('listing_id', editPhotosListingId);
  const { error } = await db.from('listing_photos').update({is_cover:true}).eq('id', photoId);
  if (error) { showToast('Error: '+error.message,'error'); return; }
  (l.listing_photos||[]).forEach(p => p.is_cover = (p.id === photoId));
  document.getElementById('edit-photos-grid').innerHTML = renderEditPhotosGrid(l);
  showToast('Cover photo updated ✓','success');
  renderListingsTable();renderQuickListings();
}
function openPayListingModal(id){const _s=document.getElementById('pay-sms-paste');if(_s){_s.value='';parsePaySms('');}
  const l=allListings.find(x=>x.id===id);if(!l)return;
  payListingTargetId=id;
  const isBnbListing = l.category==='airbnb';
  const dueAmount = isBnbListing ? (Number(l.payment_due_amount)||Number(platformPrices.bnb_basic_price)||0) : Number(l.payment_due_amount||0);
  document.getElementById('pay-listing-intro').textContent = isBnbListing
    ? `Your listing "${l.title}" is approved. Pay a one-time fee to make it live now — no BNB subscription needed.`
    : `Your listing "${l.title}" is approved. Choose a plan and pay to make it live.`;
  document.getElementById('pay-standard-amount').textContent='KES '+dueAmount.toLocaleString('en-KE');
  document.getElementById('pay-plan-featured-row').style.display = isBnbListing ? 'none' : 'flex';
  const featuredEstimate=Math.round(dueAmount*1.6);
  document.getElementById('pay-featured-amount').textContent='KES '+featuredEstimate.toLocaleString('en-KE')+' · top placement, more photos';
  document.querySelector('input[name="pay-plan"][value="basic"]').checked=true;
  document.getElementById('pay-listing-ref').value='';
  updatePayListingAmount();
  openModal('modal-pay-listing');
}
function updatePayListingAmount(){
  const plan=document.querySelector('input[name="pay-plan"]:checked')?.value||'basic';
  const el=plan==='basic'?document.getElementById('pay-standard-amount'):document.getElementById('pay-featured-amount');
  document.getElementById('pay-listing-amount-display').textContent=el.textContent.split(' · ')[0]||el.textContent;
}
async function submitPayListing(){
  const code=document.getElementById('pay-listing-ref').value.trim();
  if(!code||code.length!==10){showToast('Enter a valid 10-character M-Pesa code','error');return;}
  const plan=document.querySelector('input[name="pay-plan"]:checked')?.value||'basic';
  const l=allListings.find(x=>x.id===payListingTargetId);
  const amountText=(plan==='basic'?document.getElementById('pay-standard-amount'):document.getElementById('pay-featured-amount')).textContent;
  const amount=parseFloat(amountText.replace(/[^\d.]/g,''))||l?.payment_due_amount||0;
  const btn=document.getElementById('btn-submit-pay-listing');btn.disabled=true;btn.textContent='Submitting…';
  const{error}=await db.from('payments').insert({listing_id:payListingTargetId,seller_id:effectiveSellerId,amount,method:'paybill',reference:code,type:plan==='featured'?'featured_upgrade':'listing_fee',status:'pending_verification'});
  btn.disabled=false;btn.textContent='Submit for verification';
  if(error){showToast('Could not submit: '+error.message,'error');return;}
  const listingUpdate={payment_status:'pending_verification'};
  // is_featured is now set by admin/server after the payment is verified
  await db.from('listings').update(listingUpdate).eq('id',payListingTargetId);
  if(l)l.payment_status='pending_verification';
  closeModal('modal-pay-listing');
  renderListingsTable();
  showToast('Payment submitted — verification in progress ✓','success');
  notifyAdmin('listing_payment_submitted',{listingId:payListingTargetId,listingTitle:l?.title,plan,amount,reference:code,sellerName:currentProfile?.full_name,sellerEmail:currentUser?.email});
}

async function confirmOccupied(){
  if(!occupiedTargetId)return;
  const btn=document.getElementById('btn-confirm-occupied');btn.disabled=true;btn.innerHTML='<span class="spinner-sm"></span> Updating…';
  const{error}=await db.from('listings').update({status:'occupied',occupied_at:new Date().toISOString()}).eq('id',occupiedTargetId);
  btn.disabled=false;btn.textContent='Yes, mark it';
  if(error){showToast('Could not update: '+error.message,'error');return;}
  const l=allListings.find(l=>l.id===occupiedTargetId);
  if(l){l.status='occupied';l.occupied_at=new Date().toISOString();}
  occupiedTargetId=null;closeModal('modal-occupied');renderListingsTable();renderOverview();
  showToast('Listing marked as occupied/sold ✓ — still visible, marked unavailable','success');
}

async function publishScheduledNow(id){
  if(listingActionBusy.has(id))return;
  listingActionBusy.add(id);
  try{
    const{data,error}=await db.from('listings').update({status:'active',publish_at:null})
      .eq('seller_id',effectiveSellerId).eq('id',id).eq('status','scheduled')
      .or('is_disabled.is.null,is_disabled.eq.false')
      .or('recycle_bin.is.null,recycle_bin.eq.false')
      .select('id');
    if(error){showToast('Could not publish: '+error.message,'error');return;}
    if(!data?.length){showToast('This listing is no longer eligible to publish. Refresh and try again.','error');return;}
    const l=allListings.find(l=>l.id===id);
    if(l){l.status='active';l.publish_at=null;}
    renderListingsTable();renderOverview();
    showToast('Listing published now ✓','success');
  } finally {
    listingActionBusy.delete(id);
  }
}
async function cancelScheduledListings(ids){
  const eligible=ids.map(id=>allListings.find(l=>String(l.id)===String(id)))
    .filter(l=>l?.status==='scheduled'&&!l.is_disabled&&!l.recycle_bin);
  if(!eligible.length){showToast('This listing is no longer scheduled or has been disabled. Refresh and try again.','error');return;}
  const listing=eligible[0];
  if(!await lcConfirm({
    title:'Cancel scheduled publishing?',
    message:`<strong>${escHtml(listing.title||'This listing')}</strong> will be returned to pending review. It will not go live until approved again.`,
    confirmLabel:'Cancel schedule'
  }))return;
  const{data,error}=await db.from('listings').update({status:'pending',publish_at:null})
    .eq('seller_id',effectiveSellerId).eq('id',listing.id).eq('status','scheduled')
    .or('is_disabled.is.null,is_disabled.eq.false')
    .or('recycle_bin.is.null,recycle_bin.eq.false')
    .select('id');
  if(error){showToast('Could not cancel scheduled publishing: '+error.message,'error');return;}
  if(!data?.length){showToast('This listing changed elsewhere and was not updated. Refresh and try again.','error');return;}
  listing.status='pending';listing.publish_at=null;
  renderListingsTable();renderOverview();
  showToast('Schedule cancelled; listing returned to pending review.','success');
}
async function reactivateListing(id){
  if(listingActionBusy.has(id))return;
  const l=allListings.find(l=>l.id===id);
  if(l&&l.is_disabled){showToast('Disabled by admin. Contact admin.','error');return;}
  const wasPaused=l&&l.status==='paused';
  const nextStatus=wasPaused?'active':'pending';
  if(!await lcConfirm({title:'Resume listing?',message:wasPaused?`<strong>${escHtml(l?.title||'This listing')}</strong> will go live again immediately.`:`<strong>${escHtml(l?.title||'This listing')}</strong> will be sent back to our team for a quick re-approval first.`,confirmLabel:'Resume'}))return;
  listingActionBusy.add(id);
  try{
    const{error}=await db.from('listings').update({status:nextStatus,occupied_at:null}).eq('id',id);
    if(error){showToast('Could not reactivate: '+error.message,'error');return;}
    if(l){l.status=nextStatus;l.occupied_at=null;}
    renderListingsTable();renderOverview();
    showToast(wasPaused?'Listing is live again ✓':'Listing resubmitted for admin approval ✓','success');
    if(l&&!wasPaused)notifyAdmin('listing_pending',{listingId:id,listingTitle:l.title,sellerName:currentProfile?.full_name||currentUser?.email,sellerEmail:currentUser?.email});
  } finally {
    listingActionBusy.delete(id);
  }
}

/* ══════════════════════════════════════════════════════════
   LISTINGS v4 — state
══════════════════════════════════════════════════════════ */
let bulkSelectMode=false;
let listingPrefsLoaded=false;
let listingDensity='comfortable';
let listingSort='newest';
let listingView='cards';                 /* 'cards' | 'table' */
const LC_PAGE_SIZE=40;                   /* windowed rendering: batch size */
let lcRenderLimit=LC_PAGE_SIZE;
let lcVisibleRows=[];
let lcAttrFilters={priceMin:null,priceMax:null,beds:'',video:false,featured:false,multi:false};
let lcRingAnimated=new Set();            /* health rings already swept once */
let lcCelebrated=new Set();              /* cards already celebrated this session */
let lcFocusIndex=-1;                     /* arrow-key navigation cursor */
let lcCmdSel=0,lcCmdItems=[];
let lcPendingDelete=null;                /* {ids,removed,timer} — soft-delete window */
let lcBestTimeCache;
let lcEventsBound=false;
let lcSwipe=null,lcLongPress=null;
let selectedListingIds=new Set();
let lcStats=new Map();
let lcHealthCache=new Map();
let lcTrendingSet=new Set();
let lcOpenFix=new Set();
let lcOpenAlerts=new Set();
let lcPreviewId=null;
let lcConfirmResolver=null;
let lcUndoTimer=null,lcUndoEl=null;
/* Set to true ONLY if Supabase Image Transformations are enabled on your
   project — otherwise thumbnails would 400. Safe default: off. */
const LC_IMG_TRANSFORM=false;

const LC_FILTERS=[
  {id:'attention',label:'Needs attention',cls:'pill-attention'},
  {id:'all',label:'All'},
  {id:'active',label:'Live'},
  {id:'unpaid',label:'Awaiting payment'},
  {id:'pending',label:'Pending review'},
  {id:'scheduled',label:'Scheduled'},
  {id:'paused',label:'Paused'},
  {id:'occupied',label:'Occupied / sold'},
  {id:'issues',label:'Rejected / disabled'},
];
const LC_SAVED_VIEWS=[
  {id:'view:underperforming',label:'📉 Underperformers'},
  {id:'view:unpaid',label:'💳 Needs payment'},
  {id:'view:nophotos',label:'📷 Missing photos'},
  {id:'view:unanswered',label:'💬 Unanswered buyers'},
  {id:'view:stale',label:'🕸️ Going stale'},
];
const LC_SORTS=[
  {id:'newest',label:'Newest first'},
  {id:'oldest',label:'Oldest first'},
  {id:'attention',label:'Needs attention first'},
  {id:'health',label:'Lowest health first'},
  {id:'health_high',label:'Highest health first'},
  {id:'messages',label:'Most messages'},
  {id:'views',label:'Most viewed'},
  {id:'price_high',label:'Price: high to low'},
  {id:'price_low',label:'Price: low to high'},
];

/* ══════════ Announce + undo ══════════ */
function lcAnnounce(msg){
  const el=document.getElementById('lc-live');
  if(el){el.textContent='';setTimeout(()=>{el.textContent=msg;},40);}
}
function lcHideUndo(){
  if(lcUndoEl){lcUndoEl.classList.remove('show');const el=lcUndoEl;lcUndoEl=null;setTimeout(()=>el.remove(),300);}
  clearTimeout(lcUndoTimer);
}
function showUndoToast(msg,undoFn,ms){
  lcHideUndo();
  const el=document.createElement('div');
  el.className='lc-undo';
  el.innerHTML=`<span>${escHtml(msg)}</span><button type="button">Undo</button>`;
  el.querySelector('button').onclick=async()=>{lcHideUndo();try{await undoFn();}catch(e){showToast('Could not undo: '+(e.message||e),'error');}};
  document.body.appendChild(el);
  lcUndoEl=el;
  requestAnimationFrame(()=>el.classList.add('show'));
  lcUndoTimer=setTimeout(lcHideUndo,ms||6500);
  lcAnnounce(msg);
}

/* ══════════ Confirm modal ══════════ */
function lcConfirm(opts){
  return new Promise(resolve=>{
    lcConfirmResolver=resolve;
    document.getElementById('lc-confirm-title').textContent=opts.title||'Are you sure?';
    document.getElementById('lc-confirm-msg').innerHTML=opts.message||'';
    const ok=document.getElementById('lc-confirm-ok');
    ok.textContent=opts.confirmLabel||'Confirm';
    ok.className='btn '+(opts.danger?'btn-danger btn-lg':'btn-primary');
    const wrap=document.getElementById('lc-confirm-typewrap');
    const input=document.getElementById('lc-confirm-input');
    if(opts.requireText){
      wrap.style.display='block';
      document.getElementById('lc-confirm-word').textContent=opts.requireText;
      input.value='';input.dataset.word=opts.requireText;
      ok.disabled=true;
    }else{
      wrap.style.display='none';input.dataset.word='';ok.disabled=false;
    }
    openModal('modal-lc-confirm');
    setTimeout(()=>{(opts.requireText?input:ok).focus();},80);
  });
}
function lcConfirmCheck(){
  const input=document.getElementById('lc-confirm-input');
  document.getElementById('lc-confirm-ok').disabled=(input.value.trim().toUpperCase()!==String(input.dataset.word||'').toUpperCase());
}
function lcConfirmResolve(val){
  if(!lcConfirmResolver)return;
  const r=lcConfirmResolver;lcConfirmResolver=null;
  closeModal('modal-lc-confirm');
  r(!!val);
}

/* ══════════ Floating menu ══════════ */
function openActionMenu(anchor,items){
  const menu=document.getElementById('lc-menu');
  const backdrop=document.getElementById('lc-menu-backdrop');
  if(!menu)return;
  lcMenuHandlers=[];
  menu.innerHTML=items.map((it,i)=>{
    if(it.divider)return `<div class="lc-menu-divider">${escHtml(it.divider)}</div>`;
    const icon=it.icon?`<svg viewBox="0 0 24 24" aria-hidden="true">${it.icon}</svg>`:'<span style="width:15px;flex-shrink:0"></span>';
    return `<button type="button" role="menuitem" class="lc-menu-item${it.danger?' danger':''}${it.checked?' checked':''}" data-mi="${i}">${icon}<span>${escHtml(it.label)}</span>${it.checked?'<span style="margin-left:auto">✓</span>':''}</button>`;
  }).join('');
  menu.querySelectorAll('[data-mi]').forEach(btn=>{
    const it=items[Number(btn.dataset.mi)];
    btn.onclick=()=>{closeActionMenu();if(it&&typeof it.onclick==='function')setTimeout(it.onclick,10);};
  });
  menu.classList.add('open');
  backdrop.classList.add('open');
  if(window.matchMedia('(min-width:641px)').matches&&anchor){
    const r=anchor.getBoundingClientRect();
    const mw=menu.offsetWidth,mh=menu.offsetHeight,m=10;
    let left=Math.min(r.left,window.innerWidth-mw-m);
    left=Math.max(m,left);
    let top=r.bottom+6;
    if(top+mh>window.innerHeight-m)top=Math.max(m,r.top-mh-6);
    menu.style.left=left+'px';
    menu.style.top=top+'px';
  }else{
    menu.style.left='';menu.style.top='';
  }
  setTimeout(()=>menu.querySelector('.lc-menu-item')?.focus(),50);
}
let lcMenuHandlers=[];
function closeActionMenu(){
  document.getElementById('lc-menu')?.classList.remove('open');
  document.getElementById('lc-menu-backdrop')?.classList.remove('open');
}
function openViewMenu(anchor){
  const items=[{divider:'Sort by'}];
  LC_SORTS.forEach(s=>items.push({label:s.label,checked:listingSort===s.id,onclick:()=>setListingSort(s.id)}));
  items.push({divider:'Layout'});
  items.push({label:'Card view',checked:listingView==='cards',icon:'<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/>',onclick:()=>setListingView('cards')});
  items.push({label:'Table view (desktop)',checked:listingView==='table',icon:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',onclick:()=>setListingView('table')});
  items.push({divider:'Density'});
  items.push({label:'Card view (roomy)',checked:listingDensity==='comfortable',icon:'<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/>',onclick:()=>setListingDensity('comfortable')});
  items.push({label:'Compact list',checked:listingDensity==='compact',icon:'<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>',onclick:()=>setListingDensity('compact')});
  items.push({divider:'Export'});
  items.push({label:'Download all as CSV',icon:'<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',onclick:()=>exportListingsCSV(false)});
  openActionMenu(anchor,items);
}

/* ══════════ Data helpers ══════════ */
function lcThumbUrl(url){
  if(!url)return url;
  if(!LC_IMG_TRANSFORM)return url;
  if(url.indexOf('/storage/v1/object/public/')===-1)return url;
  return url.replace('/storage/v1/object/public/','/storage/v1/render/image/public/')+'?width=200&quality=70';
}
function lcNum(l){const n=l&&l.listing_number;return (n===null||n===undefined||n==='')?'':String(n).padStart(6,'0');}
function lcListingUrl(l){const n=lcNum(l);return n?`${location.origin}/listing?id=${n}`:`${location.origin}/listing?id=${l.id}`;}
function lcPhotoCount(l){return (l.listing_photos||[]).length;}
function lcDaysLive(l){return Math.max(0,Math.floor((Date.now()-new Date(l.created_at))/86400000));}
function lcIsLive(l){return l.status==='active'&&!l.is_disabled&&!l.recycle_bin;}
function lcIsUnpaid(l){return l.status==='approved_unpaid'||l.status==='approved_unpaid_bnb'||l.payment_status==='pending_verification';}
function lcHasIssue(l){return !!l.is_disabled||!!l.recycle_bin||l.status==='rejected'||l.status==='expired';}
function lcHasUnits(l){return !!(l.listing_units&&l.listing_units.length);}

const LC_EMPTY_STAT={msgs:0,unread:0,enquiries:0,unanswered:0,lastBuyerAt:null,spark:null};
function lcS(id){return lcStats.get(String(id))||LC_EMPTY_STAT;}
function lcBuildStats(){
  lcStats=new Map();
  lcBestTimeCache=undefined;
  const dayKeys=[];
  for(let i=13;i>=0;i--)dayKeys.push(new Date(Date.now()-i*86400000).toISOString().slice(0,10));
  allListings.forEach(l=>lcStats.set(String(l.id),{msgs:0,unread:0,enquiries:0,unanswered:0,lastBuyerAt:null,spark:new Array(14).fill(0)}));
  (threads||[]).forEach(t=>{
    const s=lcStats.get(String(t.listing_id));
    if(!s)return;
    s.msgs+=t.messages.length;
    s.unread+=(t.unread_count||0);
    let hasBuyer=false;
    t.messages.forEach(m=>{
      if(m.sender!=='buyer')return;
      hasBuyer=true;
      const ts=new Date(m.created_at).getTime();
      if(!s.lastBuyerAt||ts>s.lastBuyerAt)s.lastBuyerAt=ts;
      const i=dayKeys.indexOf(String(m.created_at).slice(0,10));
      if(i>=0)s.spark[i]++;
    });
    if(hasBuyer)s.enquiries++;
    const last=t.messages[t.messages.length-1];
    if(last&&last.sender==='buyer')s.unanswered++;
  });
}
function lcDaysSinceEnquiry(l){
  const s=lcS(l.id);
  return s.lastBuyerAt?Math.floor((Date.now()-s.lastBuyerAt)/86400000):null;
}
function lcAreaAvgViews(area,excludeId){
  if(!area)return null;
  const peers=allListings.filter(l=>l.area===area&&String(l.id)!==String(excludeId)&&lcIsLive(l));
  if(!peers.length)return null;
  return Math.round(peers.reduce((s,l)=>s+(Number(l.views)||0),0)/peers.length);
}

/* ══════════ Health score ══════════ */
function lcHealth(l){
  const k=String(l.id);
  if(lcHealthCache.has(k))return lcHealthCache.get(k);
  const r=lcComputeHealth(l);
  lcHealthCache.set(k,r);
  return r;
}
function lcComputeHealth(l){
  const issues=[],parts={};
  let score=0;
  const photos=lcPhotoCount(l);
  parts.Photos=(photos>=6?30:photos>=3?19:photos*5);
  score+=parts.Photos;
  if(photos<6)issues.push({icon:'📷',sev:photos<=1?0:2,text:photos?`${photos} photo${photos!==1?'s':''} — listings with 6 or more get noticeably more enquiries`:'No photos yet — buyers scroll straight past listings without photos',cta:'Add photos',act:'edit'});

  const words=(l.description||'').trim().split(/\s+/).filter(Boolean).length;
  parts.Description=(words>=80?25:words>=35?15:(words?6:0));
  score+=parts.Description;
  if(words<80)issues.push({icon:'💬',sev:words<35?1:2,text:words?`Description is ${words} words — 80+ converts noticeably better`:'No description yet — buyers skip listings with no detail',cta:'Rewrite with AI',act:'ai'});

  const am=(l.amenities||[]).length;
  parts.Amenities=(am>=5?15:am>=2?9:0);
  score+=parts.Amenities;
  if(am<5)issues.push({icon:'✨',sev:2,text:am?`Only ${am} amenities listed — buyers filter searches by these`:'No amenities listed — your listing is filtered out of buyer searches',cta:'Add amenities',act:'edit'});

  const s=lcS(l.id),views=Number(l.views)||0,days=lcDaysLive(l);
  if(!lcIsLive(l))parts.Performance=10;
  else if(s.enquiries>0)parts.Performance=20;
  else if(days<7)parts.Performance=14;
  else if(views>=25){parts.Performance=5;issues.push({icon:'💰',sev:1,text:`${views} views but no enquiries — your price may be above the area average`,cta:'Check price',act:'valuation'});}
  else{parts.Performance=7;issues.push({icon:'📉',sev:1,text:`Live ${days} days · ${views} views · no enquiries yet`,cta:'Check price',act:'valuation'});}
  score+=parts.Performance;

  parts.Status=lcIsLive(l)?10:((l.status==='occupied'||l.status==='paused')?7:0);
  score+=parts.Status;

  if(lcIsLive(l)){
    const since=lcDaysSinceEnquiry(l);
    if(since!==null&&since>=lcStaleThresholds(l).quiet)issues.push({icon:'🕸️',sev:1,text:`No enquiries in ${since} days — this listing is going stale`,cta:'Check price',act:'valuation'});
    const avg=lcAreaAvgViews(l.area,l.id);
    if(avg!==null&&avg>=15&&views<avg*0.5)issues.push({icon:'📊',sev:1,text:`Similar listings in ${l.area} average ${avg} views vs your ${views}`,cta:'Check price',act:'valuation'});
    if(photos>=3&&words>=35)issues.push({icon:'🎥',sev:3,optional:true,text:'Optional: a video walkthrough adds trust and cuts wasted viewings',cta:'Add video',act:'video'});
  }
  issues.sort((a,b)=>a.sev-b.sev);
  return{score:Math.max(0,Math.min(100,Math.round(score))),issues,parts};
}
function lcHealthColor(s){return s>=75?'#16a34a':s>=45?'var(--amber)':'var(--red)';}

/* ══════════ Attention + filters ══════════ */
/* Stale thresholds adapt to the listing. A premium-priced sale listing or a
   commercial unit naturally attracts fewer, slower enquiries, so judging it on
   the same 14/21-day clock as a cheap rental produces false "needs attention"
   flags. Thresholds stretch for sale listings, commercial, and anything priced
   well above its own area average. */
function lcStaleThresholds(l){
  let noEnq=14,quiet=21;
  if(l.price_type==='sale'){noEnq=30;quiet=45;}
  if(l.category==='commercial'){noEnq=Math.round(noEnq*1.5);quiet=Math.round(quiet*1.5);}
  const peers=allListings.filter(p=>p.area===l.area&&p.price_type===l.price_type&&Number(p.price)>0);
  if(peers.length>=3&&Number(l.price)>0){
    const avg=peers.reduce((s,p)=>s+Number(p.price),0)/peers.length;
    if(Number(l.price)>avg*1.5){noEnq=Math.round(noEnq*1.6);quiet=Math.round(quiet*1.6);}
  }
  return {noEnq,quiet};
}
function lcNeedsAttention(l){
  if(lcHasIssue(l)||lcIsUnpaid(l))return true;
  const t=getTrialDaysLeft(l);if(t!==null&&t<=3)return true;
  const b=getBnbDaysLeft(l);if(b!==null&&b<=7)return true;
  const s=lcS(l.id);
  if(s.unanswered>0)return true;
  if(lcPhotoCount(l)<=1)return true;
  const th=lcStaleThresholds(l);
  if(lcIsLive(l)&&lcDaysLive(l)>=th.noEnq&&s.enquiries===0)return true;
  const since=lcDaysSinceEnquiry(l);
  if(lcIsLive(l)&&since!==null&&since>=th.quiet)return true;
  return false;
}
function lcMatchesFilter(l,f){
  switch(f){
    case 'all':return true;
    case 'attention':return lcNeedsAttention(l);
    case 'active':return lcIsLive(l);
    case 'unpaid':case 'view:unpaid':return lcIsUnpaid(l);
    case 'pending':return l.status==='pending'&&!l.is_disabled;
    case 'scheduled':return l.status==='scheduled';
    case 'paused':return l.status==='paused'&&!l.is_disabled;
    case 'occupied':return l.status==='occupied'&&!l.is_disabled;
    case 'issues':return lcHasIssue(l);
    case 'view:underperforming':return lcIsLive(l)&&(lcHealth(l).score<55||(lcDaysLive(l)>=10&&lcS(l.id).enquiries===0));
    case 'view:nophotos':return lcPhotoCount(l)<=1;
    case 'view:unanswered':return lcS(l.id).unanswered>0;
    case 'view:stale':{const d=lcDaysSinceEnquiry(l);return lcIsLive(l)&&d!==null&&d>=lcStaleThresholds(l).quiet;}
    default:return true;
  }
}
function lcComputeFilterCounts(){
  const ids=[...LC_FILTERS.map(f=>f.id),...LC_SAVED_VIEWS.map(v=>v.id)];
  const counts={};
  ids.forEach(id=>counts[id]=0);
  allListings.forEach(l=>{ids.forEach(id=>{if(lcMatchesFilter(l,id))counts[id]++;});});
  return counts;
}
function renderFilterPills(counts){
  const wrap=document.getElementById('lc-pill-group');
  if(wrap){
    wrap.innerHTML=LC_FILTERS.map(f=>{
      const n=counts[f.id]||0;
      if(!n&&f.id!=='all'&&f.id!=='attention'&&listingFilter!==f.id)return '';
      const on=listingFilter===f.id;
      return `<button type="button" class="filter-pill ${f.cls||''} ${on?'active':''}" role="tab" aria-selected="${on}" data-filter="${f.id}">${escHtml(f.label)}${n?` <span class="fp-count">${n}</span>`:''}</button>`;
    }).join('');
    const active=wrap.querySelector('.filter-pill.active');
    if(active)active.scrollIntoView({inline:'nearest',block:'nearest'});
  }
  const sv=document.getElementById('lc-saved-views');
  if(sv){
    const html=LC_SAVED_VIEWS.map(v=>{
      const n=counts[v.id]||0;
      if(!n&&listingFilter!==v.id)return '';
      return `<button type="button" class="lc-saved-view ${listingFilter===v.id?'active':''}" data-filter="${v.id}">${escHtml(v.label)} <span style="opacity:.7;font-weight:800">${n}</span></button>`;
    }).join('');
    sv.innerHTML=html||'<span style="font-size:11.5px;color:var(--text-3)">✓ No smart views apply right now — everything looks healthy</span>';
  }
}

/* ══════════ Sorting + trending ══════════ */
function lcSortListings(rows){
  const arr=[...rows];
  const m=listingSort;
  if(m==='oldest')arr.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  else if(m==='messages')arr.sort((a,b)=>lcS(b.id).msgs-lcS(a.id).msgs);
  else if(m==='views')arr.sort((a,b)=>(b.views||0)-(a.views||0));
  else if(m==='price_high')arr.sort((a,b)=>Number(b.price||0)-Number(a.price||0));
  else if(m==='price_low')arr.sort((a,b)=>Number(a.price||0)-Number(b.price||0));
  else if(m==='health')arr.sort((a,b)=>lcHealth(a).score-lcHealth(b).score);
  else if(m==='health_high')arr.sort((a,b)=>lcHealth(b).score-lcHealth(a).score);
  else if(m==='attention')arr.sort((a,b)=>(lcNeedsAttention(b)?1:0)-(lcNeedsAttention(a)?1:0)||new Date(b.created_at)-new Date(a.created_at));
  else arr.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  return arr;
}
function lcComputeTrending(){
  const scored=allListings.filter(lcIsLive).map(l=>{
    const s=lcS(l.id);
    return{id:String(l.id),n:s.msgs*3+(Number(l.views)||0)/8};
  }).filter(x=>x.n>=15).sort((a,b)=>b.n-a.n);
  return new Set(scored.slice(0,2).map(x=>x.id));
}

/* ══════════ Alerts (status + urgency only) ══════════ */
function lcBuildAlerts(l){
  const a=[],d=getListingStatusDisplay(l);
  if(l.status!=='occupied'&&!lcIsUnpaid(l)&&d.banner)a.push({sev:0,html:d.banner});
  if(l.status==='occupied'&&d.banner)a.push({sev:2,html:d.banner});
  if(l.status==='approved_unpaid'&&l.payment_status==='pending_verification')a.push({sev:1,html:'⏳ Payment submitted — verification in progress.'});
  else if(l.status==='approved_unpaid')a.push({sev:0,html:`💳 Approved — pay <strong>KES ${Number(l.payment_due_amount||0).toLocaleString('en-KE')}</strong> to go live. <button type="button" class="lc-alert-link" data-act="pay" data-id="${l.id}">Pay now →</button>`});
  else if(l.status==='approved_unpaid_bnb')a.push({sev:0,html:`📅 Approved — <button type="button" class="lc-alert-link" data-act="pay" data-id="${l.id}">pay for this listing</button> or <a href="/plans">subscribe to a BNB plan</a>`});
  const t=getTrialDaysLeft(l);
  if(t!==null)a.push({sev:t<=2?0:1,html:`🕐 Free trial — ${t} day${t!==1?'s':''} left <button type="button" class="lc-alert-link" data-act="upgrade" data-id="${l.id}">Upgrade</button>`});
  const b=getBnbDaysLeft(l);
  if(b!==null)a.push({sev:b<=3?0:1,html:`📅 BNB plan — ${b} day${b!==1?'s':''} left <a href="/plans">Renew</a>`});
  else if(l.category==='airbnb'&&l.status!=='approved_unpaid_bnb'&&lcIsLive(l))a.push({sev:0,html:`⚠️ No active BNB plan <a href="/plans">Subscribe</a>`});
  if(lcHasUnits(l)){
    const av=muAvailabilitySummary(l);
    a.push({sev:2,html:`🏢 Units${av?' · '+av:''} <button type="button" class="lc-alert-link" data-act="units" data-id="${l.id}">Manage →</button>`});
  }
  const un=lcS(l.id).unanswered;
  if(un>0)a.push({sev:0,html:`💬 ${un} buyer${un!==1?'s are':' is'} waiting on your reply <button type="button" class="lc-alert-link" data-act="messages" data-id="${l.id}">Reply →</button>`});
  a.sort((x,y)=>x.sev-y.sev);
  return a;
}
function lcSevClass(s){return s===0?'sev-danger':s===1?'sev-warn':'sev-info';}

/* ══════════ Prefs ══════════ */
function lcLoadPrefs(){
  if(listingPrefsLoaded)return;
  listingPrefsLoaded=true;
  const valid=new Set([...LC_FILTERS.map(f=>f.id),...LC_SAVED_VIEWS.map(v=>v.id)]);
  let sawFilterPref=false;
  try{
    const f=localStorage.getItem('ny_listing_filter');
    if(f&&valid.has(f)){listingFilter=f;sawFilterPref=true;}
    const s=localStorage.getItem('ny_listing_sort');
    if(s&&LC_SORTS.some(x=>x.id===s))listingSort=s;
    const v=localStorage.getItem('ny_listing_view');
    listingView=(v==='table'||v==='cards')?v:'cards';
    const d=localStorage.getItem('ny_listing_density');
    listingDensity=(d==='compact'||d==='comfortable')?d:(window.matchMedia('(max-width:640px)').matches?'compact':'comfortable');
  }catch(e){
    listingDensity=window.matchMedia('(max-width:640px)').matches?'compact':'comfortable';
  }
  /* First visit: land on "Needs attention" when there's actually something
     there, so the very first thing a seller sees is work they can act on.
     Falls straight back to "All" when nothing needs them. */
  if(!sawFilterPref){
    lcBuildStats();
    listingFilter=allListings.some(lcNeedsAttention)?'attention':'all';
  }
  /* Table view is a desktop affordance — never force it onto a phone. */
  if(listingView==='table'&&window.matchMedia('(max-width:900px)').matches)listingView='cards';
}

/* ══════════ MAIN RENDER ══════════ */
function renderListingsTable(){
  lcLoadPrefs();
  lcBindListEvents();
  lcBuildStats();
  lcHealthCache=new Map();
  lcTrendingSet=lcComputeTrending();
  const counts=lcComputeFilterCounts();
  renderFilterPills(counts);

  const searchEl=document.getElementById('listing-search');
  const q=(searchEl?.value||'').toLowerCase().trim().replace(/^#/,'');
  document.getElementById('lc-search-wrap')?.classList.toggle('has-value',!!q);

  let rows=allListings.filter(l=>{
    if(!lcMatchesFilter(l,listingFilter))return false;
    if(!q)return true;
    const amenityLabels=(l.amenities||[]).map(k=>{const a=AMENITY_KEYS.find(x=>x.key===k);return a?a.label:k;});
    const hay=[l.title,l.area,l.sub_area,l.address,l.description,l.category,getListingStatusDisplay(l).label,String(l.listing_number||''),lcNum(l),...amenityLabels,...(l.listing_units||[]).map(u=>u.unit_label)].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });
  rows=rows.filter(lcMatchesAttrFilters);
  rows=lcSortListings(rows);

  renderListingsStatStrip(counts);
  renderBatchFixBanner();
  lcSyncFilterBtn();

  const wrap=document.getElementById('listings-tbody');
  if(!wrap)return;
  wrap.classList.toggle('select-mode',bulkSelectMode);
  wrap.classList.toggle('density-compact',listingDensity==='compact'&&listingView==='cards');

  const countEl=document.getElementById('lc-results-count');
  if(countEl){
    const att=counts.attention||0;
    countEl.innerHTML=allListings.length
      ? `Showing <strong>${rows.length}</strong> of ${allListings.length} listing${allListings.length!==1?'s':''}${att?` · <span style="color:var(--red);font-weight:700">${att} need${att!==1?'':'s'} attention</span>`:''}`
      : '';
  }

  const moreEl=document.getElementById('lc-loadmore');

  if(!rows.length){
    wrap.innerHTML=lcEmptyState(q);
    if(moreEl)moreEl.innerHTML='';
    updateBulkBar(rows);
    return;
  }

  lcVisibleRows=rows;
  lcFocusIndex=-1;
  if(lcRenderLimit<LC_PAGE_SIZE)lcRenderLimit=LC_PAGE_SIZE;
  const page=rows.slice(0,lcRenderLimit);

  const scrollY=window.scrollY;
  if(listingView==='table'&&!window.matchMedia('(max-width:900px)').matches){
    wrap.innerHTML=lcTableHtml(page);
  }else{
    const showHint=lcShouldShowSwipeHint();
    wrap.innerHTML=page.map((l,i)=>lcCardHtml(l,i===0&&showHint)).join('');
    if(showHint){try{localStorage.setItem('ny_lc_swipe_hint',String(Date.now()));}catch(e){}}
  }
  window.scrollTo(0,scrollY);

  /* Windowing: only the visible slice is ever in the DOM, so a landlord with
     hundreds of units gets the same snappy filter/sort as one with five. */
  const remaining=rows.length-page.length;
  if(moreEl)moreEl.innerHTML=remaining>0
    ? `<div class="lc-loadmore"><button type="button" onclick="lcShowMore()">Show ${Math.min(remaining,LC_PAGE_SIZE)} more · ${remaining} remaining</button></div>`
    : '';

  lcOpenFix.forEach(id=>document.getElementById('lc-fix-'+id)?.classList.add('open'));
  lcOpenAlerts.forEach(id=>{
    const row=document.getElementById('lc-chips-'+id);
    if(row){row.classList.add('expanded');const b=row.querySelector('.lc-alert-more');if(b)b.textContent='Show less';}
  });
  updateBulkBar(rows);
  lcRunCelebrations(page);
}

function lcShowMore(){lcRenderLimit+=LC_PAGE_SIZE;renderListingsTable();}

/* Swipe hint: once per browser, then again after a 60-day gap — mobile users
   genuinely forget gestures they haven't used in two months. */
function lcShouldShowSwipeHint(){
  if(!window.matchMedia('(max-width:900px)').matches)return false;
  let raw=null;
  try{raw=localStorage.getItem('ny_lc_swipe_hint');}catch(e){}
  if(!raw)return true;
  const ts=Number(raw);
  if(!ts)return false;                        /* legacy "1" flag — already seen */
  return (Date.now()-ts)>60*86400000;
}

/* ── Stat strip: top-level context the moment the page loads ── */
function renderListingsStatStrip(counts){
  const el=document.getElementById('lc-stat-strip');
  if(!el)return;
  if(!allListings.length){el.innerHTML='';return;}
  const total=allListings.length;
  const live=allListings.filter(lcIsLive).length;
  const att=counts.attention||0;
  const avg=Math.round(allListings.reduce((s,l)=>s+lcHealth(l).score,0)/total);
  el.innerHTML=`
    <button type="button" class="lc-stat-box" data-filter="all" title="Show all listings"><b>${total}</b><span>Total listings</span></button>
    <button type="button" class="lc-stat-box live" data-filter="active" title="Show live listings"><b>${live}</b><span>Live</span></button>
    <button type="button" class="lc-stat-box ${att?'attn':''}" data-filter="attention" title="Show listings that need attention"><b>${att}</b><span>Needs attention</span></button>
    <div class="lc-stat-box" style="cursor:default" title="Average health score across every listing"><b style="color:${lcHealthColor(avg)}">${avg}</b><span>Portfolio health</span></div>`;
}

/* ── Batch-fix: one banner instead of the same chip repeated N times ── */
function renderBatchFixBanner(){
  const el=document.getElementById('lc-batch-banner');
  if(!el)return;
  let dismissed=[];
  try{dismissed=JSON.parse(sessionStorage.getItem('ny_lc_batch_dismissed')||'[]');}catch(e){}
  const groups=[
    {id:'photos',test:l=>lcPhotoCount(l)<3&&!lcHasIssue(l),
     txt:n=>`${n} listings are short on photos — this is costing you enquiries.`,
     cta:'Fix them together →',view:'view:nophotos'},
    {id:'unanswered',test:l=>lcS(l.id).unanswered>0,
     txt:n=>`${n} listings have buyers waiting on a reply.`,
     cta:'Reply now →',view:'view:unanswered'},
    {id:'unpaid',test:l=>lcIsUnpaid(l),
     txt:n=>`${n} approved listings are waiting on payment before they go live.`,
     cta:'Pay now →',view:'view:unpaid'},
  ];
  for(const g of groups){
    if(dismissed.includes(g.id))continue;
    const hits=allListings.filter(g.test);
    if(hits.length<3)continue;                 /* only worth batching at 3+ */
    if(listingFilter===g.view)continue;        /* already looking at them */
    el.innerHTML=`<div class="lc-batch-banner">
      <span style="font-size:16px">⚡</span>
      <span class="lc-batch-txt">${escHtml(g.txt(hits.length))}</span>
      <button type="button" data-filter="${g.view}">${escHtml(g.cta)}</button>
      <button type="button" class="ghost" onclick="lcDismissBatch('${g.id}')">Not now</button>
    </div>`;
    return;
  }
  el.innerHTML='';
}
function lcDismissBatch(id){
  let d=[];
  try{d=JSON.parse(sessionStorage.getItem('ny_lc_batch_dismissed')||'[]');}catch(e){}
  d.push(id);
  try{sessionStorage.setItem('ny_lc_batch_dismissed',JSON.stringify(d));}catch(e){}
  renderBatchFixBanner();
}

/* ── Celebrate wins: health hits 100, or the very first enquiry lands ── */
function lcRunCelebrations(rows){
  rows.forEach(l=>{
    const id=String(l.id);
    if(lcCelebrated.has(id))return;
    const h=lcHealth(l).score,s=lcS(id);
    const perfect=h>=100,firstEnq=s.enquiries===1&&s.msgs<=2;
    if(!perfect&&!firstEnq)return;
    let seen=[];
    try{seen=JSON.parse(localStorage.getItem('ny_lc_celebrated')||'[]');}catch(e){}
    const key=id+(perfect?':100':':first');
    if(seen.includes(key))return;
    seen.push(key);
    try{localStorage.setItem('ny_lc_celebrated',JSON.stringify(seen.slice(-200)));}catch(e){}
    lcCelebrated.add(id);
    const card=document.querySelector(`.lc-card[data-id="${id}"]`);
    if(card){card.classList.add('lc-celebrate');lcConfetti();}
    showToast(perfect?`🎉 "${l.title}" is fully optimised!`:`🎉 First enquiry on "${l.title}"!`,'success');
    lcAnnounce(perfect?`${l.title} is now fully optimised`:`First enquiry on ${l.title}`);
  });
}
function lcConfetti(){
  if(window.matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  const wrap=document.createElement('div');
  wrap.className='lc-confetti';
  const colors=['#16a34a','#BA7517','#7c3aed','#2563eb','#f97316'];
  let html='';
  for(let i=0;i<26;i++)html+=`<i style="left:${Math.random()*100}%;top:-20px;background:${colors[i%colors.length]};animation-delay:${(Math.random()*.35).toFixed(2)}s"></i>`;
  wrap.innerHTML=html;
  document.body.appendChild(wrap);
  setTimeout(()=>wrap.remove(),2200);
}

function lcEmptyState(q){
  if(!allListings.length)
    return `<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg><h3>No listings yet</h3><p>Post your first property and start receiving enquiries from buyers.</p><a href="/post-listing" class="btn btn-primary">Post your first listing</a></div>`;
  if(q)
    return `<div class="empty-state"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><h3>No matches</h3><p>Nothing matches “${escHtml(q)}”. Try a listing number, an area, or part of the address.</p><button type="button" class="btn btn-outline" onclick="lcClearSearch()">Clear search</button></div>`;
  const copy={
    attention:{h:'All caught up ✓',p:'Nothing needs your attention right now — every listing is paid, live and answered.',cta:'View all listings',f:'all'},
    occupied:{h:'Nothing occupied',p:'Good news — all your units are still open and available to buyers.',cta:'View live listings',f:'active'},
    unpaid:{h:'Nothing awaiting payment',p:"You're fully paid up. Every approved listing is live.",cta:'View live listings',f:'active'},
    'view:unpaid':{h:'Nothing awaiting payment',p:"You're fully paid up.",cta:'View live listings',f:'active'},
    pending:{h:'Nothing pending review',p:'No listings are waiting on our team right now.',cta:'View all listings',f:'all'},
    scheduled:{h:'Nothing scheduled',p:'No listings are queued for a future publish date.',cta:'View all listings',f:'all'},
    paused:{h:'Nothing paused',p:'All your listings are active or already taken.',cta:'View live listings',f:'active'},
    issues:{h:'No problems found',p:'No rejected, expired or disabled listings. Clean sheet.',cta:'View all listings',f:'all'},
    'view:underperforming':{h:'No underperformers 🎉',p:'Every live listing is getting healthy engagement.',cta:'View all listings',f:'all'},
    'view:nophotos':{h:'Every listing has photos ✓',p:'Nice — photo coverage is the single biggest driver of enquiries.',cta:'View all listings',f:'all'},
    'view:unanswered':{h:'Inbox zero 🎉',p:"You've replied to every buyer who messaged you.",cta:'View all listings',f:'all'},
    'view:stale':{h:'Nothing going stale',p:'Every live listing has had recent buyer interest.',cta:'View all listings',f:'all'},
  }[listingFilter]||{h:'Nothing here',p:'No listings match this filter.',cta:'View all listings',f:'all'};
  return `<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg><h3>${copy.h}</h3><p>${copy.p}</p><button type="button" class="btn btn-outline" data-filter="${copy.f}">${copy.cta} →</button></div>`;
}

function lcSpark(spark){
  if(!spark||!spark.some(v=>v))return '';
  const max=Math.max(...spark,1);
  const bars=spark.map((v,i)=>{
    const h=v?Math.max(2,Math.round((v/max)*14)):1;
    return `<rect x="${i*5}" y="${15-h}" width="3" height="${h}" rx="1" fill="${v?'currentColor':'var(--border)'}"/>`;
  }).join('');
  return `<svg class="lc-spark" viewBox="0 0 70 16" width="70" height="16" role="img" aria-label="Buyer messages over the last 14 days">${bars}</svg>`;
}

function lcCardHtml(l,showHint){
  const id=String(l.id);
  const photos=l.listing_photos||[];
  const cover=photos.find(p=>p.is_cover)||photos[0];
  const ph=`<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
  const img=cover
    ? `<img src="${escAttr(lcThumbUrl(cover.url))}" alt="" width="76" height="76" loading="lazy" decoding="async" onerror="this.closest('.lc-thumb').classList.add('no-photo');this.innerHTML='';this.remove()"/>`
    : `<button type="button" class="lc-thumb-cta" data-act="edit" data-id="${String(l.id)}" title="Add photos to this listing" aria-label="Add photos to ${escAttr(l.title)}"><span>＋</span><span>Add photos</span></button>`;

  const s=lcS(id);
  const days=lcDaysLive(l);
  const d=getListingStatusDisplay(l);
  const stCls='st-'+(l.is_disabled?'disabled':(l.status||'pending'));
  const isNew=(Date.now()-new Date(l.created_at).getTime())<48*3600*1000;
  const health=lcHealth(l);
  const circ=2*Math.PI*18;
  const ringOff=circ*(1-health.score/100);
  const animateRing=!lcRingAnimated.has(id);
  if(animateRing)lcRingAnimated.add(id);
  const isTrending=lcTrendingSet.has(id);
  const units=lcHasUnits(l);
  const num=lcNum(l);

  const alerts=lcBuildAlerts(l);
  const alertsHtml=alerts.length?`<div class="lc-chip-row" id="lc-chips-${id}">${
    alerts.map((a,i)=>`<span class="lc-alert-chip ${lcSevClass(a.sev)} ${i>=2?'lc-alert-hidden':''}">${a.html}</span>`).join('')
  }${alerts.length>2?`<button type="button" class="lc-alert-more" data-act="expand" data-id="${id}">+${alerts.length-2} more</button>`:''}</div>`:'';

  const realIssues=health.issues.filter(i=>!i.optional);
  const top=realIssues[0]||health.issues[0];
  const nextHtml=top?`<div class="lc-next ${top.sev===0?'sev-danger':''}"><span>${top.icon}</span><span class="lc-next-txt">Next step: ${escHtml(top.text)}</span><button type="button" data-act="${top.act}" data-id="${id}">${escHtml(top.cta)} →</button></div>`:'';

  const partsHtml=Object.entries(health.parts).map(([k,v])=>`<span class="lc-fix-part">${k} ${v}</span>`).join('');
  const fixHtml=health.issues.length
    ? health.issues.map(i=>`<div class="lc-fix-row"><span>${i.icon}</span><span class="lc-fix-txt">${escHtml(i.text)}</span><button type="button" data-act="${i.act}" data-id="${id}">${escHtml(i.cta)}</button></div>`).join('')
    : `<div class="lc-fix-perfect">✓ This listing is fully optimised — nothing left to improve.</div>`;

  const priceTxt=units?muPriceRangeText(l):`KES ${Number(l.price||0).toLocaleString('en-KE')}${NK_DASH_FREQ_SUFFIX[l.price_frequency||(l.price_type==='rent'?'month':'once')]||''}`;
  const priceSub=units?(muAvailabilitySummary(l)||'across unit types'):(l.price_type==='rent'?'per month':'sale price');
  const viewingFeeText=Number(l.viewing_fee)>0?`Viewing fee: KES ${Number(l.viewing_fee).toLocaleString('en-KE')}`:'Free viewing';

  const liveLine=lcIsLive(l)
    ? `Live ${days} day${days!==1?'s':''} · ${s.enquiries} enquir${s.enquiries!==1?'ies':'y'}${s.unanswered?` · <strong style="color:var(--red)">${s.unanswered} unanswered</strong>`:''}`
    : `Posted ${timeAgo(l.created_at)}`;

  const B=(act,label,icon,cls,keepLabel)=>`<button type="button" class="lc-btn${cls?' '+cls:''}${keepLabel?' lc-keep-label':''}" data-act="${act}" data-id="${id}" title="${escAttr(label)}" aria-label="${escAttr(label+' — '+l.title)}"><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg><span class="lc-btn-label">${escHtml(label)}</span></button>`;

  let btns='';
  btns+=B('preview','Details','<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>');
  const canEdit=(lcIsLive(l)||l.status==='paused'||l.status==='occupied')&&!l.is_disabled;
  btns+=canEdit
    ? B('edit','Edit','<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>')
    : `<button type="button" class="lc-btn lc-btn-locked" disabled title="Editing unlocks once this listing is live or paused" aria-label="Editing locked until this listing is live or paused"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg><span class="lc-btn-label">Edit</span></button>`;
  if(lcIsLive(l))btns+=B('share','Share','<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>');
  if(s.msgs>0)btns+=B('messages',`Messages${s.unread?' ('+s.unread+')':''}`,'<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',s.unread?'lc-btn-purple':'');

  if(l.status==='approved_unpaid'||l.status==='approved_unpaid_bnb')
    btns+=B('pay','Pay now','<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>','lc-btn-primary',true);
  else if(l.status==='scheduled')
    btns+=B('publish','Publish now','<polygon points="5 3 19 12 5 21 5 3"/>','lc-btn-purple',true);
  else if(lcIsLive(l)&&!units)
    btns+=B('occupied',l.price_type==='rent'?'Mark occupied':'Mark sold','<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/>','lc-btn-purple');
  else if((l.status==='occupied'||l.status==='paused')&&!l.is_disabled)
    btns+=B('resume','Resume','<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>','lc-btn-purple',true);
  else if(units)
    btns+=B('units','Manage units','<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/>','lc-btn-purple');

  btns+=`<button type="button" class="lc-btn lc-btn-more" data-act="more" data-id="${id}" title="More actions" aria-label="More actions for ${escAttr(l.title)}" aria-haspopup="menu"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg></button>`;

  return `<div class="lc-swipe" data-id="${id}" role="listitem">
    <div class="lc-swipe-actions" aria-hidden="true">
      <button type="button" class="lc-swipe-pause" data-act="pause" data-id="${id}" tabindex="-1"><svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>Pause</button>
      <button type="button" class="lc-swipe-del" data-act="delete" data-id="${id}" tabindex="-1"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>Delete</button>
    </div>
    ${showHint?'<span class="lc-swipe-hint">← swipe</span>':''}
    <div class="lc-card ${stCls}${l.is_featured?' st-featured':''}${isTrending?' is-trending':''}${selectedListingIds.has(id)?' selected':''}" data-id="${id}" tabindex="0" aria-label="${escAttr(l.title)} — ${escAttr(d.label)}. Open details.">
      <div class="lc-top">
        <div class="lc-select-cb-wrap"><input type="checkbox" class="listing-select-cb" data-id="${id}" ${selectedListingIds.has(id)?'checked':''} aria-label="Select ${escAttr(l.title)}"/></div>
        <div class="lc-thumb ${lcPhotoCount(l)?'':'no-photo'}">
          ${img}
          ${photos.length>1?`<span class="lc-thumb-count">📷 ${photos.length}</span>`:''}
        </div>
        <div class="lc-main">
          <div class="lc-title-row">
            <div class="lc-title-col">
              <div class="lc-title">${escHtml(l.title)}</div>
              <div class="lc-badge-row">
                <span class="status ${d.cls}">${d.label}</span>
                ${l.is_featured?'<span class="lc-featured-badge">⭐ Featured</span>':''}
                ${isTrending?'<span class="lc-trending-badge">🔥 Trending</span>':''}
                ${isNew?'<span class="lc-new-badge">New</span>':''}
                ${lcTrustBadges()}
              </div>
              <div class="lc-meta">${escHtml(l.area||'')}${l.sub_area?' · '+escHtml(l.sub_area):''}${num?' · #'+num:''}</div>
              <div class="lc-meta">${liveLine}</div>
              <div class="lc-meta">${viewingFeeText}</div>
            </div>
            <div class="lc-price-block">
              <span class="lc-price">${priceTxt}</span>
              <span class="lc-price-sub">${escHtml(priceSub)}</span>
            </div>
            <button type="button" class="lc-health" data-act="health" data-id="${id}" title="Health score ${health.score}/100 — blends photos, description, amenities, performance and status. Tap to see exactly what's pulling it down." aria-label="Listing health ${health.score} out of 100, blending photos, description, amenities, performance and status. Tap to see what to fix." aria-expanded="${lcOpenFix.has(id)}">
              <svg viewBox="0 0 42 42" aria-hidden="true"><circle class="lc-ring-bg" cx="21" cy="21" r="18"/><circle class="lc-ring-fill${animateRing?' lc-ring-animate':''}" cx="21" cy="21" r="18" stroke="${lcHealthColor(health.score)}" stroke-dasharray="${circ}" stroke-dashoffset="${ringOff}" style="--lc-ring-circ:${circ};--lc-ring-off:${ringOff}"/></svg>
              <span class="lc-ring-num">${health.score}</span>
            </button>
          </div>
          ${lcStepperHtml(l)}
          ${alertsHtml}
          ${nextHtml}
          ${lcInsightsHtml(l)}
          <div class="lc-fixlist" id="lc-fix-${id}"><h5>Listing health — ${health.score}/100</h5><div class="lc-fix-parts">${partsHtml}</div>${fixHtml}</div>
          <div class="lc-stats-row">
            <span class="lc-stat-chip ${s.unread>0?'has-new':''}"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>${s.msgs} message${s.msgs!==1?'s':''}${s.unread>0?` · ${s.unread} new`:''}</span>
            <span class="lc-dot-sep" aria-hidden="true">·</span>
            <span class="lc-stat-chip"><svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>${(l.views||0).toLocaleString('en-KE')} views</span>
            ${lcSpark(s.spark)}
          </div>
        </div>
      </div>
      <div class="lc-actions-row">${btns}</div>
    </div>
  </div>`;
}

function statusLabel(s){return{active:'Active',pending:'Pending review',paused:'Paused',rejected:'Rejected',expired:'Expired',occupied:'Occupied',scheduled:'Scheduled',approved_unpaid:'Awaiting payment',approved_unpaid_bnb:'Awaiting BNB plan'}[s]||s;}

/* ══════════ v5: TRUST BADGES ══════════ */
function lcTrustBadges(){
  const p=ownerProfile||currentProfile;
  let out='';
  if(p&&p.verification_status==='verified')out+='<span class="lc-verified-badge" title="Your account is KYC-verified — buyers see this on your listings">✓ Verified</span>';
  const sub=subscriptionInfo();
  if(sub.active)out+=`<span class="lc-pro-badge" title="Active ${sub.plan==='elite'?'Elite':'Premium'} plan">${sub.plan==='elite'?'👑 Elite':'⭐ Pro'}</span>`;
  return out;
}

/* ══════════ v5: PROGRESS STEPPER ══════════ */
function lcStepperHtml(l){
  const flow=['Submitted','In review','Approved','Live'];
  let at=-1;
  if(l.status==='pending')at=1;
  else if(l.status==='approved_unpaid'||l.status==='approved_unpaid_bnb'||l.status==='scheduled')at=2;
  if(at<0)return '';
  const note=l.status==='approved_unpaid'?'Pay the listing fee to move to Live.'
    :l.status==='approved_unpaid_bnb'?'Pay for this listing or subscribe to a BNB plan to move to Live.'
    :l.status==='scheduled'?(l.publish_at?`Goes live automatically on ${new Date(l.publish_at).toLocaleDateString('en-KE',{day:'numeric',month:'short'})}.`:'Queued to publish.')
    :'Usually reviewed within 24 hours.';
  const steps=flow.map((label,i)=>{
    const cls=i<at?'done':(i===at?'current':'');
    return `<div class="lc-step ${cls}"><span class="lc-step-dot">${i<at?'✓':''}</span><span class="lc-step-lbl">${label}</span></div>${i<flow.length-1?'<span class="lc-step-line"></span>':''}`;
  }).join('');
  return `<div class="lc-steps" title="${escAttr(note)}" aria-label="Progress: ${escAttr(flow[at])}. ${escAttr(note)}">${steps}</div>`;
}

/* ══════════ v5: INSIGHT PILLS ══════════
   Percentile framing, a predicted time-to-let/sell built from the seller's
   own history, and a best-time-to-share nudge from real enquiry timestamps. */
function lcFindTopPerformer(){
  let best=null,bestScore=-1;
  allListings.forEach(l=>{
    if(!lcIsLive(l))return;
    const s=lcS(l.id);
    const score=s.msgs*3+(Number(l.views)||0)/8;
    if(score>bestScore){bestScore=score;best=l;}
  });
  return best;
}
function lcTopPerformerChip(l){
  const top=lcFindTopPerformer();
  if(!top||String(top.id)===String(l.id))return '';
  if(lcS(l.id).enquiries>0)return '';
  const topPhotos=lcPhotoCount(top), myPhotos=lcPhotoCount(l);
  const topWords=(top.description||'').trim().split(/\s+/).filter(Boolean).length;
  const myWords=(l.description||'').trim().split(/\s+/).filter(Boolean).length;
  const gaps=[];
  if(topPhotos-myPhotos>=3)gaps.push(`${topPhotos-myPhotos} more photos`);
  if(topWords-myWords>=40)gaps.push('a fuller description');
  if(!gaps.length)return '';
  return `<span class="lc-insight info" title="Compared with your top-performing listing">Similar to your top performer but missing ${escHtml(gaps.join(' and '))}</span>`;
}
function lcBoostEligibleChip(l){
  if(l.is_featured)return '';
  const h=lcHealth(l).score;
  if(h<85)return '';
  return `<span class="lc-insight good" title="This listing is fully optimised and primed to convert well">🚀 Primed to convert — <button type="button" onclick="event.stopPropagation();lcAction('boost','${l.id}')" style="margin-left:2px;border:none;background:none;color:inherit;font-weight:800;text-decoration:underline;cursor:pointer;font-size:inherit;padding:0">Feature it →</button></span>`;
}
function lcMarketPriceChip(l){
  return `<span class="lc-insight" id="lc-market-${l.id}"><button type="button" onclick="event.stopPropagation();lcCheckMarketPrice('${l.id}')" style="border:none;background:none;color:inherit;font-weight:700;cursor:pointer;font-size:inherit;padding:0">💰 Check market price →</button></span>`;
}
async function lcCheckMarketPrice(id){
  const l=allListings.find(x=>String(x.id)===String(id));
  if(!l)return;
  const host=document.getElementById('lc-market-'+id);
  if(host)host.textContent='Checking market price…';
  try{
    const{data,error}=await db.from('listings').select('price').eq('status','active').eq('category',l.category).eq('price_type',l.price_type).eq('area',l.area).neq('id',l.id).limit(200);
    if(error)throw error;
    let prices=(data||[]).map(r=>Number(r.price)).filter(p=>p>0);
    if(prices.length<3){
      const{data:data2}=await db.from('listings').select('price').eq('status','active').eq('category',l.category).eq('price_type',l.price_type).neq('id',l.id).limit(200);
      prices=(data2||[]).map(r=>Number(r.price)).filter(p=>p>0);
    }
    if(!prices.length){if(host)host.textContent='Not enough comparable listings yet.';return;}
    prices.sort((a,b)=>a-b);
    const min=prices[0],max=prices[prices.length-1];
    const suffix=l.price_type==='rent'?'/mo':'';
    if(host)host.innerHTML=`Market range: <strong>KES ${min.toLocaleString('en-KE')}${min!==max?'–'+max.toLocaleString('en-KE'):''}${suffix}</strong>`;
  }catch(e){
    if(host)host.textContent='Could not check market price right now.';
  }
}
async function boostSingleListing(id){
  const l=allListings.find(x=>String(x.id)===String(id));
  if(!l)return;
  const unit=Math.round((Number(platformPrices.premium_monthly_price)||1200)*0.6);
  if(!await lcConfirm({title:'Feature this listing?',message:`Featuring "<strong>${escHtml(l.title)}</strong>" costs roughly <strong>KES ${unit.toLocaleString('en-KE')}</strong>.<br><br>This opens a support ticket so our team can confirm the exact price and send payment details. <strong>Nothing is charged yet.</strong>`,confirmLabel:'Request featuring'}))return;
  if(!scwOpen)scwToggle();
  await scwCreateTicket('pricing');
  setTimeout(()=>{
    const input=document.getElementById('scw-input');
    if(input){input.value=`I'd like to feature this listing: ${l.title}${lcNum(l)?' (#'+lcNum(l)+')':''}. Please confirm the cost and how to pay.`;scwSend();}
  },600);
}
function lcInsightsHtml(l){
  if(!lcIsLive(l))return '';
  const out=[];
  const pct=lcViewPercentile(l);
  if(pct!==null){
    const cls=pct>=70?'good':pct<=30?'bad':'';
    const label=pct>=70?`Top ${Math.max(1,100-pct)}% of your listings`:pct<=30?'Below your own average':'Around your own average';
    out.push(`<span class="lc-insight ${cls}" title="Views compared with your other live listings">${label}</span>`);
  }
  const eta=lcPredictedDays(l);
  if(eta!==null)out.push(`<span class="lc-insight info" title="Estimated from how long your similar listings took to be taken">~${eta} days to ${l.price_type==='rent'?'let':'sell'}</span>`);
  const best=lcBestTimeToPost();
  if(best&&lcS(l.id).enquiries===0)out.push(`<span class="lc-insight" title="Derived from when buyers actually message you">Buyers enquire most on ${escHtml(best)} — share it then</span>`);
  const topChip=lcTopPerformerChip(l); if(topChip)out.push(topChip);
  const boostChip=lcBoostEligibleChip(l); if(boostChip)out.push(boostChip);
  out.push(lcMarketPriceChip(l));
  if(!out.length)return '';
  return `<div class="lc-insight-row">${out.join('')}</div>`;
}
function lcViewPercentile(l){
  const peers=allListings.filter(lcIsLive);
  if(peers.length<3)return null;
  const mine=Number(l.views)||0;
  const below=peers.filter(p=>String(p.id)!==String(l.id)&&(Number(p.views)||0)<mine).length;
  return Math.round((below/(peers.length-1))*100);
}
function lcPredictedDays(l){
  const done=allListings.filter(p=>p.status==='occupied'&&p.occupied_at&&p.created_at&&p.price_type===l.price_type);
  if(done.length<2)return null;
  const days=done.map(p=>Math.max(1,Math.round((new Date(p.occupied_at)-new Date(p.created_at))/86400000)));
  const avg=Math.round(days.reduce((a,b)=>a+b,0)/days.length);
  const left=avg-lcDaysLive(l);
  return left>0?left:null;
}
function lcBestTimeToPost(){
  if(lcBestTimeCache!==undefined)return lcBestTimeCache;
  const buckets={};
  (threads||[]).forEach(t=>t.messages.forEach(m=>{
    if(m.sender!=='buyer')return;
    const d=new Date(m.created_at);
    const weekend=d.getDay()===0||d.getDay()===6;
    const h=d.getHours();
    const part=h<12?'mornings':h<17?'afternoons':'evenings';
    buckets[(weekend?'weekend ':'weekday ')+part]=(buckets[(weekend?'weekend ':'weekday ')+part]||0)+1;
  }));
  const entries=Object.entries(buckets).sort((a,b)=>b[1]-a[1]);
  const total=entries.reduce((s,e)=>s+e[1],0);
  lcBestTimeCache=(total>=8&&entries.length)?entries[0][0]:null;
  return lcBestTimeCache;
}

/* ══════════ v5: TABLE / SPREADSHEET VIEW ══════════ */
const LC_TABLE_COLS=[
  {id:'title',label:'Listing',sort:'newest'},
  {id:'status',label:'Status',sort:'attention'},
  {id:'price',label:'Price',sort:'price_high'},
  {id:'beds',label:'Beds',sort:null},
  {id:'photos',label:'Photos',sort:null},
  {id:'views',label:'Views',sort:'views'},
  {id:'msgs',label:'Messages',sort:'messages'},
  {id:'health',label:'Health',sort:'health'},
  {id:'actions',label:'',sort:null},
];
function lcTableHtml(rows){
  const head=LC_TABLE_COLS.map(c=>`<th ${c.sort?`onclick="setListingSort('${c.sort}')" title="Sort by ${escAttr(c.label)}"`:''}>${escHtml(c.label)}${c.sort&&listingSort===c.sort?'<span class="lc-th-arrow">▼</span>':''}</th>`).join('');
  const body=rows.map(l=>{
    const id=String(l.id),s=lcS(id),h=lcHealth(l),d=getListingStatusDisplay(l),units=lcHasUnits(l);
    const canEdit=(lcIsLive(l)||l.status==='paused'||l.status==='occupied')&&!l.is_disabled;
    return `<tr data-id="${id}">
      <td class="lc-td-title">
        ${bulkSelectMode?`<input type="checkbox" class="listing-select-cb" data-id="${id}" ${selectedListingIds.has(id)?'checked':''} style="margin-right:8px;vertical-align:middle"/>`:''}
        ${canEdit
          ? `<input type="text" value="${escAttr(l.title)}" data-inline="title" data-id="${id}" onchange="lcInlineEdit(this)" title="Edit the title right here"/>`
          : `<span data-act="preview" data-id="${id}" style="cursor:pointer">${escHtml(l.title)}</span>`}
        <div style="font-size:11px;color:var(--text-3);font-weight:400">${escHtml(l.area||'')}${lcNum(l)?' · #'+lcNum(l):''}</div>
      </td>
      <td><span class="status ${d.cls}">${d.label}</span></td>
      <td>${units?escHtml(muPriceRangeText(l)):escHtml('KES '+Number(l.price||0).toLocaleString('en-KE'))}<div style="font-size:11px;color:var(--text-3)">${Number(l.viewing_fee)>0?'Viewing fee: KES '+Number(l.viewing_fee).toLocaleString('en-KE'):'Free viewing'}</div></td>
      <td>${units?'—':escHtml(String((l.details&&l.details.bedrooms)??'—'))}</td>
      <td>${lcPhotoCount(l)}</td>
      <td>${(l.views||0).toLocaleString('en-KE')}</td>
      <td>${s.msgs}${s.unread?` <strong style="color:var(--red)">+${s.unread}</strong>`:''}</td>
      <td><strong style="color:${lcHealthColor(h.score)}">${h.score}</strong></td>
      <td><div class="lc-td-actions">
        <button type="button" class="lc-btn" data-act="preview" data-id="${id}" title="Details">ⓘ</button>
        ${canEdit?`<button type="button" class="lc-btn" data-act="edit" data-id="${id}" title="Edit">✏️</button>`:''}
        <button type="button" class="lc-btn" data-act="more" data-id="${id}" title="More actions">⋯</button>
      </div></td>
    </tr>`;
  }).join('');
  return `<div class="lc-table-wrap"><table class="lc-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}
/* Inline edit is limited to the title on purpose — price, location and
   category stay admin-controlled exactly as they are in the edit modal. */
async function lcInlineEdit(input){
  const id=input.dataset.id,field=input.dataset.inline;
  const l=allListings.find(x=>String(x.id)===String(id));
  if(!l||field!=='title')return;
  const prev=l.title||'';
  const val=input.value.trim();
  if(!val){input.value=prev;showToast('Title cannot be empty','error');return;}
  if(val===prev)return;
  input.disabled=true;
  const{error}=await db.from('listings').update({title:val}).eq('id',id);
  input.disabled=false;
  if(error){input.value=prev;showToast('Could not save: '+error.message,'error');return;}
  l.title=val;
  lcHealthCache.delete(String(id));
  renderQuickListings();
  showToast('Title saved ✓','success');
}
function setListingView(v){
  listingView=v;
  try{localStorage.setItem('ny_listing_view',v);}catch(e){}
  closeActionMenu();
  renderListingsTable();
  lcAnnounce(v==='table'?'Table view':'Card view');
}

/* ══════════ v5: ATTRIBUTE FILTERS ══════════ */
function lcMatchesAttrFilters(l){
  const f=lcAttrFilters;
  const units=lcHasUnits(l);
  const price=Number(l.price)||0;
  if(!units){
    if(f.priceMin!==null&&price<f.priceMin)return false;
    if(f.priceMax!==null&&price>f.priceMax)return false;
  }
  if(f.beds!==''){
    const b=Number((l.details&&l.details.bedrooms)??-1);
    if(f.beds==='4'){if(!(b>=4))return false;}
    else if(String(b)!==String(f.beds))return false;
  }
  if(f.video&&!((l.videos||[]).length))return false;
  if(f.featured&&!l.is_featured)return false;
  if(f.multi&&!units)return false;
  return true;
}
function lcActiveAttrCount(){
  const f=lcAttrFilters;
  return [f.priceMin!==null,f.priceMax!==null,f.beds!=='',f.video,f.featured,f.multi].filter(Boolean).length;
}
function lcSyncFilterBtn(){
  const btn=document.getElementById('lc-filters-btn');
  if(!btn)return;
  const n=lcActiveAttrCount();
  btn.innerHTML='⛃ Filters'+(n?` <span class="lc-filters-count">${n}</span>`:'');
  btn.classList.toggle('active',n>0);
}
function toggleMoreTools(btn){
  const group=document.getElementById('lc-more-tools-group');
  if(!group)return;
  const show=group.style.display==='none';
  group.style.display=show?'flex':'none';
  btn.setAttribute('aria-expanded',String(show));
  btn.classList.toggle('active',show);
}
function openAttrFilters(anchor){
  const pop=document.getElementById('lc-filters-pop');
  const backdrop=document.getElementById('lc-menu-backdrop');
  if(!pop)return;
  closeActionMenu();
  document.getElementById('lcf-price-min').value=lcAttrFilters.priceMin??'';
  document.getElementById('lcf-price-max').value=lcAttrFilters.priceMax??'';
  document.getElementById('lcf-beds').value=lcAttrFilters.beds;
  document.getElementById('lcf-video').checked=lcAttrFilters.video;
  document.getElementById('lcf-featured').checked=lcAttrFilters.featured;
  document.getElementById('lcf-multi').checked=lcAttrFilters.multi;
  pop.classList.add('open');
  backdrop.classList.add('open');
  backdrop.onclick=closeAttrFilters;
  if(window.matchMedia('(min-width:641px)').matches&&anchor){
    const r=anchor.getBoundingClientRect(),m=10;
    pop.style.left=Math.max(m,Math.min(r.left,window.innerWidth-pop.offsetWidth-m))+'px';
    let top=r.bottom+6;
    if(top+pop.offsetHeight>window.innerHeight-m)top=Math.max(m,r.top-pop.offsetHeight-6);
    pop.style.top=top+'px';
  }else{pop.style.left='';pop.style.top='';}
}
function closeAttrFilters(){
  document.getElementById('lc-filters-pop')?.classList.remove('open');
  const b=document.getElementById('lc-menu-backdrop');
  if(b){b.classList.remove('open');b.onclick=closeActionMenu;}
}
function applyAttrFilters(){
  const num=v=>v===''?null:(Number(v)||0);
  lcAttrFilters={
    priceMin:num(document.getElementById('lcf-price-min').value),
    priceMax:num(document.getElementById('lcf-price-max').value),
    beds:document.getElementById('lcf-beds').value,
    video:document.getElementById('lcf-video').checked,
    featured:document.getElementById('lcf-featured').checked,
    multi:document.getElementById('lcf-multi').checked,
  };
  closeAttrFilters();
  lcRenderLimit=LC_PAGE_SIZE;
  renderListingsTable();
  lcAnnounce(lcActiveAttrCount()+' attribute filters applied');
}
function clearAttrFilters(){
  lcAttrFilters={priceMin:null,priceMax:null,beds:'',video:false,featured:false,multi:false};
  closeAttrFilters();
  lcRenderLimit=LC_PAGE_SIZE;
  renderListingsTable();
}

/* ══════════ v5: COMMAND PALETTE (⌘K / Ctrl+K) ══════════ */
function openCmdPalette(){
  const ov=document.getElementById('lc-cmd-overlay');
  if(!ov)return;
  ov.classList.add('open');
  const input=document.getElementById('lc-cmd-input');
  input.value='';
  lcCmdRender('');
  setTimeout(()=>input.focus(),40);
}
function closeCmdPalette(){document.getElementById('lc-cmd-overlay')?.classList.remove('open');}
function lcCmdActions(){
  const acts=[
    {label:'New listing',kind:'Action',run:()=>{window.location.href='/post-listing';}},
    {label:'Toggle selection mode',kind:'Action',run:()=>toggleBulkSelectMode()},
    {label:'Switch to card view',kind:'View',run:()=>setListingView('cards')},
    {label:'Switch to table view',kind:'View',run:()=>setListingView('table')},
    {label:'Attribute filters',kind:'View',run:()=>openAttrFilters(document.getElementById('lc-filters-btn'))},
    {label:'Download listings CSV',kind:'Action',run:()=>exportListingsCSV(false)},
  ];
  LC_FILTERS.forEach(f=>acts.push({label:'Filter: '+f.label,kind:'Filter',run:()=>filterListings(f.id)}));
  LC_SAVED_VIEWS.forEach(v=>acts.push({label:'View: '+v.label,kind:'Filter',run:()=>filterListings(v.id)}));
  LC_SORTS.forEach(s=>acts.push({label:'Sort: '+s.label,kind:'Sort',run:()=>setListingSort(s.id)}));
  [['overview','Overview'],['listings','My listings'],['messages','Messages'],['enquiries','Enquiries'],['reviews','Reviews'],['payments','Payments'],['rent-ledger','Rent Ledger'],['demand-heatmap','Demand Insights'],['notifications','Notifications'],['settings','Settings']]
    .forEach(([id,label])=>acts.push({label:'Go to '+label,kind:'Page',run:()=>showPage(id)}));
  allListings.forEach(l=>acts.push({label:l.title+(lcNum(l)?' · #'+lcNum(l):''),kind:'Listing',run:()=>{showPage('listings');setTimeout(()=>openListingPreview(l.id),140);}}));
  return acts;
}
function lcCmdRender(q){
  const all=lcCmdActions();
  const query=(q||'').toLowerCase().trim();
  lcCmdItems=(query?all.filter(a=>a.label.toLowerCase().includes(query)):all).slice(0,40);
  lcCmdSel=0;
  const el=document.getElementById('lc-cmd-results');
  el.innerHTML=lcCmdItems.length
    ? lcCmdItems.map((a,i)=>`<button type="button" class="lc-cmd-item${i===0?' sel':''}" onclick="lcCmdRun(${i})">${escHtml(a.label)}<span class="lc-cmd-kind">${a.kind}</span></button>`).join('')
    : `<div style="padding:18px;text-align:center;color:var(--text-3);font-size:12.5px">No matches</div>`;
}
function lcCmdMove(d){
  if(!lcCmdItems.length)return;
  lcCmdSel=(lcCmdSel+d+lcCmdItems.length)%lcCmdItems.length;
  document.querySelectorAll('#lc-cmd-results .lc-cmd-item').forEach((b,i)=>b.classList.toggle('sel',i===lcCmdSel));
  document.querySelector('#lc-cmd-results .lc-cmd-item.sel')?.scrollIntoView({block:'nearest'});
}
function lcCmdRun(i){
  const item=lcCmdItems[typeof i==='number'?i:lcCmdSel];
  closeCmdPalette();
  if(item)setTimeout(item.run,40);
}
function lcCmdKeydown(e){
  if(e.key==='ArrowDown'){e.preventDefault();lcCmdMove(1);}
  else if(e.key==='ArrowUp'){e.preventDefault();lcCmdMove(-1);}
  else if(e.key==='Enter'){e.preventDefault();lcCmdRun();}
  else if(e.key==='Escape'){e.preventDefault();closeCmdPalette();}
}

/* ══════════ v5: KEYBOARD NAVIGATION + SHORTCUT DISCOVERY ══════════ */
function lcFocusableCards(){return Array.from(document.querySelectorAll('#listings-tbody .lc-card'));}
function lcMoveFocus(d){
  const cards=lcFocusableCards();
  if(!cards.length)return;
  const start=lcFocusIndex<0?(d>0?-1:0):lcFocusIndex;
  lcFocusIndex=Math.max(0,Math.min(cards.length-1,start+d));
  const card=cards[lcFocusIndex];
  card.focus({preventScroll:true});
  card.scrollIntoView({block:'center',behavior:'smooth'});
}
function lcShowShortcuts(){
  openActionMenu(document.getElementById('lc-view-btn'),[
    {divider:'Keyboard shortcuts'},
    {label:'⌘K / Ctrl+K — command palette',onclick:openCmdPalette},
    {label:'/ — focus search',onclick:()=>document.getElementById('listing-search')?.focus()},
    {label:'S — selection mode',onclick:toggleBulkSelectMode},
    {label:'F — attribute filters',onclick:()=>openAttrFilters(document.getElementById('lc-filters-btn'))},
    {label:'↑ ↓ — move between listings',onclick:()=>{}},
    {label:'Enter — open the focused listing',onclick:()=>{}},
    {label:'Esc — close whatever is open',onclick:()=>{}},
  ]);
}

/* ══════════ v5: NOTIFY PAST ENQUIRERS ══════════ */
async function notifyPastEnquirers(listingId){
  const l=allListings.find(x=>String(x.id)===String(listingId));
  if(!l)return;
  const convos=threads.filter(t=>String(t.listing_id)===String(listingId)&&t.messages.some(m=>m.sender==='buyer'));
  if(!convos.length){showToast('Nobody has enquired about this listing yet','error');return;}
  const price=lcHasUnits(l)?muPriceRangeText(l):`KES ${Number(l.price||0).toLocaleString('en-KE')}${l.price_type==='rent'?'/mo':''}`;
  const draft=`Hi — quick update on ${l.title} in ${l.area}. It's currently at ${price} and still available. Let me know if you'd like to arrange a viewing.`;
  if(!await lcConfirm({
    title:`Message ${convos.length} past enquirer${convos.length!==1?'s':''}?`,
    message:`This sends one message into every existing conversation about <strong>${escHtml(l.title)}</strong>:<br><br><em>${escHtml(draft)}</em><br><br>Ideal after a price drop or when a unit comes back on the market.`,
    confirmLabel:`Send to ${convos.length}`
  }))return;
  let sent=0;
  for(const t of convos){
    const{data,error}=await db.from('messages').insert({
      listing_id:t.listing_id,buyer_token:t.buyer_token||null,buyer_name:t.buyer_name,
      buyer_phone:t.buyer_phone||null,sender:'seller',content:draft,
    }).select().single();
    if(!error&&data){allMessages.push(data);sent++;notifyBuyerIfOffline(t.buyer_token,t.listing_title,draft);}
  }
  buildThreads();updateNavBadges();renderListingsTable();
  showToast(`Message sent to ${sent} past enquirer(s) ✓`,'success');
}

/* ══════════ v5: BULK AI REWRITE ══════════ */
async function bulkAiRewriteSelectedListings(){
  if(!eliteActive()){showToast('Bulk AI rewrite is an Elite feature — upgrade to unlock.','error');return;}
  const sel=lcSelected();
  if(!sel.length){showToast('Select the listings you want rewritten first','error');return;}
  if(!await lcConfirm({
    title:`Rewrite ${sel.length} description${sel.length!==1?'s':''}?`,
    message:`AI will draft a fresh title and description for <strong>${sel.length} listing${sel.length!==1?'s':''}</strong> from their existing details.<br><br>This uses ${sel.length} of your monthly AI generations, and you can still edit everything afterwards.`,
    confirmLabel:'Rewrite them'
  }))return;
  let done=0,failed=0;
  showToast('Rewriting… this can take a moment','');
  for(const l of sel){
    try{
      const{data:{session}}=await db.auth.getSession();
      const res=await fetch(`${EDGE_URL}/ai-listing-generate`,{
        method:'POST',
        headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':`Bearer ${session.access_token}`},
        body:JSON.stringify({
          category:l.category,priceType:l.price_type,
          bedrooms:(l.details&&l.details.bedrooms)||null,area:l.area||'',
          notes:(l.description||l.title||'').slice(0,800),
          currentPrice:l.price||null,
        }),
      });
      const body=await res.json();
      if(!res.ok||body.error)throw new Error(body.error||'failed');
      const patch={};
      if(body.title)patch.title=body.title;
      if(body.description)patch.description=body.description;
      if(!Object.keys(patch).length)throw new Error('empty result');
      const{error}=await db.from('listings').update(patch).eq('id',l.id);
      if(error)throw error;
      Object.assign(l,patch);
      lcHealthCache.delete(String(l.id));
      done++;
    }catch(e){failed++;console.error('bulk AI rewrite failed for',l.id,e);}
  }
  selectedListingIds.clear();
  renderListingsTable();renderQuickListings();
  showToast(`${done} listing(s) rewritten${failed?` · ${failed} failed`:''} ✓`,failed?'error':'success');
}
function showAllAlertsForListing(id){lcAction('expand',id);}

/* ══════════ DELEGATED EVENTS ══════════ */
function lcBindListEvents(){
  if(lcEventsBound)return;
  lcEventsBound=true;
  const page=document.getElementById('page-listings');
  const list=document.getElementById('listings-tbody');
  if(!page||!list)return;

  page.addEventListener('click',e=>{
    const f=e.target.closest('[data-filter]');
    if(f&&page.contains(f)){filterListings(f.dataset.filter);return;}
    const cb=e.target.closest('.listing-select-cb');
    if(cb){e.stopPropagation();toggleListingSelected(cb.dataset.id,cb.checked);return;}
    const btn=e.target.closest('[data-act]');
    if(btn&&list.contains(btn)){
      e.preventDefault();e.stopPropagation();
      lcAction(btn.dataset.act,btn.dataset.id,btn);
      return;
    }
    const card=e.target.closest('.lc-card');
    if(card&&list.contains(card)){
      if(e.target.closest('a,button,input,select,textarea'))return;
      const id=card.dataset.id;
      if(bulkSelectMode){
        toggleListingSelected(id,!selectedListingIds.has(String(id)));
        const box=card.querySelector('.listing-select-cb');
        if(box)box.checked=selectedListingIds.has(String(id));
      }else{
        openListingPreview(id);
      }
    }
  });

  page.addEventListener('keydown',e=>{
    const card=e.target.closest('.lc-card');
    if(card&&(e.key==='Enter'||e.key===' ')&&!e.target.closest('button,a,input')){
      e.preventDefault();
      if(bulkSelectMode)toggleListingSelected(card.dataset.id,!selectedListingIds.has(String(card.dataset.id)));
      else openListingPreview(card.dataset.id);
    }
  });

  list.addEventListener('contextmenu',e=>{
    const card=e.target.closest('.lc-card');
    if(!card)return;
    e.preventDefault();
    lcQuickSelect(card.dataset.id);
  });

  list.addEventListener('touchstart',e=>{
    const card=e.target.closest('.lc-card');
    if(!card)return;
    const id=card.dataset.id;
    lcLongPress=setTimeout(()=>{lcQuickSelect(id);if(navigator.vibrate)navigator.vibrate(18);},550);
    const t=e.touches[0];
    lcSwipe={id,card,wrap:card.parentElement,x:t.clientX,y:t.clientY,dx:0,locked:null};
  },{passive:true});

  list.addEventListener('touchmove',e=>{
    if(!lcSwipe)return;
    const t=e.touches[0];
    const dx=t.clientX-lcSwipe.x,dy=t.clientY-lcSwipe.y;
    if(Math.abs(dx)>8||Math.abs(dy)>8)clearTimeout(lcLongPress);
    if(lcSwipe.locked===null){
      if(Math.abs(dx)>10||Math.abs(dy)>10)lcSwipe.locked=Math.abs(dx)>Math.abs(dy)?'x':'y';
    }
    if(lcSwipe.locked!=='x')return;
    lcSwipe.dx=Math.max(-150,Math.min(0,dx));
    lcSwipe.wrap.classList.add('dragging');
    lcSwipe.card.style.transform=`translateX(${lcSwipe.dx}px)`;
  },{passive:true});

  const endSwipe=()=>{
    clearTimeout(lcLongPress);
    if(!lcSwipe)return;
    const{card,wrap,dx}=lcSwipe;
    wrap.classList.remove('dragging');
    const wasOpen=wrap.classList.contains('swipe-open');
    if(wasOpen){
      if(Math.abs(dx)>15){card.style.transform='';wrap.classList.remove('swipe-open');}
      else card.style.transform='translateX(-150px)';
    }else{
      if(dx<-90){
        lcCloseAllSwipes();
        card.style.transform='translateX(-150px)';
        wrap.classList.add('swipe-open');
        if(navigator.vibrate)navigator.vibrate(10);
      }else card.style.transform='';
    }
    lcSwipe=null;
  };
  list.addEventListener('touchend',endSwipe);
  list.addEventListener('touchcancel',endSwipe);

  list.addEventListener('click',e=>{
    const open=list.querySelector('.lc-swipe.swipe-open');
    if(open&&!open.contains(e.target))lcCloseAllSwipes();
  },true);

  document.addEventListener('keydown',e=>{
    /* Command palette is global — it can jump to any page, not just listings. */
    if((e.metaKey||e.ctrlKey)&&(e.key==='k'||e.key==='K')){
      e.preventDefault();
      document.getElementById('lc-cmd-overlay')?.classList.contains('open')?closeCmdPalette():openCmdPalette();
      return;
    }
    if(!document.getElementById('page-listings')?.classList.contains('active'))return;
    const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable;
    if(e.key==='Escape'){
      if(document.getElementById('lc-cmd-overlay')?.classList.contains('open')){closeCmdPalette();return;}
      if(document.getElementById('lc-filters-pop')?.classList.contains('open')){closeAttrFilters();return;}
      if(document.getElementById('lc-menu')?.classList.contains('open')){closeActionMenu();return;}
      if(lcConfirmResolver){lcConfirmResolve(false);return;}
      if(lcPreviewId){closeListingPreview();return;}
      if(bulkSelectMode){exitBulkSelectMode();return;}
      return;
    }
    if(typing)return;
    if(e.key==='/'){e.preventDefault();document.getElementById('listing-search')?.focus();}
    else if(e.key==='s'||e.key==='S'){e.preventDefault();toggleBulkSelectMode();}
    else if(e.key==='f'||e.key==='F'){e.preventDefault();openAttrFilters(document.getElementById('lc-filters-btn'));}
    else if(e.key==='?'){e.preventDefault();lcShowShortcuts();}
    else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();lcMoveFocus(e.key==='ArrowDown'?1:-1);}
    else if(e.key==='Enter'&&lcFocusIndex>=0){
      const card=lcFocusableCards()[lcFocusIndex];
      if(card){e.preventDefault();openListingPreview(card.dataset.id);}
    }
  });

  document.getElementById('modal-lc-confirm')?.addEventListener('click',e=>{
    if(e.target.id==='modal-lc-confirm'&&lcConfirmResolver)lcConfirmResolve(false);
  },true);
  document.getElementById('lc-confirm-input')?.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!document.getElementById('lc-confirm-ok').disabled)lcConfirmResolve(true);
  });
  window.addEventListener('resize',()=>{
    if(document.getElementById('lc-menu')?.classList.contains('open'))closeActionMenu();
    if(document.getElementById('lc-filters-pop')?.classList.contains('open'))closeAttrFilters();
    if(listingView==='table'&&window.matchMedia('(max-width:900px)').matches)setListingView('cards');
  });
  lcInitMiniBar();
  lcInitPullToRefresh();
  lcInitOfflineBanner();
}

/* ── v5: sticky mini toolbar once you've scrolled past the real one ── */
function lcInitMiniBar(){
  const bar=document.getElementById('lc-minibar');
  if(!bar)return;
  const onScroll=()=>{
    const onPage=document.getElementById('page-listings')?.classList.contains('active');
    const toolbar=document.getElementById('listings-filter-bar');
    if(!onPage||!toolbar||!window.matchMedia('(max-width:900px)').matches){bar.classList.remove('show');return;}
    const past=toolbar.getBoundingClientRect().bottom<0;
    bar.classList.toggle('show',past);
    if(past){
      const cnt=bar.querySelector('.lc-mini-count');
      if(cnt)cnt.textContent=(document.getElementById('lc-results-count')?.textContent||'').replace(/\s+/g,' ').trim();
    }
  };
  window.addEventListener('scroll',onScroll,{passive:true});
  onScroll();
}
function lcMiniTop(){window.scrollTo({top:0,behavior:'smooth'});}

/* ── v5: pull-to-refresh on the listings list ── */
function lcInitPullToRefresh(){
  const ptr=document.getElementById('lc-ptr');
  const page=document.getElementById('page-listings');
  if(!ptr||!page)return;
  let startY=0,pulling=false;
  page.addEventListener('touchstart',e=>{
    if(window.scrollY>0||document.querySelector('.lc-swipe.swipe-open'))return;
    startY=e.touches[0].clientY;pulling=true;
  },{passive:true});
  page.addEventListener('touchmove',e=>{
    if(!pulling)return;
    const dist=e.touches[0].clientY-startY;
    if(dist<=0){ptr.style.height='0px';ptr.classList.remove('armed');return;}
    const h=Math.min(70,dist*0.5);
    ptr.style.height=h+'px';
    ptr.classList.toggle('armed',h>=50);
    ptr.textContent=h>=50?'↻ Release to refresh':'↓ Pull to refresh';
  },{passive:true});
  page.addEventListener('touchend',async()=>{
    if(!pulling)return;
    const armed=ptr.classList.contains('armed');
    pulling=false;
    ptr.classList.remove('armed');
    if(!armed){ptr.style.height='0px';return;}
    ptr.textContent='Refreshing…';
    try{
      await loadAllData();
      lcHealthCache=new Map();
      renderListingsTable();renderOverview();
      showToast('Listings refreshed ✓','success');
    }catch(err){showToast('Could not refresh — check your connection','error');}
    ptr.style.height='0px';
    ptr.textContent='↓ Pull to refresh';
  });
}

/* ── v5: persistent offline banner instead of silent failures ── */
function lcInitOfflineBanner(){
  const el=document.getElementById('lc-offline');
  if(!el)return;
  window.addEventListener('offline',()=>el.classList.add('show'));
  window.addEventListener('online',()=>{el.classList.remove('show');showToast('Back online ✓','success');});
  if(!navigator.onLine)el.classList.add('show');
}
function lcCloseAllSwipes(){
  document.querySelectorAll('.lc-swipe.swipe-open').forEach(w=>{
    const c=w.querySelector('.lc-card');
    if(c)c.style.transform='';
    w.classList.remove('swipe-open');
  });
}
function lcQuickSelect(id){
  if(!bulkSelectMode)toggleBulkSelectMode();
  selectedListingIds.add(String(id));
  renderListingsTable();
  lcAnnounce('Selection mode on. 1 listing selected.');
}

function lcAction(act,id,el){
  const l=allListings.find(x=>String(x.id)===String(id));
  switch(act){
    case 'preview':openListingPreview(id);break;
    case 'view':if(l)window.open(lcListingUrl(l),'_blank','noopener');break;
    case 'edit':openEditModal(id);setTimeout(()=>document.getElementById('edit-photos-grid')?.scrollIntoView({behavior:'smooth',block:'center'}),300);break;
    case 'share':openShareMenu(id,el);break;
    case 'more':openMoreActionsMenu(id,el);break;
    case 'pay':openPayListingModal(id);break;
    case 'publish':publishScheduledNow(id);break;
    case 'occupied':if(l)openOccupiedModal(id,l.title);break;
    case 'resume':reactivateListing(id);break;
    case 'units':openManageUnitsModal(id);break;
    case 'video':openManageVideosModal(id);break;
    case 'messages':openMessagesForListing(l?l.id:id);break;
    case 'pause':lcCloseAllSwipes();togglePause(id,l?l.status:'active');break;
    case 'delete':lcCloseAllSwipes();if(l)openDeleteModal(id,l.title);break;
    case 'duplicate':duplicateListing(id);break;
    case 'ai':openAiListingForListing(id);break;
    case 'valuation':openValuationForListing(id);break;
    case 'boost':boostSingleListing(id);break;
    case 'upgrade':if(l)requestTrialUpgrade(l.title);break;
    case 'price':requestPriceChange(id);break;
    case 'qr':downloadListingQR(id);break;
    case 'copylink':copyListingLink(id);break;
    case 'contact':toggleListingContactHidden(id);break;
    case 'brochure':generateBrochure(id);break;
    case 'expand':{
      const row=document.getElementById('lc-chips-'+id);
      if(row){
        const on=row.classList.toggle('expanded');
        if(on)lcOpenAlerts.add(String(id));else lcOpenAlerts.delete(String(id));
        const b=row.querySelector('.lc-alert-more');
        if(b)b.textContent=on?'Show less':`+${row.querySelectorAll('.lc-alert-hidden').length} more`;
      }
      break;
    }
    case 'health':{
      const box=document.getElementById('lc-fix-'+id);
      if(box){
        const on=box.classList.toggle('open');
        if(on)lcOpenFix.add(String(id));else lcOpenFix.delete(String(id));
        el?.setAttribute('aria-expanded',String(on));
      }
      break;
    }
  }
}

function lcFlashCard(id){
  const card=document.querySelector(`.lc-card[data-id="${id}"]`);
  if(!card)return;
  card.classList.remove('lc-flash');void card.offsetWidth;card.classList.add('lc-flash');
  card.scrollIntoView({behavior:'smooth',block:'center'});
}
function lcAnimateOut(ids,done){
  let any=false;
  ids.forEach(id=>{
    const w=document.querySelector(`.lc-swipe[data-id="${id}"]`);
    if(w){any=true;w.classList.add('lc-removing');}
  });
  setTimeout(done,any?400:0);
}

/* ══════════ Preview sheet ══════════ */
function openListingPreview(id){
  const l=allListings.find(x=>String(x.id)===String(id));
  if(!l)return;
  lcPreviewId=String(id);
  editPhotosListingId=l.id;
  const s=lcS(id),h=lcHealth(l),units=lcHasUnits(l),num=lcNum(l);
  const d=getListingStatusDisplay(l);
  document.getElementById('lc-sheet-title').textContent=l.title;

  const photos=l.listing_photos||[];
  const photosHtml=photos.length
    ? `<div class="lc-sheet-photos">${photos.map(p=>`<div class="lc-sheet-photo ${p.is_cover?'is-cover':''}" onclick="lcSetCover('${l.id}','${p.id}')" title="${p.is_cover?'Cover photo':'Tap to make this the cover photo'}"><img src="${escAttr(lcThumbUrl(p.url))}" alt="" loading="lazy"/>${p.is_cover?'<span>COVER</span>':''}</div>`).join('')}</div>`
    : `<div style="background:var(--red-light);color:var(--red);border-radius:10px;padding:12px 14px;font-size:12.5px;font-weight:600;margin-bottom:16px">📷 No photos yet — this is the single biggest cause of zero enquiries.</div>`;

  const priceTxt=units?muPriceRangeText(l):`KES ${Number(l.price||0).toLocaleString('en-KE')}${NK_DASH_FREQ_SUFFIX[l.price_frequency||(l.price_type==='rent'?'month':'once')]||''}`;
  const ed=l.details||{};
  const specs=[];
  if(!units){
    if(ed.bedrooms!==undefined&&ed.bedrooms!==null&&ed.bedrooms!=='')specs.push(`${ed.bedrooms==0?'Studio':ed.bedrooms+' bed'}`);
    if(ed.bathrooms)specs.push(ed.bathrooms+' bath');
    if(ed.size_sqm)specs.push(ed.size_sqm+' m²');
  }
  if(l.category)specs.push(l.category);
  if(ed.furnished==='yes')specs.push('Furnished');

  document.getElementById('lc-sheet-body').innerHTML=`
    ${photosHtml}
    <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:6px">
      <span style="font-size:22px;font-weight:800;color:var(--green-dark)">${priceTxt}</span>
      <span class="status ${d.cls}">${d.label}</span>
    </div>
    <div style="font-size:12.5px;color:var(--text-3);margin-bottom:14px">${escHtml(l.area||'')}${l.sub_area?' · '+escHtml(l.sub_area):''}${l.address?' · '+escHtml(l.address):''}${num?' · #'+num:''}</div>
    ${specs.length?`<div style="font-size:12.5px;color:var(--text-2);margin-bottom:16px">${specs.map(escHtml).join(' · ')}</div>`:''}
    <div class="lc-sheet-grid">
      <div class="lc-sheet-stat"><b>${(l.views||0).toLocaleString('en-KE')}</b><span>Views</span></div>
      <div class="lc-sheet-stat"><b>${s.enquiries}</b><span>Enquiries</span></div>
      <div class="lc-sheet-stat"><b>${s.msgs}</b><span>Messages</span></div>
      <div class="lc-sheet-stat"><b style="color:${lcHealthColor(h.score)}">${h.score}</b><span>Health</span></div>
    </div>
    ${s.unanswered?`<div class="lc-next sev-danger" style="margin-top:0"><span>💬</span><span class="lc-next-txt">${s.unanswered} buyer${s.unanswered!==1?'s are':' is'} waiting on your reply</span><button type="button" onclick="closeListingPreview();openMessagesForListing('${l.id}')">Reply →</button></div>`:''}
    <div class="lc-sheet-sec">What to improve</div>
    ${h.issues.length?h.issues.map(i=>`<div class="lc-fix-row"><span>${i.icon}</span><span class="lc-fix-txt">${escHtml(i.text)}</span><button type="button" onclick="closeListingPreview();lcAction('${i.act}','${l.id}')">${escHtml(i.cta)}</button></div>`).join(''):'<div class="lc-fix-perfect">✓ Fully optimised — nothing left to improve.</div>'}
    ${l.description?`<div class="lc-sheet-sec">Description</div><div class="lc-sheet-desc">${escHtml(l.description)}</div>`:''}
    ${(l.amenities||[]).length?`<div class="lc-sheet-sec">Amenities</div><div style="display:flex;flex-wrap:wrap;gap:6px">${(l.amenities||[]).map(k=>{const a=AMENITY_KEYS.find(x=>x.key===k);return `<span class="lc-fix-part">${escHtml(a?a.label:k)}</span>`;}).join('')}</div>`:''}
  `;

  const canEdit=(lcIsLive(l)||l.status==='paused'||l.status==='occupied')&&!l.is_disabled;
  document.getElementById('lc-sheet-foot').innerHTML=`
    ${canEdit?`<button type="button" class="btn btn-primary" style="flex:1;justify-content:center" onclick="closeListingPreview();openEditModal('${l.id}')">Edit listing</button>`:''}
    <button type="button" class="btn btn-outline" onclick="window.open('${escAttr(lcListingUrl(l))}','_blank','noopener')">View live ↗</button>
    <button type="button" class="btn btn-outline" onclick="copyListingLink('${l.id}')">Share</button>
    <button type="button" class="btn btn-outline" onclick="lcSheetMore('${l.id}',this)">More ⋯</button>
  `;

  document.getElementById('lc-sheet-overlay').classList.add('open');
  document.getElementById('lc-sheet').classList.add('open');
  document.body.style.overflow='hidden';
  scwSyncOverlayVisibility();
}
function lcSheetMore(id,el){
  const keep=lcPreviewId;
  openMoreActionsMenu(id,el,()=>{if(keep===lcPreviewId)closeListingPreview();});
}
function closeListingPreview(){
  lcPreviewId=null;
  document.getElementById('lc-sheet-overlay')?.classList.remove('open');
  document.getElementById('lc-sheet')?.classList.remove('open');
  if(!document.querySelector('.modal-overlay.open'))document.body.style.overflow='';
  scwSyncOverlayVisibility();
}
async function lcSetCover(listingId,photoId){
  editPhotosListingId=listingId;
  await setEditCoverPhoto(photoId);
  openListingPreview(listingId);
}
function openAiListingForListing(id){
  const l=allListings.find(x=>String(x.id)===String(id));
  openAiListingModal();
  if(!l)return;
  setTimeout(()=>{
    const sel=document.getElementById('ai-listing-select');if(sel)sel.value=l.id;
    const cat=document.getElementById('ai-listing-category');if(cat&&l.category)cat.value=l.category;
    const pt=document.getElementById('ai-listing-price-type');if(pt&&l.price_type)pt.value=l.price_type;
    const bd=document.getElementById('ai-listing-bedrooms');if(bd)bd.value=(l.details&&l.details.bedrooms)||'';
    const ar=document.getElementById('ai-listing-area');if(ar)ar.value=l.area||'';
    const pr=document.getElementById('ai-listing-price');if(pr)pr.value=l.price||'';
  },120);
}
function openValuationForListing(id){
  const l=allListings.find(x=>String(x.id)===String(id));
  openValuationModal();
  if(!l)return;
  setTimeout(()=>{
    const county=NK_AREA_TO_COUNTY[l.area];
    const c=document.getElementById('val-county');
    if(c&&county){c.value=county;valPopulateAreas();}
    const a=document.getElementById('val-area');if(a&&l.area)a.value=l.area;
    const cat=document.getElementById('val-category');if(cat&&l.category)cat.value=l.category;
    const pt=document.getElementById('val-price-type');if(pt&&l.price_type)pt.value=l.price_type;
    const bd=document.getElementById('val-bedrooms');if(bd)bd.value=(l.details&&l.details.bedrooms)||'';
  },140);
}

/* ══════════ Per-listing actions ══════════ */
function lcShareText(l){
  const price=lcHasUnits(l)?muPriceRangeText(l):`KES ${Number(l.price||0).toLocaleString('en-KE')}${l.price_type==='rent'?'/mo':''}`;
  return `${l.title} — ${price} in ${l.area}\n${lcListingUrl(l)}`;
}
function copyListingLink(id){
  const l=allListings.find(x=>String(x.id)===String(id));if(!l)return;
  const url=lcListingUrl(l);
  if(navigator.share&&/Mobi|Android/i.test(navigator.userAgent)){
    navigator.share({title:l.title,text:lcShareText(l),url}).catch(()=>{});
    return;
  }
  navigator.clipboard.writeText(url).then(()=>showToast('Link copied ✓','success')).catch(()=>showToast(url,''));
}
function shareListing(id){
  const l=allListings.find(x=>String(x.id)===String(id));if(!l)return;
  window.open(`https://wa.me/?text=${encodeURIComponent(lcShareText(l))}`,'_blank','noopener');
}
function shareListingToFacebook(id){
  const l=allListings.find(x=>String(x.id)===String(id));if(!l)return;
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(lcListingUrl(l))}`,'_blank','noopener,noreferrer,width=600,height=600');
}
function shareListingToInstagram(id){
  const l=allListings.find(x=>String(x.id)===String(id));if(!l)return;
  const caption=lcShareText(l);
  navigator.clipboard.writeText(caption)
    .then(()=>showToast('Caption + link copied — paste it into your Instagram post or story','success'))
    .catch(()=>showToast('Could not copy the caption automatically','error'));
  setTimeout(()=>window.open('https://www.instagram.com/','_blank','noopener,noreferrer'),400);
}
function shareListingToTiktok(id){
  const l=allListings.find(x=>String(x.id)===String(id));if(!l)return;
  const caption=lcShareText(l);
  navigator.clipboard.writeText(caption)
    .then(()=>showToast('Caption + link copied — paste it into your TikTok post','success'))
    .catch(()=>showToast('Could not copy the caption automatically','error'));
  setTimeout(()=>window.open('https://www.tiktok.com/upload','_blank','noopener,noreferrer'),400);
}
async function downloadListingQR(id){
  const l=allListings.find(x=>String(x.id)===String(id));if(!l)return;
  try{
    const dataUrl=await urlToDataURL(`https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(lcListingUrl(l))}`);
    const a=document.createElement('a');
    a.href=dataUrl;a.download=`${(l.title||'listing').replace(/[^a-z0-9]+/gi,'-')}-qr.png`;
    document.body.appendChild(a);a.click();a.remove();
    showToast('QR code downloaded ✓','success');
  }catch(e){showToast('Could not generate the QR code','error');}
}
async function requestPriceChange(id){
  const l=allListings.find(x=>String(x.id)===String(id));if(!l)return;
  if(!scwOpen)scwToggle();
  await scwCreateTicket('pricing');
  setTimeout(()=>{
    const input=document.getElementById('scw-input');
    if(input){input.value=`Hi, I'd like to change the price on "${l.title}"${lcNum(l)?' (#'+lcNum(l)+')':''}. The current price is KES ${Number(l.price||0).toLocaleString('en-KE')}.`;scwSend();}
  },600);
}
async function toggleListingContactHidden(id){
  if(listingActionBusy.has(id))return;
  listingActionBusy.add(id);
  try{
    const l=allListings.find(x=>String(x.id)===String(id));if(!l)return;
    const next=!l.contact_hidden;
    const{error}=await db.from('listings').update({contact_hidden:next}).eq('id',id);
    if(error){showToast('Could not update: '+error.message,'error');return;}
    l.contact_hidden=next;
    renderListingsTable();
    showToast(next?'Buyer contact hidden on this listing — chat only ✓':'Call/WhatsApp re-enabled on this listing ✓','success');
  }finally{listingActionBusy.delete(id);}
}
async function togglePause(id,cs){
  if(listingActionBusy.has(id))return;
  const l=allListings.find(x=>String(x.id)===String(id));
  if(l&&l.is_disabled){showToast('This listing was disabled by an admin — contact support.','error');return;}
  if(cs!=='active'){showToast('Only live listings can be paused.','error');return;}
  listingActionBusy.add(id);
  try{
    const{error}=await db.from('listings').update({status:'paused'}).eq('id',id);
    if(error){showToast('Could not pause: '+error.message,'error');return;}
    if(l)l.status='paused';
    renderListingsTable();renderOverview();
    showUndoToast(`“${l?l.title:'Listing'}” paused — hidden from buyers`,async()=>{
      const{error:e2}=await db.from('listings').update({status:'active'}).eq('id',id);
      if(e2){showToast('Could not undo: '+e2.message,'error');return;}
      if(l)l.status='active';
      renderListingsTable();renderOverview();
      showToast('Restored — listing is live again ✓','success');
    });
  }finally{listingActionBusy.delete(id);}
}
async function renewListing(id){
  const{error}=await db.from('listings').update({status:'pending'}).eq('id',id);
  if(error){showToast('Could not renew: '+error.message,'error');return;}
  const l=allListings.find(x=>String(x.id)===String(id));
  if(l)l.status='pending';
  renderListingsTable();renderOverview();
  showToast('Resubmitted for approval','success');
  if(l)notifyAdmin('listing_pending',{listingId:id,listingTitle:l.title,sellerName:currentProfile?.full_name||currentUser?.email,sellerEmail:currentUser?.email});
}

const LC_DUP_FIELDS=['title','description','price','price_min','price_max','price_type','price_frequency','category','county','area','sub_area','address','amenities','details','contact_hidden','bedrooms','bathrooms','size_sqm','is_multi_unit'];
async function duplicateListing(id,silent){
  const l=allListings.find(x=>String(x.id)===String(id));if(!l)return null;
  const payload={seller_id:effectiveSellerId,status:'pending',payment_status:null,views:0,is_featured:false};
  LC_DUP_FIELDS.forEach(k=>{if(l[k]!==undefined&&l[k]!==null)payload[k]=l[k];});
  payload.title=(l.title||'Listing')+' (copy)';
  const{data,error}=await db.from('listings').insert(payload).select('*, listing_photos(*), listing_units(*)').single();
  if(error){if(!silent)showToast('Could not duplicate: '+error.message,'error');return null;}
  const photos=(l.listing_photos||[]).map(p=>({listing_id:data.id,url:p.url,is_cover:p.is_cover}));
  if(photos.length){const{data:ph}=await db.from('listing_photos').insert(photos).select();data.listing_photos=ph||[];}
  const units=(l.listing_units||[]).map(u=>({listing_id:data.id,unit_label:u.unit_label,price:u.price,quantity_available:u.quantity_total??u.quantity_available,quantity_total:u.quantity_total??u.quantity_available}));
  if(units.length){const{data:un}=await db.from('listing_units').insert(units).select();data.listing_units=un||[];}
  allListings.unshift(data);
  if(!silent){
    renderListingsTable();renderOverview();
    showToast('Copy created — opening it so you can edit it now ✓','success');
    setTimeout(()=>lcFlashCard(data.id),120);
    /* "Duplicate & edit now" — open the copy straight away instead of leaving
       the seller to hunt for it somewhere down the list. */
    setTimeout(()=>openEditModal(data.id),420);
  }
  return data;
}

/* ══════════ Menus ══════════ */
function openShareMenu(listingId,anchorEl){
  const items=[
    {divider:'Share this listing'},
    {label:'Copy link / share sheet',icon:'<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>',onclick:()=>copyListingLink(listingId)},
    {label:'WhatsApp',icon:'<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',onclick:()=>shareListing(listingId)},
    {label:'Facebook',icon:'<path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>',onclick:()=>shareListingToFacebook(listingId)},
    {label:'Instagram (copies caption)',icon:'<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>',onclick:()=>shareListingToInstagram(listingId)},
    {label:'TikTok (copies caption)',icon:'<path d="M9 12a4 4 0 104 4V4c1 2 3 3 5 3"/>',onclick:()=>shareListingToTiktok(listingId)},
    {divider:'Offline'},
    {label:'Download QR code',icon:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM18 18h3v3h-3z"/>',onclick:()=>downloadListingQR(listingId)},
  ];
  if(subscriptionInfo().active)items.push({label:'Printable brochure (PDF)',icon:'<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>',onclick:()=>generateBrochure(listingId)});
  openActionMenu(anchorEl,items);
}

function openMoreActionsMenu(listingId,anchorEl,after){
  const l=allListings.find(x=>String(x.id)===String(listingId));
  if(!l)return;
  const wrap=fn=>()=>{if(typeof after==='function')after();fn();};
  const items=[];
  const isLive=lcIsLive(l),isOcc=l.status==='occupied'&&!l.is_disabled,isPaused=l.status==='paused'&&!l.is_disabled;

  items.push({divider:'View'});
  items.push({label:'Open details',icon:'<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',onclick:wrap(()=>openListingPreview(listingId))});
  items.push({label:'Open live listing ↗',icon:'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',onclick:wrap(()=>window.open(lcListingUrl(l),'_blank','noopener'))});

  items.push({divider:'Improve'});
  items.push({label:'Rewrite with AI',icon:'<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>',onclick:wrap(()=>openAiListingForListing(listingId))});
  items.push({label:'Check price vs. the market',icon:'<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',onclick:wrap(()=>openValuationForListing(listingId))});
  items.push({label:'Video walkthrough',icon:'<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>',onclick:wrap(()=>openManageVideosModal(listingId))});

  items.push({divider:'Manage'});
  items.push({label:'Duplicate this listing',icon:'<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>',onclick:wrap(()=>duplicateListing(listingId))});
  items.push({label:'Manage unit types',icon:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/>',onclick:wrap(()=>openManageUnitsModal(listingId))});
  items.push({label:'Request a price change',icon:'<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>',onclick:wrap(()=>requestPriceChange(listingId))});
  items.push({label:'Notify past enquirers',icon:'<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>',onclick:wrap(()=>notifyPastEnquirers(listingId))});
  if(subscriptionInfo().active)items.push({label:'Download printable brochure',icon:'<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>',onclick:wrap(()=>generateBrochure(listingId))});
  if(!(ownerProfile||currentProfile)?.hide_buyer_contact)
    items.push({label:l.contact_hidden?'Show Call/WhatsApp again':'Hide Call/WhatsApp (chat only)',icon:'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',onclick:wrap(()=>toggleListingContactHidden(listingId))});

  if(isLive||isOcc||isPaused){
    items.push({divider:'Status'});
    if(isLive)items.push({label:'Pause listing',icon:'<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',onclick:wrap(()=>togglePause(listingId,l.status))});
    if(isOcc||isPaused)items.push({label:'Resume (resubmits for approval)',icon:'<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>',onclick:wrap(()=>reactivateListing(listingId))});
  }
  if(l.status==='scheduled'){
    items.push({divider:'Scheduled publishing'});
    items.push({label:'Publish now',icon:'<polygon points="5 3 19 12 5 21 5 3"/>',onclick:wrap(()=>publishScheduledNow(listingId))});
    items.push({label:'Cancel schedule and resubmit for review',icon:'<path d="M18 6L6 18M6 6l12 12"/>',onclick:wrap(()=>cancelScheduledListings([listingId]))});
  }

  items.push({divider:'Danger zone'});
  items.push({label:'Delete listing permanently',icon:'<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>',danger:true,onclick:wrap(()=>openDeleteModal(listingId,l.title))});

  openActionMenu(anchorEl,items);
}

/* ══════════ Bulk ══════════ */
function toggleBulkSelectMode(){
  bulkSelectMode=!bulkSelectMode;
  if(!bulkSelectMode)selectedListingIds.clear();
  document.getElementById('lc-select-toggle-btn')?.classList.toggle('active',bulkSelectMode);
  document.getElementById('lc-select-toggle-btn')?.setAttribute('aria-pressed',String(bulkSelectMode));
  lcCloseAllSwipes();
  renderListingsTable();
  lcAnnounce(bulkSelectMode?'Selection mode on':'Selection mode off');
}
function exitBulkSelectMode(){if(bulkSelectMode)toggleBulkSelectMode();}
function toggleListingSelected(id,checked){
  const k=String(id);
  if(checked)selectedListingIds.add(k);else selectedListingIds.delete(k);
  document.querySelector(`.lc-card[data-id="${k}"]`)?.classList.toggle('selected',checked);
  updateBulkBar();
}
function toggleSelectAllListings(checked){
  selectedListingIds.clear();
  if(checked)document.querySelectorAll('.listing-select-cb').forEach(cb=>selectedListingIds.add(String(cb.dataset.id)));
  renderListingsTable();
  lcAnnounce(`${selectedListingIds.size} listing${selectedListingIds.size!==1?'s':''} selected`);
}
function updateBulkBar(visibleRows){
  const bar=document.getElementById('listings-bulk-bar');
  const count=document.getElementById('listings-bulk-count');
  const all=document.getElementById('listings-select-all');
  if(!bar)return;
  const show=bulkSelectMode;
  bar.classList.toggle('open',show);
  const visibleIds=new Set(Array.from(document.querySelectorAll('.listing-select-cb')).map(cb=>String(cb.dataset.id)));
  const hidden=[...selectedListingIds].filter(id=>!visibleIds.has(id)).length;
  if(count)count.textContent=`${selectedListingIds.size} selected${hidden?` (${hidden} hidden by filter)`:''}`;
  if(all)all.checked=visibleIds.size>0&&[...visibleIds].every(id=>selectedListingIds.has(id));
}
function lcSelected(){return [...selectedListingIds].map(id=>allListings.find(l=>String(l.id)===id)).filter(Boolean);}

async function bulkPauseSelectedListings(){
  const sel=lcSelected(),ok=sel.filter(lcIsLive);
  if(!ok.length){showToast('None of the selected listings are live, so none can be paused','error');return;}
  const skipped=sel.length-ok.length;
  if(!await lcConfirm({title:'Pause listings?',message:`This hides <strong>${ok.length} listing${ok.length!==1?'s':''}</strong> from buyers immediately.${skipped?` ${skipped} will be skipped because they aren't live.`:''} You can undo this straight after.`,confirmLabel:'Pause them'}))return;
  const ids=ok.map(l=>l.id);
  const{error}=await db.from('listings').update({status:'paused'}).in('id',ids);
  if(error){showToast('Could not pause: '+error.message,'error');return;}
  lcAnimateOut(ids,()=>{
    ids.forEach(id=>{const l=allListings.find(x=>x.id===id);if(l)l.status='paused';});
    selectedListingIds.clear();renderListingsTable();renderOverview();
    showUndoToast(`${ids.length} listing${ids.length!==1?'s':''} paused`,async()=>{
      const{error:e2}=await db.from('listings').update({status:'active'}).in('id',ids);
      if(e2){showToast('Could not undo: '+e2.message,'error');return;}
      ids.forEach(id=>{const l=allListings.find(x=>x.id===id);if(l)l.status='active';});
      renderListingsTable();renderOverview();
      showToast('Restored ✓','success');
    });
  });
}
async function bulkResumeSelectedListings(){
  const ok=lcSelected().filter(l=>(l.status==='paused'||l.status==='occupied')&&!l.is_disabled);
  if(!ok.length){showToast('Nothing selected can be resumed','error');return;}
  if(!await lcConfirm({title:'Resume listings?',message:`<strong>${ok.length} listing${ok.length!==1?'s':''}</strong> will be resubmitted to our team for a quick re-approval before going live again.`,confirmLabel:'Resubmit'}))return;
  const ids=ok.map(l=>l.id);
  const{error}=await db.from('listings').update({status:'pending',occupied_at:null}).in('id',ids);
  if(error){showToast('Could not resume: '+error.message,'error');return;}
  ids.forEach(id=>{const l=allListings.find(x=>x.id===id);if(l){l.status='pending';l.occupied_at=null;}});
  selectedListingIds.clear();renderListingsTable();renderOverview();
  showToast(`${ids.length} listing(s) resubmitted for approval ✓`,'success');
  lcAnnounce(`${ids.length} listings resubmitted`);
}
async function bulkRenewExpiredListings(){
  const selected=lcSelected();
  const eligible=selected.filter(l=>l.status==='expired'&&!l.is_disabled&&!l.recycle_bin);
  if(!eligible.length){showToast('Select at least one expired listing to renew.','error');return;}
  const skipped=selected.length-eligible.length;
  if(!await lcConfirm({
    title:'Renew expired listings?',
    message:`<strong>${eligible.length}</strong> expired listing${eligible.length===1?'':'s'} will be resubmitted for review.${skipped?` ${skipped} selected listing${skipped===1?'':'s'} will be skipped.`:''}`,
    confirmLabel:'Resubmit for review'
  }))return;
  const ids=eligible.map(l=>l.id);
  const{data,error}=await db.from('listings').update({status:'pending'}).eq('seller_id',effectiveSellerId).eq('status','expired').in('id',ids).select('id');
  if(error){showToast('Could not renew listings: '+error.message,'error');return;}
  const renewedIds=new Set((data||[]).map(row=>String(row.id)));
  if(!renewedIds.size){showToast('No selected expired listings could be renewed. Refresh and try again.','error');return;}
  const renewed=eligible.filter(l=>renewedIds.has(String(l.id)));
  renewed.forEach(l=>{l.status='pending';});
  selectedListingIds.clear();
  renderListingsTable();renderOverview();
  renewed.forEach(l=>notifyAdmin('listing_pending',{listingId:l.id,listingTitle:l.title,sellerName:currentProfile?.full_name||currentUser?.email,sellerEmail:currentUser?.email}));
  const skippedCount=selected.length-renewed.length;
  showToast(`${renewed.length} listing${renewed.length===1?'':'s'} resubmitted for review${skippedCount?`; ${skippedCount} skipped`:''}.`,'success');
}

function dashboardPlanCoversListing(listing){
  const profile=ownerProfile||currentProfile;
  const subscriptionActive=!!profile?.subscription_tier&&profile.subscription_tier!=='none'&&
    (!profile.subscription_expires_at||new Date(profile.subscription_expires_at)>new Date());
  if(listing.category==='airbnb'){
    const bnbActive=!!profile?.has_bnb_capacity&&!!profile.bnb_expires_at&&new Date(profile.bnb_expires_at)>new Date();
    return bnbActive||(profile?.subscription_plan==='elite'&&subscriptionActive);
  }
  return !!profile?.has_rental_capacity&&subscriptionActive;
}

async function bulkScheduleSelectedListings(){
  const selected=lcSelected();
  const input=document.getElementById('bulk-listing-publish-at');
  const publishAt=input?.value?new Date(input.value):null;
  if(!publishAt||!Number.isFinite(publishAt.getTime())||publishAt.getTime()<=Date.now()){
    showToast('Choose a valid future date and time for publishing.','error');return;
  }
  const eligible=selected.filter(l=>lcIsLive(l)&&
    (l.payment_status==='paid'||l.payment_status==='trial'||dashboardPlanCoversListing(l)));
  if(!eligible.length){showToast('Select live listings covered by payment, trial, or an active plan.','error');return;}
  const skipped=selected.length-eligible.length;
  if(!await lcConfirm({
    title:'Schedule selected listings?',
    message:`${eligible.length} live listing${eligible.length===1?'':'s'} will be hidden from buyers now and automatically republished on <strong>${escHtml(publishAt.toLocaleString('en-KE'))}</strong>.${skipped?` ${skipped} selected listing${skipped===1?'':'s'} will be skipped because they are not live or lack payment, trial, or active-plan coverage.`:''}`,
    confirmLabel:'Schedule publishing'
  }))return;
  const ids=eligible.map(l=>l.id);
  const iso=publishAt.toISOString();
  const{data,error}=await db.from('listings').update({status:'scheduled',publish_at:iso}).eq('seller_id',effectiveSellerId).eq('status','active').in('id',ids).select('id');
  if(error){showToast('Could not schedule listings: '+error.message,'error');return;}
  const scheduledIds=new Set((data||[]).map(row=>String(row.id)));
  if(!scheduledIds.size){showToast('No selected live listings could be scheduled. Refresh and try again.','error');return;}
  const scheduled=eligible.filter(l=>scheduledIds.has(String(l.id)));
  scheduled.forEach(l=>{l.status='scheduled';l.publish_at=iso;});
  selectedListingIds.clear();
  if(input)input.value='';
  renderListingsTable();renderOverview();
  showToast(`${scheduled.length} listing${scheduled.length===1?'':'s'} scheduled for ${publishAt.toLocaleString('en-KE')}.`,'success');
}

async function bulkCancelScheduledListings(){
  const selected=lcSelected();
  const eligible=selected.filter(l=>l.status==='scheduled'&&!l.is_disabled&&!l.recycle_bin);
  if(!eligible.length){showToast('Select at least one scheduled listing that has not been disabled.','error');return;}
  if(!await lcConfirm({
    title:'Cancel scheduled publishing?',
    message:`<strong>${eligible.length}</strong> scheduled listing${eligible.length===1?'':'s'} will be returned to pending review.${selected.length>eligible.length?` ${selected.length-eligible.length} other selected listing${selected.length-eligible.length===1?'':'s'} will be skipped.`:''}`,
    confirmLabel:'Cancel schedule'
  }))return;
  const ids=eligible.map(l=>l.id);
  const{data,error}=await db.from('listings').update({status:'pending',publish_at:null})
    .eq('seller_id',effectiveSellerId).eq('status','scheduled')
    .or('is_disabled.is.null,is_disabled.eq.false')
    .or('recycle_bin.is.null,recycle_bin.eq.false')
    .in('id',ids).select('id');
  if(error){showToast('Could not cancel scheduled publishing: '+error.message,'error');return;}
  const changed=new Set((data||[]).map(row=>String(row.id)));
  if(!changed.size){showToast('No scheduled listings could be changed. Refresh and try again.','error');return;}
  allListings.forEach(l=>{if(changed.has(String(l.id))){l.status='pending';l.publish_at=null;}});
  selectedListingIds.clear();
  renderListingsTable();renderOverview();
  showToast(`${changed.size} listing${changed.size===1?'':'s'} returned to pending review${changed.size<eligible.length?`; ${eligible.length-changed.size} changed elsewhere and were skipped`:''}.`,'success');
}

async function bulkOccupySelectedListings(){
  const ok=lcSelected().filter(lcIsLive);
  if(!ok.length){showToast('Only live listings can be marked occupied or sold','error');return;}
  if(!await lcConfirm({title:'Mark as occupied / sold?',message:`<strong>${ok.length} listing${ok.length!==1?'s':''}</strong> will be shown to buyers as unavailable. Your messages and history are kept.`,confirmLabel:'Mark them'}))return;
  const ids=ok.map(l=>l.id);
  const{error}=await db.from('listings').update({status:'occupied',occupied_at:new Date().toISOString()}).in('id',ids);
  if(error){showToast('Could not update: '+error.message,'error');return;}
  lcAnimateOut(ids,()=>{
    ids.forEach(id=>{const l=allListings.find(x=>x.id===id);if(l){l.status='occupied';l.occupied_at=new Date().toISOString();}});
    selectedListingIds.clear();renderListingsTable();renderOverview();
    showUndoToast(`${ids.length} listing${ids.length!==1?'s':''} marked occupied/sold`,async()=>{
      const{error:e2}=await db.from('listings').update({status:'active',occupied_at:null}).in('id',ids);
      if(e2){showToast('Could not undo: '+e2.message,'error');return;}
      ids.forEach(id=>{const l=allListings.find(x=>x.id===id);if(l){l.status='active';l.occupied_at=null;}});
      renderListingsTable();renderOverview();
      showToast('Restored ✓','success');
    });
  });
}
async function bulkDuplicateSelectedListings(){
  const sel=lcSelected();
  if(!sel.length)return;
  if(!await lcConfirm({title:'Duplicate listings?',message:`<strong>${sel.length}</strong> cop${sel.length!==1?'ies':'y'} will be created and sent for review.`,confirmLabel:'Duplicate'}))return;
  let n=0;
  for(const l of sel){if(await duplicateListing(l.id,true))n++;}
  selectedListingIds.clear();renderListingsTable();renderOverview();
  showToast(`${n} listing(s) duplicated — each sent for review ✓`,'success');
}
async function bulkFeatureSelectedListings(){
  const ok=lcSelected().filter(l=>lcIsLive(l)&&!l.is_featured);
  if(!ok.length){showToast('Select live, not-yet-featured listings to boost','error');return;}
  const unit=Math.round((Number(platformPrices.premium_monthly_price)||1200)*0.6);
  const total=unit*ok.length;
  if(!await lcConfirm({title:'Feature these listings?',message:`Featuring <strong>${ok.length} listing${ok.length!==1?'s':''}</strong> costs roughly <strong>KES ${total.toLocaleString('en-KE')}</strong> (about KES ${unit.toLocaleString('en-KE')} each).<br><br>This opens a support ticket so our team can confirm the exact price and send payment details. <strong>Nothing is charged yet.</strong>`,confirmLabel:'Request featuring'}))return;
  if(!scwOpen)scwToggle();
  await scwCreateTicket('pricing');
  setTimeout(()=>{
    const input=document.getElementById('scw-input');
    if(input){input.value=`I'd like to feature these ${ok.length} listing(s):\n`+ok.map(l=>`• ${l.title}${lcNum(l)?' (#'+lcNum(l)+')':''}`).join('\n')+`\n\nPlease confirm the total cost and how to pay.`;scwSend();}
  },600);
  selectedListingIds.clear();updateBulkBar();
}
async function bulkSetViewingFeeSelectedListings(){
  const profile=ownerProfile||currentProfile;
  if(!profile||!['agent','company'].includes(profile.account_type)){
    showToast('Only Agent and Company accounts can set viewing fees.','error');return;
  }
  if(profile.viewing_fee_policy_version!==VIEWING_FEE_POLICY_VERSION||!profile.viewing_fee_policy_accepted_at){
    showToast('Read and accept the current Viewing Fee Policy before setting a fee.','error');return;
  }
  if(VIEWING_FEE_REQUIRES_IDENTITY&&profile.verification_status!=='verified'){
    showToast('Verify your identity before setting a viewing fee.','error');return;
  }
  if(profile.viewing_fee_blocked){
    showToast('Your viewing fee privilege is paused. Contact support for help.','error');return;
  }
  const rows=lcSelected();
  if(!rows.length){showToast('Select at least one listing.','error');return;}
  const entered=window.prompt(`Set a viewing fee in KES (0–${VIEWING_FEE_MAX.toLocaleString('en-KE')}). Enter 0 for free viewing:`,String(profile.default_viewing_fee??0));
  if(entered===null)return;
  const fee=Number(entered.trim());
  if(!Number.isInteger(fee)||fee<0||fee>VIEWING_FEE_MAX){showToast(`Enter a whole-number fee from KES 0 to KES ${VIEWING_FEE_MAX.toLocaleString('en-KE')}.`,'error');return;}
  if(!window.confirm(`Apply KES ${fee.toLocaleString('en-KE')} to ${rows.length} selected listing${rows.length===1?'':'s'}?`))return;
  const ids=rows.map(l=>l.id);
  try{
    const{error}=await db.rpc('set_listing_viewing_fees',{p_listing_ids:ids,p_viewing_fee:fee});
    if(error)throw new Error(`Could not update selected viewing fees: ${error.message}`);
    allListings=allListings.map(l=>ids.includes(l.id)?{...l,viewing_fee:fee}:l);
    renderListingsTable();
    showToast('Viewing fees updated ✓','success');
  }catch(error){
    console.error('[viewing-fee] Bulk viewing fee update failed:',error);
    showToast(error.message||'Could not update viewing fees.','error');
  }
}
async function bulkClearViewingFeeSelectedListings(){
  const profile=ownerProfile||currentProfile;
  if(!profile||!['agent','company'].includes(profile.account_type)){
    showToast('Only Agent and Company accounts can manage viewing fees.','error');return;
  }
  const rows=lcSelected();
  if(!rows.length){showToast('Select at least one listing.','error');return;}
  if(!window.confirm(`Clear the viewing fee and mark ${rows.length} selected listing${rows.length===1?'':'s'} as free to view?`))return;
  const ids=rows.map(l=>l.id);
  try{
    const{error}=await db.rpc('set_listing_viewing_fees',{p_listing_ids:ids,p_viewing_fee:0});
    if(error)throw new Error(`Could not clear selected viewing fees: ${error.message}`);
    allListings=allListings.map(l=>ids.includes(l.id)?{...l,viewing_fee:0}:l);
    renderListingsTable();
    showToast('Selected listings now show free viewing ✓','success');
  }catch(error){
    console.error('[viewing-fee] Bulk viewing fee clear failed:',error);
    showToast(error.message||'Could not clear viewing fees.','error');
  }
}
function bulkShareSelectedListings(){
  const sel=lcSelected();
  if(!sel.length)return;
  const text=sel.map(lcShareText).join('\n\n');
  if(navigator.share&&/Mobi|Android/i.test(navigator.userAgent)){navigator.share({title:'My listings',text}).catch(()=>{});return;}
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,'_blank','noopener');
}
async function bulkDeleteSelectedListings(){
  const ids=[...selectedListingIds];
  if(!ids.length)return;
  /* Friction scales with blast radius: a plain confirm for a small, deliberate
     batch; a typed confirmation once it's big enough to be a real mistake. */
  const heavy=ids.length>3;
  if(!await lcConfirm({
    title:`Delete ${ids.length} listing${ids.length!==1?'s':''}?`,
    message:heavy
      ? `This removes <strong>${ids.length} listings</strong> along with their messages, enquiries, reviews and unit types.<br><br>You'll get a few seconds to undo, then it's permanent.`
      : `This removes <strong>${ids.length} listing${ids.length!==1?'s':''}</strong> and everything attached to ${ids.length!==1?'them':'it'}.<br><br>You'll get a few seconds to undo.`,
    confirmLabel:heavy?'Delete permanently':'Delete',
    danger:true,
    requireText:heavy?'DELETE':null
  }))return;
  lcAnimateOut(ids,()=>lcScheduleDelete(ids,`${ids.length} listing${ids.length!==1?'s':''} deleted`));
}

/* ══════════ CSV export ══════════ */
function exportListingsCSV(selectedOnly){
  const rows=selectedOnly?lcSelected():allListings;
  if(!rows.length){showToast('Nothing to export','error');return;}
  const out=[['ID','Title','Status','Area','Sub-area','Price (KES)','Viewing fee (KES)','Type','Photos','Views','Messages','Unread','Enquiries','Unanswered','Health','Days live','Posted','Link']];
  rows.forEach(l=>{
    const s=lcS(l.id);
    out.push([lcNum(l),l.title,getListingStatusDisplay(l).label,l.area||'',l.sub_area||'',Number(l.price)||0,Number(l.viewing_fee)||0,l.price_type||'',lcPhotoCount(l),l.views||0,s.msgs,s.unread,s.enquiries,s.unanswered,lcHealth(l).score,lcDaysLive(l),new Date(l.created_at).toLocaleDateString('en-KE'),lcListingUrl(l)]);
  });
  const csv=out.map(r=>r.map(v=>csvCell(v)).join(',')).join('\n');
  rlDownloadBlob(`Nyumba254-Listings-${new Date().toISOString().slice(0,10)}.csv`,csv,'text/csv');
  showToast('CSV exported ✓','success');
  closeActionMenu();
}

/* ══════════════════════════════════════
   MANAGE UNITS MODAL — multi-unit properties
   ════════════════════════════════════════════════════
   Opened from the "Manage units" button or the Units alert
   chip on a listing card. Fetches fresh listing_units +
   occupancy log rows for that listing, then lets the seller
   mark a unit occupied (optionally recording floor/door/
   position) or free one up if they made a mistake.
══════════════════════════════════════ */
async function openManageUnitsModal(listingId){
  const l=allListings.find(x=>String(x.id)===String(listingId));
  if(!l){showToast('Listing not found','error');return;}
  muActiveListingId=listingId;
  document.getElementById('mu-listing-title').textContent=l.title;
  document.getElementById('mu-unit-list').innerHTML='<div style="text-align:center;padding:20px;color:var(--text-3);font-size:13px">Loading units…</div>';
  document.getElementById('mu-summary-strip').innerHTML='';
  openModal('modal-manage-units');

  const{data,error}=await db.from('listing_units').select('*').eq('listing_id',listingId).order('id',{ascending:true});
  if(error){document.getElementById('mu-unit-list').innerHTML=`<div class="empty-state"><p>Could not load units: ${escHtml(error.message)}</p></div>`;return;}
  muUnits=data||[];
  l.listing_units=muUnits;
  renderManageUnitsModal();
}

function muRenderSummaryStrip(){
  const totalAvail=muUnits.reduce((s,u)=>s+(u.quantity_available??0),0);
  const totalUnits=muUnits.reduce((s,u)=>s+(u.quantity_total??u.quantity_available??0),0);
  const prices=muUnits.map(u=>Number(u.price)).filter(p=>!isNaN(p));
  const min=prices.length?Math.min(...prices):0,max=prices.length?Math.max(...prices):0;
  document.getElementById('mu-summary-strip').innerHTML=
    `<span><strong>${totalAvail}</strong> of <strong>${totalUnits}</strong> units available</span>`+
    `<span>Price range: <strong>KES ${min.toLocaleString('en-KE')}${min!==max?' – '+max.toLocaleString('en-KE'):''}</strong></span>`;
}

function renderManageUnitsModal(){
  if(!muUnits.length){document.getElementById('mu-unit-list').innerHTML='<div class="empty-state"><p>No unit types found for this property.</p></div>';document.getElementById('mu-summary-strip').innerHTML='';return;}
  muRenderSummaryStrip();
  document.getElementById('mu-unit-list').innerHTML=muUnits.map(u=>{
    const available=u.quantity_available??0;
    const total=u.quantity_total??available;
    const badgeCls=available<=0?'none':(total&&available/total<=0.2?'low':'');
    return `
      <div class="mu-unit-row" id="mu-unit-${u.id}">
        <div class="mu-unit-row-top">
          <strong>${escHtml(u.unit_label)}</strong>
          <span class="mu-badge ${badgeCls}">${available} of ${total} available</span>
        </div>
        <div class="mu-unit-actions">
          <button class="btn btn-primary btn-sm" ${available<=0?'disabled':''} onclick="muToggleOccupyForm(${u.id})">Mark one occupied</button>
          <button class="btn btn-outline btn-sm" ${available>=total?'disabled':''} onclick="muMarkAvailable(${u.id})">Mark one available</button>
          <button class="btn btn-outline btn-sm" onclick="muOpenEditForm(${u.id})">Edit</button>
          <button class="btn btn-outline btn-sm" style="color:var(--red);border-color:var(--red)" onclick="muDeleteUnit(${u.id})">Delete</button>
        </div>
        <div class="mu-occupy-form mu-edit-form" id="mu-edit-form-${u.id}">
          <div class="mu-occupy-grid">
            <div><label>Unit label</label><input type="text" id="mu-edit-label-${u.id}" value="${escAttr(u.unit_label)}"/></div>
            <div><label>Price (KES)</label><input type="number" id="mu-edit-price-${u.id}" value="${u.price}"/></div>
            <div><label>Total units of this type</label><input type="number" id="mu-edit-total-${u.id}" value="${u.quantity_total??u.quantity_available}" min="1"/></div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-primary btn-sm" onclick="muSaveEditFromForm(${u.id})">Save changes</button>
            <button class="btn btn-outline btn-sm" onclick="muCancelEditForm(${u.id})">Cancel</button>
          </div>
        </div>
        <div class="mu-occupy-form" id="mu-occupy-form-${u.id}">
          <div class="mu-occupy-grid">
            <div><label>Floor</label><input type="text" id="mu-floor-${u.id}" placeholder="e.g. 2nd floor"/></div>
            <div><label>Door / unit number</label><input type="text" id="mu-door-${u.id}" placeholder="e.g. Door 4B"/></div>
            <div><label>Position</label>
              <select id="mu-pos-${u.id}">
                <option value="">Not specified</option>
                <option value="left">Left side</option>
                <option value="right">Right side</option>
                <option value="middle">Middle</option>
                <option value="corner">Corner unit</option>
                <option value="end">End of corridor</option>
              </select>
            </div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-primary btn-sm" onclick="muConfirmOccupy(${u.id})">Confirm — mark occupied</button>
            <button class="btn btn-outline btn-sm" onclick="muToggleOccupyForm(${u.id})">Cancel</button>
          </div>
        </div>
        <div class="mu-log" id="mu-log-${u.id}"></div>
      </div>`;
  }).join('');
  muUnits.forEach(u=>muLoadOccupancyLog(u.id));
}

function muToggleOccupyForm(unitId){document.getElementById(`mu-occupy-form-${unitId}`)?.classList.toggle('open');}

function muToggleAddForm(){document.getElementById('mu-add-form')?.classList.toggle('open');}

async function muSaveNewUnit(){
  const label=document.getElementById('mu-new-label').value.trim();
  const price=parseFloat(document.getElementById('mu-new-price').value)||0;
  const total=parseInt(document.getElementById('mu-new-total').value)||1;
  if(!label){showToast('Please name the unit type','error');return;}
  if(muActionBusy)return;
  muActionBusy=true;
  try{
    const{error}=await db.from('listing_units').insert({listing_id:muActiveListingId,unit_label:label,price,quantity_available:total,quantity_total:total});
    if(error){showToast('Could not add unit type: '+error.message,'error');return;}
    document.getElementById('mu-new-label').value='';document.getElementById('mu-new-price').value='';document.getElementById('mu-new-total').value='1';
    muToggleAddForm();
    showToast('Unit type added ✓','success');
    await openManageUnitsModal(muActiveListingId);
    renderListingsTable();renderQuickListings();
  } finally { muActionBusy=false; }
}

function muOpenEditForm(unitId){
  document.querySelectorAll('.mu-edit-form.open').forEach(f=>f.classList.remove('open'));
  document.getElementById(`mu-edit-form-${unitId}`)?.classList.toggle('open');
}
function muCancelEditForm(unitId){
  document.getElementById(`mu-edit-form-${unitId}`)?.classList.remove('open');
}
async function muSaveEditFromForm(unitId){
  const label=document.getElementById(`mu-edit-label-${unitId}`).value.trim();
  const price=parseFloat(document.getElementById(`mu-edit-price-${unitId}`).value)||0;
  const total=parseInt(document.getElementById(`mu-edit-total-${unitId}`).value)||1;
  await muSaveEditedUnit(unitId,label,price,total);
}
async function muSaveEditedUnit(unitId,label,price,total){
  if(!label){showToast('Label cannot be empty','error');return;}
  const u=muUnits.find(x=>x.id===unitId);if(!u)return;
  const currentAvail=u.quantity_available??0;
  const currentTotal=u.quantity_total??currentAvail;
  const occupiedCount=Math.max(0,currentTotal-currentAvail);
  const newAvail=Math.max(0,total-occupiedCount);
  const{error}=await db.from('listing_units').update({unit_label:label,price,quantity_total:total,quantity_available:newAvail}).eq('id',unitId);
  if(error){showToast('Could not update: '+error.message,'error');return;}
  showToast('Unit type updated ✓','success');
  await openManageUnitsModal(muActiveListingId);
  renderListingsTable();renderQuickListings();
}
async function muDeleteUnit(unitId){
  const label=(muUnits.find(u=>u.id===unitId)||{}).unit_label||'this unit type';
  if(!await lcConfirm({title:'Delete unit type?',message:`Delete unit type <strong>${escHtml(label)}</strong>? This cannot be undone.`,confirmLabel:'Delete',danger:true}))return;
  const{error}=await db.from('listing_units').delete().eq('id',unitId);
  if(error){showToast('Could not delete: '+error.message,'error');return;}
  showToast('Unit type deleted','success');
  await openManageUnitsModal(muActiveListingId);
  renderListingsTable();renderQuickListings();
}

async function muConfirmOccupy(unitId){
  if(muActionBusy)return;
  muActionBusy=true;
  try{
    const floor=document.getElementById(`mu-floor-${unitId}`).value.trim()||null;
    const door=document.getElementById(`mu-door-${unitId}`).value.trim()||null;
    const pos=document.getElementById(`mu-pos-${unitId}`).value||null;
    const unit=muUnits.find(u=>u.id===unitId);
    if(!unit||(unit.quantity_available??0)<=0)return;

    const newAvailable=unit.quantity_available-1;
    // Optimistic-locking guard: only succeeds if quantity_available still
    // matches what we last read, so two people clicking at once can't both
    // "win" and push the count below zero or out of sync.
    const{data:updRows,error}=await db.from('listing_units').update({quantity_available:newAvailable}).eq('id',unitId).eq('quantity_available',unit.quantity_available).select();
    if(error){showToast('Could not update unit: '+error.message,'error');return;}
    if(!updRows||!updRows.length){showToast('This unit was just updated elsewhere — refreshing…','error');await openManageUnitsModal(muActiveListingId);return;}

    try{
      const{error:logErr}=await db.from('unit_occupancy_log').insert({listing_unit_id:unitId,listing_id:muActiveListingId,floor,door_number:door,position:pos,action:'occupied'});
      if(logErr) console.warn('unit_occupancy_log insert failed (availability was still updated):',logErr.message);
    }catch(e){console.warn('unit_occupancy_log insert failed (availability was still updated):',e.message||e);}

    unit.quantity_available=newAvailable;
    muSyncListingCache();
    muToggleOccupyForm(unitId);
    renderManageUnitsModal();
    renderListingsTable();renderQuickListings();
    showToast('Unit marked as occupied — live listing updated ✓','success');
    {
      const l=allListings.find(x=>String(x.id)===String(muActiveListingId));
      if(l)notifyInApp('listing_updated',`Unit occupied — "${l.title}"`,`${unit.unit_label}: ${newAvailable} of ${unit.quantity_total??unit.quantity_available} now available`,lcNum(l)?`/listing?id=${lcNum(l)}`:null);
    }
  } finally {
    muActionBusy=false;
  }
}

async function muMarkAvailable(unitId){
  if(muActionBusy)return;
  muActionBusy=true;
  try{
    const unit=muUnits.find(u=>u.id===unitId);
    if(!unit)return;
    const total=unit.quantity_total??unit.quantity_available;
    if((unit.quantity_available??0)>=total)return;

    const newAvailable=unit.quantity_available+1;
    const{data:updRows,error}=await db.from('listing_units').update({quantity_available:newAvailable}).eq('id',unitId).eq('quantity_available',unit.quantity_available).select();
    if(error){showToast('Could not update unit: '+error.message,'error');return;}
    if(!updRows||!updRows.length){showToast('This unit was just updated elsewhere — refreshing…','error');await openManageUnitsModal(muActiveListingId);return;}

    try{
      const{error:logErr}=await db.from('unit_occupancy_log').insert({listing_unit_id:unitId,listing_id:muActiveListingId,action:'freed'});
      if(logErr) console.warn('unit_occupancy_log insert failed (availability was still updated):',logErr.message);
    }catch(e){console.warn('unit_occupancy_log insert failed (availability was still updated):',e.message||e);}

    unit.quantity_available=newAvailable;
    muSyncListingCache();
    renderManageUnitsModal();
    renderListingsTable();renderQuickListings();
    showToast('Unit marked as available again ✓','success');
    {
      const l=allListings.find(x=>String(x.id)===String(muActiveListingId));
      if(l)notifyInApp('listing_updated',`Unit freed up — "${l.title}"`,`${unit.unit_label}: ${newAvailable} of ${unit.quantity_total??unit.quantity_available} now available`,lcNum(l)?`/listing?id=${lcNum(l)}`:null);
    }
  } finally {
    muActionBusy=false;
  }
}

function muSyncListingCache(){
  const l=allListings.find(x=>String(x.id)===String(muActiveListingId));
  if(l)l.listing_units=muUnits;
}

async function muLoadOccupancyLog(unitId){
  const el=document.getElementById(`mu-log-${unitId}`);
  if(!el)return;
  try{
    const{data,error}=await db.from('unit_occupancy_log').select('*').eq('listing_unit_id',unitId).order('created_at',{ascending:false}).limit(5);
    if(error||!data||!data.length){el.innerHTML='';return;}
  } catch(e){
    console.error(e);
  }
}
// ── Manage video walkthroughs ──
let mvActiveListingId=null, mvVideos=[];

function mvGetLimit(){
  const p = ownerProfile || currentProfile;
  return subscriptionInfo().active&&p?.subscription_tier==='yearly' ? 5 : 1;
}

function mvIsBlocked(){
  return !!(ownerProfile||currentProfile)?.video_walkthrough_blocked;
}

async function openManageVideosModal(listingId){
  const l=allListings.find(x=>String(x.id)===String(listingId));
  if(!l){showToast('Listing not found','error');return;}
  if(mvIsBlocked()){showToast('Adding video walkthroughs is disabled for this account. Contact support for help.','error');return;}
  mvActiveListingId=listingId;
  document.getElementById('mv-listing-title').textContent=l.title;
  document.getElementById('mv-url-input').value='';
  document.getElementById('mv-file-input').value='';
  document.getElementById('mv-file-status').textContent='';
  const limit=mvGetLimit();
  document.getElementById('mv-limit-note').textContent=`Free on every plan — 1 video per listing${limit>1?' (up to 5 with an active yearly plan)':''}.`;
  try{
    const{data,error}=await db.from('listing_videos').select('id,url,position').eq('listing_id',listingId).order('position',{ascending:true});
    if(error)throw error;
    mvVideos=data||[];
    mvRenderVideoList();
    openModal('modal-manage-videos');
  }catch(error){
    console.error('Could not load listing videos:',error);
    showToast('Could not load listing videos: '+(error.message||String(error)),'error');
  }
}

function mvRenderVideoList(){
  const el=document.getElementById('mv-video-list');
  if(!el)return;
  if(!mvVideos.length){el.innerHTML='<div style="font-size:12px;color:var(--text-3)">No videos added yet.</div>';return;}
  el.innerHTML=mvVideos.map((v,i)=>`
    <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px">
      <span style="flex:1;font-size:12.5px;word-break:break-all">${escHtml(v.url||v)}</span>
      <button type="button" class="btn btn-outline btn-sm" style="color:var(--red);border-color:var(--red)" onclick="removeListingVideo(${i})">Remove</button>
    </div>`).join('');
}

async function addListingVideo(){
  if(mvIsBlocked()){showToast('Adding video walkthroughs is disabled for this account. Contact support for help.','error');return;}
  const input=document.getElementById('mv-url-input');
  const url=input.value.trim();
  if(!url){showToast('Paste a video link first','error');return;}
  if(!safeHttpLink(url)){showToast('Enter a valid video link starting with http:// or https://.','error');return;}
  if(mvVideos.length>=mvGetLimit()){showToast(`You can add up to ${mvGetLimit()} video(s) on your plan`,'error');return;}
  const btn=document.getElementById('mv-add-btn');
  btn.disabled=true;btn.textContent='Saving…';
  try{
    const{data,error}=await db.from('listing_videos').insert({listing_id:mvActiveListingId,url,position:mvVideos.length}).select('id,url,position').single();
    if(error)throw error;
    mvVideos.push(data);
    const l=allListings.find(x=>String(x.id)===String(mvActiveListingId));
    if(l)l.videos=mvVideos;
    input.value='';
    mvRenderVideoList();
    showToast('Video added ✓','success');
  }catch(error){
    console.error('Could not save listing video:',error);
    showToast('Could not save: '+(error.message||String(error)),'error');
  }finally{
    btn.disabled=false;btn.textContent='+ Add';
  }
}

function mvOwnStoragePath(urlValue){
  try{
    const url=new URL(urlValue),base=new URL(SUPABASE_URL);
    const marker=`/storage/v1/object/public/${LISTING_VIDEOS_BUCKET}/`;
    const index=url.pathname.indexOf(marker);
    if(url.origin!==base.origin||index<0)return null;
    const path=decodeURIComponent(url.pathname.slice(index+marker.length));
    const segments=path.split('/');
    if(!path.startsWith(`${mvActiveListingId}/`)||segments.some(part=>!part||part==='.'||part==='..'))return null;
    return path;
  }catch(error){
    console.warn('Could not verify listing video storage ownership; leaving the file untouched:',error);
    return null;
  }
}

async function removeListingVideo(index){
  const video=mvVideos[index];
  if(!video)return;
  let deleteError;
  try{
    const{error}=await db.from('listing_videos').delete().eq('id',video.id).eq('listing_id',mvActiveListingId);
    deleteError=error;
  }catch(error){deleteError=error;}
  if(deleteError){console.error('Could not remove listing video:',deleteError);showToast('Could not remove: '+(deleteError.message||String(deleteError)),'error');return;}
  mvVideos.splice(index,1);
  const l=allListings.find(x=>String(x.id)===String(mvActiveListingId));
  if(l)l.videos=mvVideos;
  const path=mvOwnStoragePath(video.url);
  if(path){
    let storageError;
    try{
      ({error:storageError}=await db.storage.from(LISTING_VIDEOS_BUCKET).remove([path]));
    }catch(error){storageError=error;}
    if(storageError){
      console.error('Video record was removed, but its uploaded file could not be deleted:',storageError);
      showToast('Video removed, but its stored file could not be cleaned up: '+(storageError.message||String(storageError)),'error');
      mvRenderVideoList();
      return;
    }
  }
  mvRenderVideoList();
  showToast('Video removed','success');
}

const LISTING_VIDEOS_BUCKET='listing-videos'; // create this Supabase storage bucket if it doesn't exist
async function handleMvFileSelect(file){
  if(!file)return;
  if(mvIsBlocked()){showToast('Adding video walkthroughs is disabled for this account. Contact support for help.','error');document.getElementById('mv-file-input').value='';return;}
  if(!file.type.startsWith('video/')){showToast('Choose a video file.','error');document.getElementById('mv-file-input').value='';return;}
  if(mvVideos.length>=mvGetLimit()){showToast(`You can add up to ${mvGetLimit()} video(s) on your plan`,'error');document.getElementById('mv-file-input').value='';return;}
  if(file.size>100*1024*1024){showToast('Video must be under 100MB','error');document.getElementById('mv-file-input').value='';return;}
  const statusEl=document.getElementById('mv-file-status');
  statusEl.textContent='Uploading…';
  const ext=(file.name.split('.').pop()||'mp4').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,8)||'mp4';
  const path=`${mvActiveListingId}/${Date.now()}.${ext}`;
  let uploaded=false;
  try{
    const{error:upErr}=await db.storage.from(LISTING_VIDEOS_BUCKET).upload(path,file);
    if(upErr)throw new Error(`Upload failed: ${upErr.message}`);
    uploaded=true;
    const{data:pub}=db.storage.from(LISTING_VIDEOS_BUCKET).getPublicUrl(path);
    const{data,error}=await db.from('listing_videos').insert({listing_id:mvActiveListingId,url:pub.publicUrl,position:mvVideos.length}).select('id,url,position').single();
    if(error)throw new Error(`Save failed: ${error.message}`);
    mvVideos.push(data);
    const l=allListings.find(x=>String(x.id)===String(mvActiveListingId));
    if(l)l.videos=mvVideos;
    statusEl.textContent='Uploaded ✓';
    document.getElementById('mv-file-input').value='';
    mvRenderVideoList();
  }catch(error){
    console.error('Video walkthrough upload failed:',error);
    statusEl.textContent=error.message||'Video upload failed.';
    if(uploaded){
      try{
        const{error:cleanupError}=await db.storage.from(LISTING_VIDEOS_BUCKET).remove([path]);
        if(cleanupError)console.error('Could not remove uploaded video after its record failed to save:',cleanupError);
      }catch(cleanupError){console.error('Could not clean up uploaded video after a failed save:',cleanupError);}
    }
  }
}
function openEditModal(id){
  const l=allListings.find(l=>l.id===id);if(!l)return;
  const profile=ownerProfile||currentProfile,feeEligible=['agent','company'].includes(profile?.account_type);
  const feeInput=document.getElementById('edit-viewing-fee');
  const feeLocked=feeEligible&&(VIEWING_FEE_REQUIRES_IDENTITY&&profile?.verification_status!=='verified'||profile?.viewing_fee_blocked===true);
  document.getElementById('edit-viewing-fee-wrap').hidden=!feeEligible;
  feeInput.value=l.viewing_fee??0;
  feeInput.max=String(VIEWING_FEE_MAX);
  feeInput.disabled=feeLocked;
  document.getElementById('edit-viewing-fee-default').textContent=`Default: KES ${Number(profile?.default_viewing_fee||0).toLocaleString('en-KE')}`;
  const feeLockNotice=document.getElementById('edit-viewing-fee-lock-notice');
  feeLockNotice.hidden=!feeLocked;
  if(feeLocked)document.getElementById('edit-viewing-fee-lock-text').textContent=profile?.viewing_fee_blocked
    ?'Your viewing fee privilege is paused. Contact support to appeal.'
    :'Verify your identity to charge a viewing fee.';
  document.getElementById('edit-viewing-fee-reset').disabled=feeLocked;
  document.getElementById('edit-viewing-fee-warning').hidden=true;
  document.getElementById('edit-viewing-fee-reset').onclick=()=>{feeInput.value=profile?.default_viewing_fee??0;feeInput.dispatchEvent(new Event('input',{bubbles:true}));};
  feeInput.oninput=()=>{document.getElementById('edit-viewing-fee-warning').hidden=Number(feeInput.value||0)<=Number(l.viewing_fee||0);};
  editPhotosListingId=id;
  const ed = l.details || {};
  document.getElementById('edit-id').value=l.id;document.getElementById('edit-title').value=l.title||'';document.getElementById('edit-price').value=l.price||'';document.getElementById('edit-price-type').value=l.price_type||(l.price_frequency==='once'?'sale':'rent');document.getElementById('edit-bedrooms').value=ed.bedrooms||'';document.getElementById('edit-bathrooms').value=ed.bathrooms||'';document.getElementById('edit-size').value=ed.size_sqm||'';document.getElementById('edit-category').value=l.category||'apartment';document.getElementById('edit-address').value=l.address||'';document.getElementById('edit-description').value=l.description||'';document.getElementById('edit-furnished').checked=ed.furnished==='yes';document.getElementById('edit-contact_hidden').checked=l.contact_hidden||false;
  const currentArea=l.area||'Milimani';
  const currentCounty=NK_AREA_TO_COUNTY[currentArea]||'Kisumu';
  document.getElementById('edit-county').value=currentCounty;
  nkPopulateEditAreas(currentCounty,currentArea);
  const editAmenitiesArr = Array.isArray(l.amenities) ? l.amenities : [];
  document.getElementById('edit-amenities-grid').innerHTML=AMENITY_KEYS.map(a=>`<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:7px;background:var(--surface);border-radius:6px"><input type="checkbox" id="edit-${a.key}" ${editAmenitiesArr.includes(a.key)?'checked':''}/>${a.label}</label>`).join('');
  document.getElementById('edit-photos-grid').innerHTML=renderEditPhotosGrid(l);
  document.getElementById('edit-photo-upload-status').textContent='';
  if(l.listing_units&&l.listing_units.length>0){
    showToast('This listing has unit types — price/bedroom fields here apply to the property summary only. Use "Manage unit types" to edit individual unit types.','');
  }
  openModal('modal-edit');
  if(l.is_disabled)setTimeout(()=>showToast("Disabled by admin. Edits won't make it live — contact admin.",'error'),350);
}

async function saveEdit(){
  const id=document.getElementById('edit-id').value;
  const editAmenities=AMENITY_KEYS.filter(a=>document.getElementById('edit-'+a.key)?.checked).map(a=>a.key);
  const original=allListings.find(l=>l.id===id);
  const priceFreqOut = document.getElementById('edit-price-type').value === 'sale' ? 'once' : (original?.price_frequency && original.price_frequency !== 'once' ? original.price_frequency : 'month');
  const mergedDetails = { ...(original?.details||{}),
    bedrooms: document.getElementById('edit-bedrooms').value || null,
    bathrooms: document.getElementById('edit-bathrooms').value || null,
    size_sqm: document.getElementById('edit-size').value || null,
    furnished: document.getElementById('edit-furnished').checked ? 'yes' : 'no',
  };
  const u={title:document.getElementById('edit-title').value.trim(),price:parseFloat(document.getElementById('edit-price').value)||0,price_type:document.getElementById('edit-price-type').value,price_frequency:priceFreqOut,area:document.getElementById('edit-area').value,category:document.getElementById('edit-category').value,address:document.getElementById('edit-address').value.trim(),description:document.getElementById('edit-description').value.trim(),contact_hidden:document.getElementById('edit-contact_hidden').checked,amenities:editAmenities,details:mergedDetails};
  const feeEligible=['agent','company'].includes((ownerProfile||currentProfile)?.account_type);
  let viewingFeeToSave=null;
  if(feeEligible){
    const feeInput=document.getElementById('edit-viewing-fee'),feeRaw=feeInput.value.trim(),fee=feeRaw===''?null:Number(feeRaw);
    if(fee!==null&&(!Number.isInteger(fee)||fee<0||fee>VIEWING_FEE_MAX)){showToast(`Enter a whole-number viewing fee from KES 0 to KES ${VIEWING_FEE_MAX.toLocaleString('en-KE')}.`,'error');feeInput.focus();return;}
    viewingFeeToSave=fee??0;
    if(viewingFeeToSave>0&&Number(original?.viewing_fee||0)!==viewingFeeToSave){
      try{await acceptCurrentViewingFeePolicy()}catch(error){showToast(error.message,'error');settingsJumpTo('viewing-fee-settings');return;}
    }
  }
  const viewingFeeChanged=feeEligible&&Number(original?.viewing_fee||0)!==Number(viewingFeeToSave||0);
  const btn=document.getElementById('btn-save-edit');btn.disabled=true;btn.innerHTML='<span class="spinner-sm"></span> Saving…';
  const oldPrice=original?Number(original.price):null;

  // Build a human-readable diff BEFORE anything is overwritten, so the
  // "what changed" notification can say exactly what was edited.
  const changeLines=[];
  if(original){
    if(original.title!==u.title)changeLines.push(`Title: "${original.title}" → "${u.title}"`);
    if(Number(original.price)!==Number(u.price))changeLines.push(`Price: KES ${Number(original.price).toLocaleString('en-KE')} → KES ${Number(u.price).toLocaleString('en-KE')}`);
    if(feeEligible&&Number(original.viewing_fee||0)!==Number(viewingFeeToSave||0))changeLines.push(`Viewing fee: KES ${Number(original.viewing_fee||0).toLocaleString('en-KE')} → KES ${Number(viewingFeeToSave||0).toLocaleString('en-KE')}`);
    if(original.area!==u.area)changeLines.push(`Area: ${original.area} → ${u.area}`);
    if(original.address!==u.address)changeLines.push('Address updated');
    if((original.description||'')!==u.description)changeLines.push('Description updated');
    if((original.details?.bedrooms||'')!=(mergedDetails.bedrooms||''))changeLines.push(`Bedrooms: ${original.details?.bedrooms||'—'} → ${mergedDetails.bedrooms||'—'}`);
    if((original.details?.bathrooms||'')!=(mergedDetails.bathrooms||''))changeLines.push(`Bathrooms: ${original.details?.bathrooms||'—'} → ${mergedDetails.bathrooms||'—'}`);
    if((original.details?.size_sqm||'')!=(mergedDetails.size_sqm||''))changeLines.push(`Size: ${original.details?.size_sqm||'—'}m² → ${mergedDetails.size_sqm||'—'}m²`);
    if((original.details?.furnished||'')!==mergedDetails.furnished)changeLines.push(`Furnished: ${mergedDetails.furnished==='yes'?'Yes':'No'}`);
    if(original.contact_hidden!==u.contact_hidden)changeLines.push(`Contact visibility: ${u.contact_hidden?'Hidden (chat only)':'Visible'}`);
    const oldAm=(original.amenities||[]).slice().sort().join(',');
    const newAm=editAmenities.slice().sort().join(',');
    if(oldAm!==newAm)changeLines.push('Amenities updated');
  }

  const{error}=await db.from('listings').update(u).eq('id',id);
  btn.disabled=false;btn.innerHTML='Save changes';
  if(error){showToast('Could not save: '+error.message,'error');return;}
  if(viewingFeeChanged){
    const{error:feeError}=await db.rpc('set_listing_viewing_fees',{p_listing_ids:[id],p_viewing_fee:viewingFeeToSave});
    if(feeError){console.error('[viewing-fee] Listing details saved but fee update failed:',feeError);showToast(`Listing details were saved, but the viewing fee was not: ${feeError.message}`,'error');return;}
    u.viewing_fee=viewingFeeToSave;
  }
  const idx=allListings.findIndex(l=>l.id===id);if(idx!==-1)allListings[idx]={...allListings[idx],...u};
  closeModal('modal-edit');renderListingsTable();renderQuickListings();showToast('Listing updated ✓','success');
  if(oldPrice!==null&&oldPrice!==Number(u.price)){
    notifyAdmin('price_change',{listingId:id,listingTitle:u.title,oldPrice,newPrice:Number(u.price),priceType:u.price_type,sellerName:currentProfile?.full_name||currentUser?.email,sellerEmail:currentUser?.email});
  }
  if(changeLines.length&&original){
    const listingLink=`/listing?id=${String(original.listing_number).padStart(6,'0')}`;
    notifyInApp('listing_updated',`"${u.title}" was updated`,changeLines.join(' · '),listingLink);
  }
}

function openDeleteModal(id,name){deleteTargetId=id;document.getElementById('delete-listing-name').textContent=name;openModal('modal-delete');}

/* v5: single delete now gets the same undo window the bulk actions already
   have. The listing disappears from the UI immediately, but nothing is
   touched in the database until the undo window elapses. */
function confirmDelete(){
  if(!deleteTargetId)return;
  const id=deleteTargetId;
  const l=allListings.find(x=>String(x.id)===String(id));
  deleteTargetId=null;
  closeModal('modal-delete');
  lcScheduleDelete([id],`“${l?l.title:'Listing'}” deleted`);
}

function lcScheduleDelete(ids,message){
  if(lcPendingDelete)lcCommitDelete();            /* only one pending batch at a time */
  const keep=new Set(ids.map(String));
  const removed=allListings.filter(l=>keep.has(String(l.id)));
  allListings=allListings.filter(l=>!keep.has(String(l.id)));
  selectedListingIds.clear();
  renderListingsTable();renderOverview();renderQuickListings();
  lcPendingDelete={ids:[...keep],removed,timer:null};
  lcPendingDelete.timer=setTimeout(lcCommitDelete,8000);
  showUndoToast(message,()=>{
    if(!lcPendingDelete)return;
    clearTimeout(lcPendingDelete.timer);
    lcPendingDelete.removed.forEach(l=>allListings.push(l));
    allListings.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    lcPendingDelete=null;
    renderListingsTable();renderOverview();renderQuickListings();
    showToast('Restored — nothing was deleted ✓','success');
  },8000);
}

async function lcCommitDelete(){
  const pending=lcPendingDelete;
  if(!pending)return;
  lcPendingDelete=null;
  clearTimeout(pending.timer);
  const ids=pending.ids;
  await db.from('listing_photos').delete().in('listing_id',ids);
  await db.from('enquiries').delete().in('listing_id',ids);
  await db.from('messages').delete().in('listing_id',ids);
  await db.from('unit_occupancy_log').delete().in('listing_id',ids);
  await db.from('listing_units').delete().in('listing_id',ids);
  await db.from('reviews').delete().in('listing_id',ids);
  const{data,error}=await db.from('listings').delete().in('id',ids).select();
  if(error||!data?.length){
    /* Put them back on screen so nothing silently vanishes on a failure. */
    pending.removed.forEach(l=>{if(!allListings.some(x=>String(x.id)===String(l.id)))allListings.push(l);});
    allListings.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    renderListingsTable();renderOverview();renderQuickListings();
    showToast(error?('Could not delete: '+error.message):'Delete blocked by database permissions (RLS)','error');
    return;
  }
  const del=new Set(ids.map(String));
  allEnquiries=allEnquiries.filter(e=>!del.has(String(e.listing_id)));
  allMessages=allMessages.filter(m=>!del.has(String(m.listing_id)));
  buildThreads();updateNavBadges();renderOverview();
  lcAnnounce(`${ids.length} listing${ids.length!==1?'s':''} deleted`);
}
window.addEventListener('beforeunload',()=>{if(lcPendingDelete)lcCommitDelete();});

function showAllMessages(){threadListingFilter=null;activeThread=null;showPage('messages');}
function openMessagesForListing(listingId){threadListingFilter=listingId;activeThread=null;showPage('messages');}
function openConversationFromThread(key){threadListingFilter=null;showPage('messages');openThread(key);}
function showThreadListMobile(){document.getElementById('messages-layout')?.classList.remove('mobile-chat-active');}
function showChatMobile(){document.getElementById('messages-layout')?.classList.add('mobile-chat-active');}
const QUICK_REPLIES=[
  {label:'👋 Welcome',text:"Hello, thank you for your interest in this property. I'd be glad to help — is there anything specific you'd like to know before we arrange a viewing?"},
  {label:'✅ Available',text:"Yes, this property is currently available. I'd be happy to arrange a viewing at a time that suits you."},
  {label:'❌ No longer available',text:"Thank you for your interest — this unit has just been taken. I'll gladly let you know when a similar unit becomes available."},
  {label:'📅 Confirm viewing',text:"Noted — I'll confirm the time and send you the exact location shortly before we meet."},
  {label:'📍 Share location',text:"For security, I'll share the exact pin location once we've confirmed a viewing time."},
  {label:'💰 Pricing & terms',text:"The price shown is as listed. To secure the unit, we typically require a deposit plus the first month's rent — happy to walk you through the full breakdown."},
  {label:'📄 What you\'ll need',text:"To proceed, we'll need a copy of your ID and your intended move-in date. I can send the full checklist whenever you're ready."},
  {label:'🔑 Move-in process',text:"Once the deposit is confirmed, we'll schedule a walkthrough together and hand over the keys."},
  {label:'🛠 House rules & maintenance',text:"Happy to share the house rules and how maintenance requests are handled — just let me know if you'd like the details."},
  {label:'🕒 Apologies for the delay',text:"Apologies for the delayed reply — following up on your enquiry now. Thank you for your patience."},
  {label:'🙏 Checking in',text:"Just checking in — are you still considering this property? Happy to answer any remaining questions."},
  {label:'🤝 Thank you',text:"Thank you for reaching out and for your interest in this property — it was a pleasure assisting you."},
];

function toggleQuickReplyBarOld(){
  const bar=document.getElementById('chat-quickreply-bar');
  if(!bar)return;
  const show=bar.style.display==='none';
  if(show){
    bar.innerHTML=QUICK_REPLIES.map((q,i)=>`<div class="qr-chip" onclick="insertQuickReply(${i})">${escHtml(q.label)}</div>`).join('');
  }
  bar.style.display=show?'flex':'none';
}
function insertQuickReplyOld(i){
  const q=QUICK_REPLIES[i];if(!q)return;
  const input=document.getElementById('chat-reply-input');
  if(!input)return;
  input.value=q.text;
  autoResizeTextarea(input);
  input.focus();
  document.getElementById('chat-quickreply-bar').style.display='none';
}
function renderThreadList(){
  const q=(document.getElementById('thread-search-input')?.value||'').toLowerCase();
  let filtered=threads;
  if(threadListingFilter)filtered=filtered.filter(t=>t.listing_id===threadListingFilter);
  if(q)filtered=filtered.filter(t=>t.buyer_name.toLowerCase().includes(q)||t.listing_title.toLowerCase().includes(q)||t.messages.some(m=>(m.content||m.message||'').toLowerCase().includes(q)));
  const chipWrap=document.getElementById('thread-filter-chip');
  if(chipWrap){if(threadListingFilter){const l=allListings.find(l=>l.id===threadListingFilter);chipWrap.style.display='block';chipWrap.innerHTML=`<span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;background:var(--green-light);color:var(--green-dark);padding:4px 10px;border-radius:20px">Filtered: ${escHtml(l?.title||'listing')}<span style="cursor:pointer;font-weight:700" onclick="showAllMessages()">×</span></span>`;}else{chipWrap.style.display='none';chipWrap.innerHTML='';}}
  document.getElementById('msg-thread-count').textContent=`${filtered.length} conversation${filtered.length!==1?'s':''}`;
  const el=document.getElementById('thread-items');
  if(!filtered.length){el.innerHTML=`<div style="padding:40px 20px;text-align:center;color:var(--text-3);font-size:13px">${q||threadListingFilter?'No matching conversations.':'No messages yet. When buyers contact you, conversations appear here.'}</div>`;return;}
  el.innerHTML=filtered.map(t=>{const lm=t.messages[t.messages.length-1];const prev=lm?(lm.sender==='seller'?'You: ':'')+(lm.content||lm.message||''):'';const ini=escHtml(t.buyer_name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()||'?');const isA=activeThread&&activeThread.key===t.key;const isU=(t.unread_count||0)>0;return `<div class="thread-item${isA?' active':''}${isU?' unread':''}" onclick="openThread(this.dataset.key)" data-key="${escAttr(t.key)}" role="button" tabindex="0" aria-label="Conversation with ${escAttr(t.buyer_name)}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}"><div class="thread-avatar">${ini}</div><div class="thread-meta"><div class="thread-name">${escHtml(t.buyer_name)}</div><div class="thread-listing-ref">${escHtml(t.listing_title)}${t.listing_area?' · '+escHtml(t.listing_area):''}</div><div class="thread-preview">${escHtml(prev)}</div></div><div class="thread-time">${timeAgo(t.last_at)}</div></div>`;}).join('');
}

/* ── Presence: seller online across the WHOLE dashboard, not just an open
   thread — a seller browsing Overview/Listings/etc should still show
   buyers as "Online now". We join a presence channel for every listing
   the seller owns as soon as the dashboard loads, and keep all of them
   joined for the session. Typing indicators still only matter for
   whichever thread is actually open in Messages, so those stay
   thread-scoped. Mirrors the "seller-<id>" key inbox.html/global-chat-
   widget.js already listen for on presence-<listingId>. ── */
let dashPresenceChannels={}; // listingId -> channel
let dashBuyerOnlineByListing={}; // listingId -> bool, updated on every presence sync
let dashTypingTimeout=null, dashLastTypingSentAt=0;

function dashSetPresenceUI(state){
  const dot=document.getElementById('chat-presence-dot'), txt=document.getElementById('chat-presence-text');
  if(!dot||!txt)return;
  if(state==='online'){dot.style.background='#2ecc71';txt.textContent='Buyer online now';}
  else{dot.style.background='#9a9a94';txt.textContent='Buyer offline';}
}
function dashShowTypingIndicator(){
  const txt=document.getElementById('chat-presence-text'), dot=document.getElementById('chat-presence-dot');
  if(!txt)return;
  txt.textContent='Buyer is typing…';dot.style.background='#F0B429';
  clearTimeout(dashTypingTimeout);
  dashTypingTimeout=setTimeout(()=>{
    const online=activeThread&&dashBuyerOnlineByListing[activeThread.listing_id];
    dashSetPresenceUI(online?'online':'offline');
  },2500);
}
function dashBroadcastTyping(){
  if(!activeThread)return;
  const ch=dashPresenceChannels[activeThread.listing_id];
  if(!ch)return;
  const now=Date.now();
  if(now-dashLastTypingSentAt<2000)return;
  dashLastTypingSentAt=now;
  ch.send({type:'broadcast',event:'typing',payload:{from:'seller'}});
}
function dashJoinPresenceForListing(listingId){
  if(dashPresenceChannels[listingId])return; // already joined this session
  const ch=db.channel(`presence-${listingId}`,{config:{presence:{key:'seller-'+(effectiveSellerId||currentUser.id)}}});
  ch.on('presence',{event:'sync'},()=>{
    const online=Object.keys(ch.presenceState()).some(k=>k.startsWith('buyer-'));
    dashBuyerOnlineByListing[listingId]=online;
    if(activeThread&&String(activeThread.listing_id)===String(listingId)){
      dashSetPresenceUI(online?'online':'offline');
    }
  }).on('broadcast',{event:'typing'},({payload})=>{
    if(payload?.from==='buyer'&&activeThread&&String(activeThread.listing_id)===String(listingId))dashShowTypingIndicator();
  }).subscribe(async(status)=>{if(status==='SUBSCRIBED')await ch.track({online:true,at:Date.now()});});
  dashPresenceChannels[listingId]=ch;
}
// Called once per session (after listings load) and again any time a new
// listing shows up, so a freshly posted listing gets presence coverage too.
function dashJoinAllPresence(){
  (allListings||[]).forEach(l=>dashJoinPresenceForListing(l.id));
}
function dashLeaveAllPresence(){
  Object.values(dashPresenceChannels).forEach(ch=>db.removeChannel(ch));
  dashPresenceChannels={};dashBuyerOnlineByListing={};
  clearTimeout(dashTypingTimeout);
}

async function openThread(key){
  activeThread=threads.find(t=>t.key===key)||null;
  if(!activeThread)return;
  renderThreadList();
  renderChatPane(activeThread);
  await loadFullThreadHistory(activeThread);
  renderChatPane(activeThread);
  markThreadRead(activeThread).then(()=>renderThreadList());
  showChatMobile();
  dashJoinPresenceForListing(activeThread.listing_id); // no-ops if already joined
  dashSetPresenceUI(dashBuyerOnlineByListing[activeThread.listing_id]?'online':'offline');
}

// The bulk preload only covers the last MSG_HISTORY_DAYS days for speed.
// A thread that started earlier than that but has recent activity (which
// is why it's visible at all) would otherwise show a gap between the
// original enquiry and the newest reply. Backfill it the moment it's opened.
async function loadFullThreadHistory(t){
  if(!t)return;
  let q=db.from('messages').select('*').eq('listing_id',t.listing_id).order('created_at',{ascending:true});
  q = t.buyer_phone ? q.eq('buyer_phone',t.buyer_phone) : (t.buyer_token ? q.eq('buyer_token',t.buyer_token) : null);
  if(!q)return;
  const{data,error}=await q;
  if(error||!data)return;
  data.forEach(m=>{ if(!allMessages.some(x=>x.id===m.id)) allMessages.push(m); });
  buildThreads();
  const refreshed=threads.find(x=>x.key===t.key);
  if(refreshed)activeThread=refreshed;
}

function renderChatPane(t){
  document.getElementById('chat-empty').style.display='none';
  const av=document.getElementById('chat-active');av.style.display='flex';
  const qrBar=document.getElementById('chat-quickreply-bar');if(qrBar)qrBar.style.display='none';
  const ini=escHtml(t.buyer_name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()||'?');
  const waLink=t.buyer_phone?`<a href="https://wa.me/${formatWaPhone(t.buyer_phone)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="background:#25D366;color:white;text-decoration:none">WhatsApp</a>`:'';
  const listing=allListings.find(l=>l.id===t.listing_id);
  const liveLink=listing?`<a href="/listing?id=${encodeURIComponent(String(listing.listing_number).padStart(6,'0'))}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm" style="text-decoration:none">View listing</a>`:'';
  document.getElementById('chat-header').innerHTML=`<button class="mobile-back-btn" onclick="showThreadListMobile()"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button><div class="chat-header-avatar">${ini}</div><div class="chat-header-info"><div class="chat-header-name">${escHtml(t.buyer_name)}</div><div class="chat-header-sub" title="${escAttr(t.listing_title)}">${escHtml(t.buyer_phone||'No phone')} · Re: ${escHtml(truncateWords(t.listing_title,6))}</div><div style="font-size:11px;color:var(--text-3);display:flex;align-items:center;gap:5px;margin-top:2px"><span id="chat-presence-dot" style="width:6px;height:6px;border-radius:50%;background:#9a9a94;flex-shrink:0"></span><span id="chat-presence-text">Buyer offline</span></div></div><div class="chat-header-actions">${waLink}${liveLink}</div>`;
  document.getElementById('chat-wa-hint').innerHTML=t.buyer_phone?"Your reply appears in the buyer's chat. Use the WhatsApp button above to message them directly.":'Buyer will see your reply when they revisit the listing.';
  renderChatMessages(t);
  setTimeout(()=>{const mc=document.getElementById('chat-messages');mc.scrollTop=mc.scrollHeight;},50);
  dashSetPresenceUI(dashBuyerOnlineByListing[t.listing_id]?'online':'offline');
}

function renderChatMessages(t){
  const mc=document.getElementById('chat-messages');
  if(!t.messages.length){mc.innerHTML='<div style="text-align:center;color:var(--text-3);font-size:13px;padding:20px">No messages yet</div>';return;}
  let lastDate='';
  const sn=currentProfile?.full_name||currentUser?.email?.split('@')[0]||'You';
  const si=sn.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()||'S';
  const bi=t.buyer_name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()||'?';
  let lastSender=null,lastTime=0;
mc.innerHTML=t.messages.map(m=>{
  const md=new Date(m.created_at).toLocaleDateString('en-KE',{weekday:'long',day:'numeric',month:'long'});
  const dd=md!==lastDate?`<div class="chat-date-divider"><span>${md}</span></div>`:'';
  if(md!==lastDate)lastSender=null;
  lastDate=md;
  const isSeller=m.sender==='seller';
  const ts=new Date(m.created_at).getTime();
  const grouped = isSeller===lastSender && (ts-lastTime) < 120000; // same sender, <2min apart
  lastSender=isSeller;lastTime=ts;
  const time=new Date(m.created_at).toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'});
  const isRead=!!m.read_at;
  const tick=isSeller?`<svg class="tick ${isRead?'read':''}" viewBox="0 0 24 24" fill="none" stroke-width="2"><polyline points="1 13 6 18 15 7"/><polyline points="8 13 13 18 22 7"/></svg>`:'';
  return `${dd}<div class="chat-bubble-row ${isSeller?'seller':''} ${grouped?'grouped':'group-start'}"><div class="bubble-avatar ${isSeller?'seller-av':'buyer'}">${isSeller?si:bi}</div><div class="bubble-wrap"><div class="chat-bubble ${isSeller?'seller-b':'buyer'}" onclick="copyBubbleText(this)" title="Click to copy">${escHtml(m.content||m.message||'')}</div><div class="bubble-time">${time}${tick}</div></div></div>`;
}).join('');
}

async function sendChatReply(){
  if(!activeThread)return;
  const input=document.getElementById('chat-reply-input');const text=input.value.trim();if(!text)return;
  const btn=document.getElementById('chat-send-btn');btn.disabled=true;
  const nm={listing_id:activeThread.listing_id,buyer_token:activeThread.buyer_token||null,buyer_name:activeThread.buyer_name,buyer_phone:activeThread.buyer_phone||null,sender:'seller',content:text};
  const{data,error}=await db.from('messages').insert(nm).select().single();
  btn.disabled=false;
  if(error){
    showToast('Message failed to send — tap to retry','error');
    input.value=text; // restore so nothing is lost
    autoResizeTextarea(input);
    return;
  }
  allMessages.push(data);
  buildThreads();activeThread=threads.find(t=>t.key===activeThread.key)||activeThread;
  input.value='';input.style.height='auto';renderChatMessages(activeThread);renderThreadList();
  notifyBuyerIfOffline(activeThread.buyer_token, activeThread.listing_title, text);
  setTimeout(()=>{const mc=document.getElementById('chat-messages');mc.scrollTop=mc.scrollHeight;},30);
}

function handleChatKeydown(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChatReply();}}
function autoResizeTextarea(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,140)+'px';}

async function markThreadRead(t){
  if(!t.unread_count)return;
  // Optimistic: clear the badge locally right away so it never "hangs" on
  // screen even if the network write is slow — we reconcile below regardless.
  t.unread_count=0;
  updateNavBadges();renderThreadList();

  // Pull ids straight from THIS thread's own message list — the exact same
  // list that produced the unread count — instead of re-filtering allEnquiries
  // by buyer_phone/buyer_token, which silently misses rows whenever a phone
  // number is formatted differently anywhere (spaces, +254 vs 0, etc).
  const eIds=t.messages.filter(m=>m.sender==='buyer'&&!m.read_at&&m.enquiry_id!=null).map(m=>m.enquiry_id);
  const uIds=t.messages.filter(m=>m.sender==='buyer'&&!m.read_at&&m.enquiry_id==null).map(m=>m.id);

  let markReadFailed=false;
  if(eIds.length){const{error:eErr}=await db.from('enquiries').update({read_at:new Date().toISOString()}).in('id',eIds);if(eErr){console.error('markThreadRead enquiries update failed:',eErr);markReadFailed=true;}else{eIds.forEach(id=>{const e=allEnquiries.find(e=>e.id===id);if(e)e.read_at=new Date().toISOString();});}}
  if(uIds.length){const{error:mErr}=await db.from('messages').update({read_at:new Date().toISOString()}).in('id',uIds);if(mErr){console.error('markThreadRead messages update failed:',mErr);markReadFailed=true;}else{uIds.forEach(id=>{const m=allMessages.find(m=>m.id===id);if(m)m.read_at=new Date().toISOString();});}}
  if(markReadFailed){showToast('Could not mark as read — check database permissions','error');t.unread_count=eIds.length+uIds.length;}
  buildThreads();
  if(activeThread&&activeThread.key===t.key){activeThread=threads.find(x=>x.key===t.key)||activeThread;}
  updateNavBadges();renderThreadList();
}

// ── Mark all read / unread — the header button toggles between these
// depending on whether anything is currently unread (see updateMarkAllBtn). ──
async function markAllThreadsRead(){
  const unreadThreads=threads.filter(t=>(t.unread_count||0)>0);
  if(!unreadThreads.length){showToast('No unread messages','success');return;}
  const btn=document.getElementById('btn-mark-all-read');
  if(btn){btn.disabled=true;btn.textContent='Marking…';}
  unreadThreads.forEach(t=>t.unread_count=0); // optimistic clear
  updateNavBadges();renderThreadList();

  const eIds=[],mIds=[];
  unreadThreads.forEach(t=>{
    t.messages.filter(m=>m.sender==='buyer'&&!m.read_at&&m.enquiry_id!=null).forEach(m=>eIds.push(m.enquiry_id));
    t.messages.filter(m=>m.sender==='buyer'&&!m.read_at&&m.enquiry_id==null).forEach(m=>mIds.push(m.id));
  });

  let markAllFailed=false;
  if(eIds.length){const{error}=await db.from('enquiries').update({read_at:new Date().toISOString()}).in('id',eIds);if(error){console.error('markAllThreadsRead enquiries update failed:',error);markAllFailed=true;}else{eIds.forEach(id=>{const e=allEnquiries.find(e=>e.id===id);if(e)e.read_at=new Date().toISOString();});}}
  if(mIds.length){const{error}=await db.from('messages').update({read_at:new Date().toISOString()}).in('id',mIds);if(error){console.error('markAllThreadsRead messages update failed:',error);markAllFailed=true;}else{mIds.forEach(id=>{const m=allMessages.find(m=>m.id===id);if(m)m.read_at=new Date().toISOString();});}}

  buildThreads();
  if(activeThread){activeThread=threads.find(x=>x.key===activeThread.key)||activeThread;}
  updateNavBadges();renderThreadList();
  if(markAllFailed){showToast('Some messages could not be marked read — check database permissions','error');}else{showToast('All conversations marked as read ✓','success');}
}

async function markAllThreadsUnread(){
  if(!threads.length){showToast('No conversations yet','error');return;}
  if(!await lcConfirm({title:'Mark all as unread?',message:'Every conversation will be marked unread again.',confirmLabel:'Mark unread'}))return;
  const btn=document.getElementById('btn-mark-all-read');
  if(btn){btn.disabled=true;btn.textContent='Updating…';}

  const eIds=allEnquiries.filter(e=>e.read_at).map(e=>e.id);
  const mIds=allMessages.filter(m=>m.sender==='buyer'&&m.read_at).map(m=>m.id);

  if(eIds.length)await db.from('enquiries').update({read_at:null}).in('id',eIds);
  if(mIds.length)await db.from('messages').update({read_at:null}).in('id',mIds);
  eIds.forEach(id=>{const e=allEnquiries.find(e=>e.id===id);if(e)e.read_at=null;});
  mIds.forEach(id=>{const m=allMessages.find(m=>m.id===id);if(m)m.read_at=null;});

  buildThreads();
  if(activeThread){activeThread=threads.find(x=>x.key===activeThread.key)||activeThread;}
  updateNavBadges();renderThreadList();
  showToast('All conversations marked as unread','success');
}

function updateMarkAllBtn(){
  const btn=document.getElementById('btn-mark-all-read');
  if(!btn)return;
  const totalUnread=threads.reduce((s,t)=>s+(t.unread_count||0),0);
  btn.style.display=totalUnread>0?'':'none';
  btn.textContent='Mark all read';
  btn.onclick=markAllThreadsRead;
  btn.disabled=false;
}
function filterEnquiries(f,el){enquiryFilter=f;document.querySelectorAll('#page-enquiries .filter-pill').forEach(p=>p.classList.remove('active'));el.classList.add('active');renderEnquiries();}

function buildEnquiryFeed(){
  return threads.map(t=>{const buyerMsgs=t.messages.filter(m=>m.sender==='buyer');if(!buyerMsgs.length)return null;const last=buyerMsgs[buyerMsgs.length-1];return{key:t.key,buyer_name:t.buyer_name,buyer_phone:t.buyer_phone,listing_title:t.listing_title,listing_area:t.listing_area,message:last.content||last.message||'',created_at:last.created_at,unread:buyerMsgs.some(m=>!m.read_at)};}).filter(Boolean).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
}

function computeEnquiryStats(){
  const total=threads.filter(t=>t.messages.some(m=>m.sender==='buyer')).length;
  const unread=threads.reduce((s,t)=>s+(t.unread_count||0),0);
  const replied=threads.filter(t=>t.messages.some(m=>m.sender==='seller')).length;
  const responseRate=total?Math.round((replied/total)*100):0;
  let totalGapMs=0,gapCount=0;
  threads.forEach(t=>{
    const msgs=t.messages;
    for(let i=0;i<msgs.length;i++){
      if(msgs[i].sender==='buyer'){
        const next=msgs.slice(i+1).find(m=>m.sender==='seller');
        if(next){totalGapMs+=(new Date(next.created_at)-new Date(msgs[i].created_at));gapCount++;break;}
      }
    }
  });
  const avgMins=gapCount?Math.round(totalGapMs/gapCount/60000):null;
  const avgLabel=avgMins===null?'—':avgMins<60?`${avgMins}m`:avgMins<1440?`${Math.round(avgMins/60)}h`:`${Math.round(avgMins/1440)}d`;
  return{total,unread,responseRate,avgLabel};
}
function renderEnquiryStats(){
  const el=document.getElementById('enquiries-stat-strip');
  if(!el)return;
  const s=computeEnquiryStats();
  el.innerHTML=`
    <div class="es-item"><div class="es-label">Total enquiries</div><div class="es-val">${s.total}</div></div>
    <div class="es-item"><div class="es-label">Unread</div><div class="es-val" style="color:${s.unread>0?'var(--red)':'var(--text)'}">${s.unread}</div></div>
    <div class="es-item"><div class="es-label">Response rate</div><div class="es-val" style="color:${s.responseRate>=70?'#065f46':s.responseRate>=40?'var(--amber)':'var(--red)'}">${s.responseRate}%</div></div>
    <div class="es-item"><div class="es-label">Avg. response time</div><div class="es-val">${s.avgLabel}</div></div>`;
}

function renderEnquiries(){
  renderEnquiryStats();
  let items=buildEnquiryFeed();
  if(enquiryFilter==='unread')items=items.filter(i=>i.unread);
  const q=(document.getElementById('enquiry-search')?.value||'').toLowerCase();
  if(q)items=items.filter(i=>(i.buyer_name||'').toLowerCase().includes(q)||(i.listing_title||'').toLowerCase().includes(q)||(i.listing_area||'').toLowerCase().includes(q));
  const el=document.getElementById('enquiry-list');
  if(!items.length){el.innerHTML=`<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13"/></svg><h3>${enquiryFilter==='unread'?'All caught up!':'No enquiries yet'}</h3><p>${enquiryFilter==='unread'?'No unread messages.':"When buyers message you, they'll appear here."}</p></div>`;return;}
  el.innerHTML=items.map(i=>{
    const ini=escHtml((i.buyer_name||'B').split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase());
    return `<div class="enquiry-card${i.unread?' unread':''}">
      <div class="enquiry-avatar">${ini}</div>
      <div class="enquiry-body">
        <div class="enquiry-head">
          <span class="enquiry-name">${escHtml(i.buyer_name||'Unknown buyer')}</span>
          ${i.unread?'<span class="enquiry-new-badge">New</span>':''}
          <span class="enquiry-phone">${escHtml(i.buyer_phone||'')}</span>
          <span class="enquiry-time">${timeAgo(i.created_at)}</span>
        </div>
        <div class="enquiry-listing-ref">${escHtml(i.listing_title||'Listing')}${i.listing_area?' · '+escHtml(i.listing_area):''}</div>
        <div class="enquiry-msg">${escHtml(i.message||'')}</div>
        <div class="enquiry-actions">
          <button class="btn btn-primary btn-sm" data-key="${escAttr(i.key)}" onclick="openConversationFromThread(this.dataset.key)"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>Open conversation</button>
          ${i.buyer_phone?`<a class="btn btn-sm" style="background:#25D366;color:white" href="https://wa.me/${formatWaPhone(i.buyer_phone)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`:''}
          ${i.unread?`<button class="btn btn-outline btn-sm" data-key="${escAttr(i.key)}" onclick="markEnqThreadRead(this.dataset.key)">Mark read</button>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function formatWaPhone(p){
  const clean=String(p||'').replace(/\D/g,'');
  if(/^0[17]\d{8}$/.test(clean)) return '254'+clean.slice(1);
  if(/^[17]\d{8}$/.test(clean)) return '254'+clean;
  return clean;
}
async function markEnqThreadRead(key){const t=threads.find(x=>x.key===key);if(!t)return;await markThreadRead(t);renderEnquiries();}
function sendReply(){const text=document.getElementById('reply-text').value.trim();if(!text){showToast('Please type a reply first','error');return;}if(replyTargetEnquiry?.buyer_phone){window.open(`https://wa.me/${formatWaPhone(replyTargetEnquiry.buyer_phone)}?text=${encodeURIComponent(text)}`,'_blank','noopener,noreferrer');}else{showToast('No phone number available','error');return;}closeModal('modal-reply');showToast('Opened WhatsApp with your reply','success');}

/* ══════════════════════════════════════
   REVIEWS — seller-facing view + response
══════════════════════════════════════ */
function starsHtml(n){
  return [1,2,3,4,5].map(i=>`<svg viewBox="0 0 24 24" width="14" height="14" style="${i<=n?'fill:var(--gold);stroke:var(--gold)':'fill:none;stroke:var(--border)'};stroke-width:1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`).join('');
}

function renderReviews(){
  const el=document.getElementById('reviews-list');
  const summary=document.getElementById('reviews-summary');
  if(!allReviews.length){
    el.innerHTML=`<div class="empty-state"><svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg><h3>No reviews yet</h3><p>When a buyer reviews you after contacting about a listing, it appears here.</p><button class="btn btn-primary" onclick="showPage('listings')">View my listings</button></div>`;
    summary.textContent='';
    return;
  }
  const avg=(allReviews.reduce((s,r)=>s+r.rating,0)/allReviews.length).toFixed(1);
  summary.textContent=`${avg} average · ${allReviews.length} review${allReviews.length!==1?'s':''}`;
  el.innerHTML=allReviews.map(r=>{
    const ini=escHtml((r.reviewer_name||'B').split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase());
    const hasResponse=!!r.response_text;
    return `<div class="enquiry-card">
      <div class="enquiry-avatar">${ini}</div>
      <div class="enquiry-body">
        <div class="enquiry-head"><span class="enquiry-name">${escHtml(r.reviewer_name||'Anonymous buyer')}</span><span class="enquiry-time">${timeAgo(r.created_at)}</span></div>
        <div style="margin-bottom:6px">${starsHtml(r.rating)}</div>
        ${r.listings?.title?`<div class="enquiry-listing-ref">Re: ${escHtml(r.listings.title)}</div>`:''}
        <div class="enquiry-msg">${escHtml(r.comment||'(No comment left — rating only)')}</div>
        <div id="review-response-${r.id}" style="margin-top:12px">
          ${hasResponse
            ? `<div style="background:var(--green-light);border-radius:8px;padding:10px 12px;font-size:13px;color:var(--green-dark)"><strong>Your response${r.status==='published'?' (live on pricing page)':' (awaiting admin publish)'}:</strong> ${escHtml(r.response_text)}</div>
               <button class="btn btn-outline btn-sm" style="margin-top:8px" onclick="openReviewResponseEditor('${r.id}')">Edit response</button>`
            : `<button class="btn btn-primary btn-sm" onclick="openReviewResponseEditor('${r.id}')">Respond</button>`}
        </div>
        <div id="review-editor-${r.id}" style="display:none;margin-top:10px">
          <textarea id="review-textarea-${r.id}" placeholder="Thank the buyer or address their feedback… this will be shown publicly on our pricing page" style="width:100%;min-height:80px;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-family:inherit;resize:vertical">${escHtml(r.response_text||'')}</textarea>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn btn-primary btn-sm" onclick="submitReviewResponse('${r.id}')">Post response</button>
            <button class="btn btn-outline btn-sm" onclick="closeReviewResponseEditor('${r.id}')">Cancel</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function openReviewResponseEditor(id){
  document.getElementById('review-response-'+id).style.display='none';
  document.getElementById('review-editor-'+id).style.display='block';
}
function closeReviewResponseEditor(id){
  document.getElementById('review-editor-'+id).style.display='none';
  document.getElementById('review-response-'+id).style.display='block';
}
async function submitReviewResponse(id){
  const text=document.getElementById('review-textarea-'+id).value.trim();
  if(!text){showToast('Please write a response first','error');return;}
  const{error}=await db.from('reviews').update({response_text:text,responded_by:currentUser.id,responded_at:new Date().toISOString(),status:'published'}).eq('id',id);
  if(error){showToast('Could not save response: '+error.message,'error');return;}
  const idx=allReviews.findIndex(r=>r.id===id);
  if(idx!==-1){allReviews[idx].response_text=text;allReviews[idx].status='published';}
  renderReviews();updateNavBadges();
  showToast('Response posted — now visible on the pricing page ✓','success');
  const rv=allReviews[idx];
  if(rv)notifyAdmin('review_response',{listingTitle:rv.listings?.title||'',reviewerName:rv.reviewer_name,sellerName:currentProfile?.full_name||currentUser?.email,sellerEmail:currentUser?.email,responseText:text});
}

function paymentsInDateRange(){
  const from=document.getElementById('pay-date-from')?.value;
  const to=document.getElementById('pay-date-to')?.value;
  if(!from&&!to)return allPayments;
  return allPayments.filter(p=>{
    const d=new Date(p.created_at);
    if(from&&d<new Date(from+'T00:00:00'))return false;
    if(to&&d>new Date(to+'T23:59:59'))return false;
    return true;
  });
}
function renderPayments(){
  const rows=paymentsInDateRange();
  const paid=rows.filter(p=>p.status==='confirmed'||p.status==='paid');
  const total=paid.reduce((s,p)=>s+(Number(p.amount)||0),0);
  const pending=rows.filter(p=>p.status==='pending'||p.status==='pending_verification');
  document.getElementById('payment-summary').innerHTML=[{label:'Total collected',val:`KES ${total.toLocaleString('en-KE')}`,sub:`${paid.length} confirmed payment${paid.length!==1?'s':''}`,color:'var(--green)'},{label:'Pending',val:pending.length,sub:'awaiting confirmation',color:'var(--amber)'},{label:'Avg per listing',val:paid.length?`KES ${Math.round(total/paid.length).toLocaleString('en-KE')}`:'—',sub:'listing fee',color:'var(--text-3)'}].map(s=>`<div class="card" style="padding:18px 20px"><div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:8px">${s.label}</div><div style="font-size:24px;font-weight:700;color:${s.color};margin-bottom:4px">${s.val}</div><div style="font-size:12px;color:var(--text-3)">${s.sub}</div></div>`).join('');
  const tbody=document.getElementById('payments-tbody');
  if(!rows.length){tbody.innerHTML=`<tr><td colspan="6"><div class="empty-state"><svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg><h3>No payments${allPayments.length?' in this range':' yet'}</h3><p>${allPayments.length?'Try clearing the date filter.':'When you pay the listing fee, your payment history appears here.'}</p></div></td></tr>`;return;}
  tbody.innerHTML=rows.map(p=>{const date=new Date(p.created_at).toLocaleDateString('en-KE',{day:'numeric',month:'short',year:'numeric'});const isPaid=p.status==='confirmed'||p.status==='paid';const isPending=p.status==='pending'||p.status==='pending_verification';return `<tr><td style="color:var(--text-2)">${date}</td><td style="font-weight:500">${escHtml(p.listings?.title||'—')}</td><td><span class="pay-ref">${escHtml(p.reference||p.mpesa_ref||'—')}</span></td><td style="font-weight:700;color:var(--green-dark)">KES ${Number(p.amount||0).toLocaleString('en-KE')}</td><td><span class="pay-status ${isPaid?'paid':isPending?'pending':'failed'}">${isPaid?'✓ Paid':isPending?'⏳ Pending':'✕ Failed'}</span></td><td>${isPaid?`<button class="btn btn-outline btn-sm" onclick="openReceiptModal('${p.id}')">Receipt</button>`:'—'}</td></tr>`;}).join('');
}
function exportSellerPaymentsCSV(){
  const rows=paymentsInDateRange();
  if(!rows.length){showToast('No payments to export','error');return;}
  const csvRows=[['Date','Listing','Reference','Amount (KES)','Status']];
  rows.forEach(p=>{
    const isPaid=p.status==='confirmed'||p.status==='paid';
    csvRows.push([new Date(p.created_at).toLocaleDateString('en-KE'),p.listings?.title||'—',p.reference||p.mpesa_ref||'—',Number(p.amount||0),isPaid?'Paid':(p.status||'pending')]);
  });
  const csv=csvRows.map(r=>r.map(v=>csvCell(v)).join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`Nyumba254-Payments-${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  showToast('CSV exported ✓','success');
}

let receiptTarget=null;
function openReceiptModal(id){const p=allPayments.find(x=>String(x.id)===String(id));if(!p)return;receiptTarget=p;const isPaid=p.status==='confirmed'||p.status==='paid';document.getElementById('rcpt-number').textContent='NK-'+String(p.id).slice(0,8).toUpperCase();document.getElementById('rcpt-date').textContent=new Date(p.created_at).toLocaleDateString('en-KE',{day:'numeric',month:'long',year:'numeric'});document.getElementById('rcpt-seller').textContent=currentProfile?.full_name||currentUser?.email||'—';document.getElementById('rcpt-listing').textContent=p.listings?.title||'—';document.getElementById('rcpt-method').textContent=(p.method||'—').toUpperCase();document.getElementById('rcpt-ref').textContent=p.reference||p.mpesa_ref||'—';document.getElementById('rcpt-status').textContent=isPaid?'Paid ✓':(p.status||'pending');document.getElementById('rcpt-amount').textContent=`KES ${Number(p.amount||0).toLocaleString('en-KE')}`;openModal('modal-receipt');}
function printReceipt(){window.print();}
async function downloadReceiptPDF(){
  if(!receiptTarget||!await ensurePdfLibrary())return;
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'mm',format:'a5'});
  const p=receiptTarget;
  const isPaid=p.status==='confirmed'||p.status==='paid';
  doc.setFont('helvetica','bold');doc.setFontSize(18);doc.setTextColor(8,80,65);
  doc.text('Nyumba254',74,20,{align:'center'});
  doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(120,120,120);
  doc.text('PAYMENT RECEIPT',74,27,{align:'center'});
  doc.setDrawColor(15,110,86);doc.line(15,32,133,32);
  let y=42;
  const row=(label,value)=>{
    doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(130,130,130);
    doc.text(label,15,y);doc.setFont('helvetica','bold');doc.setTextColor(26,26,24);
    doc.text(String(value),133,y,{align:'right'});y+=8;
  };
  row('Receipt No.','NK-'+String(p.id).slice(0,8).toUpperCase());
  row('Date',new Date(p.created_at).toLocaleDateString('en-KE',{day:'numeric',month:'long',year:'numeric'}));
  row('Billed to',currentProfile?.full_name||currentUser?.email||'—');
  row('Listing',p.listings?.title||'—');
  row('Payment method',(p.method||'—').toUpperCase());
  row('Reference',p.reference||p.mpesa_ref||'—');
  row('Status',isPaid?'Paid':(p.status||'pending'));
  doc.setDrawColor(224,222,216);doc.line(15,y,133,y);y+=10;
  doc.setFont('helvetica','bold');doc.setFontSize(14);doc.setTextColor(8,80,65);
  doc.text('Amount paid',15,y);doc.text(`KES ${Number(p.amount||0).toLocaleString('en-KE')}`,133,y,{align:'right'});
  y+=20;doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(150,150,150);
  doc.text('Thank you for using Nyumba254.',74,y,{align:'center'});
  doc.save(`Nyumba254-Receipt-${String(p.id).slice(0,8)}.pdf`);
}

/* ══════════════════════════════════════
   PRINTABLE BROCHURE — Premium/Elite
   ════════════════════════════════════════════════════
   Loads jsPDF on demand before generating.
   QR code is fetched as an image from api.qrserver.com
   (free, no key) and embedded as a data URL — no new
   client library needed.
══════════════════════════════════════ */
async function urlToDataURL(url){
  const res=await fetch(url);
  if(!res.ok)throw new Error('Fetch failed: '+res.status);
  const blob=await res.blob();
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>resolve(r.result);
    r.onerror=reject;
    r.readAsDataURL(blob);
  });
}

async function generateBrochure(id){
  if(!subscriptionInfo().active){showToast('Brochures are a Premium feature — upgrade to unlock.','error');return;}
  const l=allListings.find(x=>String(x.id)===String(id));
  if(!l){showToast('Listing not found','error');return;}
  if(!await ensurePdfLibrary())return;
  showToast('Generating brochure…','');
  try{
    const{jsPDF}=window.jspdf;
    const doc=new jsPDF({unit:'mm',format:'a4'});
    const pageW=210,margin=14;
    const isYearly=currentProfile?.subscription_tier==='yearly';

    doc.setFillColor(15,110,86);
    doc.rect(0,0,pageW,26,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(16);doc.setTextColor(255,255,255);
    doc.text(isYearly&&currentProfile?.full_name?currentProfile.full_name:'Nyumba254',margin,16);

    let y=34;
    const cover=(l.listing_photos||[]).find(p=>p.is_cover)||(l.listing_photos||[])[0];
    if(cover){
      try{
        const dataUrl=await urlToDataURL(cover.url);
        doc.addImage(dataUrl,'JPEG',margin,y,pageW-margin*2,88,undefined,'FAST');
        y+=96;
      }catch(e){console.error('Brochure image load failed:',e);}
    }

    doc.setTextColor(26,26,24);doc.setFont('helvetica','bold');doc.setFontSize(15);
    doc.text(l.title,margin,y);y+=8;

    doc.setFont('helvetica','normal');doc.setFontSize(11);doc.setTextColor(74,74,70);
    doc.text(`${l.area}${l.sub_area?', '+l.sub_area:''}`,margin,y);y+=8;

    doc.setFont('helvetica','bold');doc.setFontSize(16);doc.setTextColor(8,80,65);
    const hasUnitTypesQ=(l.listing_units&&l.listing_units.length>0);const priceTxt=hasUnitTypesQ?muPriceRangeText(l):`KES ${Number(l.price).toLocaleString('en-KE')}${l.price_type==='rent'?'/mo':''}`;
    doc.text(priceTxt,margin,y);y+=10;

    doc.setDrawColor(224,222,216);doc.line(margin,y,pageW-margin,y);y+=8;

    doc.setFont('helvetica','normal');doc.setFontSize(10.5);doc.setTextColor(74,74,70);
    const specs=[];
    if(!l.is_multi_unit){
      specs.push(`Bedrooms: ${l.bedrooms==0?'Studio':l.bedrooms}`);
      if(l.bathrooms)specs.push(`Bathrooms: ${l.bathrooms}`);
      if(l.size_sqm)specs.push(`Size: ${l.size_sqm} m²`);
    }
    specs.push(`Category: ${l.category}`);
    doc.text(specs.join('   ·   '),margin,y);y+=10;

    if(l.description){
      doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(74,74,70);
      const lines=doc.splitTextToSize(l.description,pageW-margin*2-40);
      doc.text(lines.slice(0,10),margin,y);
    }

    try{
      const listingUrl=`${location.origin}/listing?id=${String(l.listing_number).padStart(6,'0')}`;
      const qrUrl=`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(listingUrl)}`;
      const qrDataUrl=await urlToDataURL(qrUrl);
      doc.addImage(qrDataUrl,'PNG',pageW-margin-32,y-8,32,32);
      doc.setFontSize(8);doc.setTextColor(136,135,128);
      doc.text('Scan to view listing',pageW-margin-32,y+27);
    }catch(e){console.error('QR generation failed:',e);}

    doc.setFontSize(9);doc.setTextColor(136,135,128);
    doc.text(currentProfile?.full_name?`Contact: ${currentProfile.full_name}`:'Nyumba254',margin,285);

    doc.save(`${l.title.replace(/[^a-z0-9]+/gi,'-')}-brochure.pdf`);
    showToast('Brochure downloaded ✓','success');
  }catch(e){
    console.error('Brochure generation failed:',e);
    showToast('Could not generate brochure: '+e.message,'error');
  }
}

let viewingRequests=[];
function renderViewingRequestsPage(){
  const list=document.getElementById('viewings-list');
  if(!list)return;
  if(!viewingRequests.length){
    list.innerHTML='<div style="text-align:center;padding:40px;color:var(--text-3);font-size:13px">No viewing requests yet. New requests will appear here.</div>';
    return;
  }
  const statusLabels={pending:'New',confirmed:'Confirmed',done:'Done',cancelled:'Cancelled'};
  list.innerHTML=viewingRequests.map(request=>{
    const fee=request.fee_at_request==null?'Viewing fee: confirm with the lister':Number(request.fee_at_request)===0?'Free viewing':`Viewing fee: KES ${Number(request.fee_at_request).toLocaleString('en-KE')}`;
    const date=request.requested_date?new Date(`${request.requested_date}T00:00:00`).toLocaleDateString('en-KE',{weekday:'short',day:'numeric',month:'short',year:'numeric'}):'Date not provided';
    const actions=request.request_status==='pending'
      ?`<button type="button" class="btn btn-primary btn-sm" data-viewing-id="${escHtml(request.request_id)}" data-viewing-status="confirmed" style="min-height:44px">Confirm</button><button type="button" class="btn btn-outline btn-sm" data-viewing-id="${escHtml(request.request_id)}" data-viewing-status="cancelled" style="min-height:44px">Cancel</button>`
      :request.request_status==='confirmed'
        ?`<button type="button" class="btn btn-primary btn-sm" data-viewing-id="${escHtml(request.request_id)}" data-viewing-status="done" style="min-height:44px">Mark viewed</button><button type="button" class="btn btn-outline btn-sm" data-viewing-id="${escHtml(request.request_id)}" data-viewing-status="cancelled" style="min-height:44px">Cancel</button>`
        :'';
    return `<article class="card" style="padding:16px;margin-bottom:12px"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div style="min-width:0;flex:1"><strong>${escHtml(request.listing_title||'Property viewing')}</strong><div style="font-size:13px;color:var(--text-2);margin-top:5px">${escHtml(request.buyer_name||'Buyer')} · ${escHtml(request.buyer_phone||'No phone provided')}</div><div style="font-size:12px;color:var(--text-3);margin-top:5px">${escHtml(date)} · ${escHtml(request.requested_time||'Time not provided')}</div><div style="font-size:12px;font-weight:700;margin-top:7px">${escHtml(fee)}</div><div style="font-size:12px;color:var(--text-3);margin-top:4px">${request.fee_acknowledged?'Buyer acknowledged the fee':'No fee acknowledgement recorded'} · ${escHtml(statusLabels[request.request_status]||request.request_status||'Status unknown')}</div>${request.notes?`<p style="font-size:12px;color:var(--text-2);margin:8px 0 0;white-space:pre-wrap">${escHtml(request.notes)}</p>`:''}</div><div style="display:flex;gap:8px;flex-wrap:wrap">${actions}</div></div></article>`;
  }).join('');
}

async function loadViewingRequestsPage(silent=false){
  const status=document.getElementById('viewings-page-status');
  const page=document.getElementById('page-viewings');
  if(!silent&&page?.classList.contains('active'))status.textContent='Loading viewing requests…';
  const{data,error}=await db.rpc('get_seller_viewing_requests');
  if(error){
    console.error('[viewing-requests] Could not load viewing requests:',error);
    if(status)status.textContent='Viewing requests could not be loaded. Please refresh and try again.';
    return;
  }
  viewingRequests=Array.isArray(data)?data:[];
  const pending=viewingRequests.filter(item=>item.request_status==='pending').length;
  const badge=document.getElementById('nav-badge-viewings');
  if(badge){badge.textContent=String(pending);badge.style.display=pending?'':'none';}
  if(page?.classList.contains('active')){
    if(status)status.textContent=viewingRequests.length?`${viewingRequests.length} recent request${viewingRequests.length===1?'':'s'} · ${pending} new`:'';
    renderViewingRequestsPage();
  }
}

async function updateViewingRequestStatus(requestId,nextStatus){
  const request=viewingRequests.find(item=>item.request_id===requestId);
  if(!request)return;
  if(nextStatus==='cancelled'&&!window.confirm('Cancel this viewing request?'))return;
  const status=document.getElementById('viewings-page-status');
  if(status)status.textContent='Updating viewing request…';
  try{
    const{data,error}=await db.rpc('update_viewing_request_status',{p_request_id:requestId,p_status:nextStatus});
    if(error)throw new Error(error.message);
    const update=Array.isArray(data)?data[0]:data;
    if(!update)throw new Error('The viewing request status was not returned.');
    if(update.buyer_email){
      const{error:emailError}=await db.functions.invoke('send-notification-email',{body:{
        type:'viewing_request_status_update',
        buyerEmail:update.buyer_email,
        buyerName:update.buyer_name,
        listingId:request.listing_id,
        listingTitle:update.listing_title,
        status:update.request_status,
        requestedDate:update.requested_date,
        requestedTime:update.requested_time,
        feeAtRequest:update.fee_at_request
      }});
      if(emailError){
        console.error('[viewing-requests] Status changed but buyer email could not be sent:',emailError);
        showToast('Request updated, but the buyer email could not be sent.','error');
      }
    }
    await loadViewingRequestsPage();
    showToast(`Viewing request ${nextStatus==='done'?'marked done':nextStatus}.`,'success');
  }catch(error){
    console.error('[viewing-requests] Could not update viewing request:',error);
    if(status)status.textContent=error.message||'Could not update the viewing request.';
    showToast(error.message||'Could not update the viewing request.','error');
  }
}

document.getElementById('viewings-list')?.addEventListener('click',event=>{
  const button=event.target.closest('[data-viewing-id][data-viewing-status]');
  if(button)updateViewingRequestStatus(button.dataset.viewingId,button.dataset.viewingStatus);
});

const pageTitles={overview:'Overview',listings:'My listings',messages:'Messages',enquiries:'Enquiries',viewings:'Viewings',reviews:'Reviews',payments:'Payments',settings:'Settings','rent-ledger':'Rent & Tenant Ledger','demand-heatmap':'Demand Insights',notifications:'Notifications'};
function showPage(name){if(!document.getElementById('page-'+name))name='overview';sessionStorage.setItem('ny_last_page',name);if(!window.__navFromHash&&!document.getElementById('tour-overlay').classList.contains('open')&&location.hash!=='#'+name)history.pushState(null,'','#'+name);document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));document.querySelectorAll('.nav-item').forEach(n=>{n.classList.remove('active');n.removeAttribute('aria-current');});document.getElementById('page-'+name).classList.add('active');const navEl=document.getElementById('nav-'+name);if(navEl){navEl.classList.add('active');navEl.setAttribute('aria-current','page');}document.getElementById('topbar-title').textContent=pageTitles[name]||name;if(name==='overview')renderOverview();if(name==='listings')renderListingsTable();if(name==='messages'){showThreadListMobile();renderThreadList();}if(name==='enquiries')renderEnquiries();if(name==='viewings')loadViewingRequestsPage();if(name==='reviews')renderReviews();if(name==='payments')renderPayments();if(name==='rent-ledger'){ if(isBnbLedgerMode()) loadBnbLedger(); else loadRentalUnits(); }if(name==='demand-heatmap')loadDemandInsights();if(name==='notifications')renderNotificationsPage();closeSidebar();
  const scwFabEl=document.getElementById('scw-fab');
  if(scwFabEl){
    if(name==='messages'){
      scwFabEl.style.display='none';
      if(typeof scwOpen!=='undefined'&&scwOpen)scwToggle();
    }else{
      scwFabEl.style.display='';
    }
  }
}
function settingsJumpToOld(id){
  const el=document.getElementById(id);
  if(!el)return;
  el.scrollIntoView({behavior:'smooth',block:'start'});
  el.style.transition='box-shadow .3s';
  el.style.boxShadow='0 0 0 3px var(--green)';
  setTimeout(()=>{el.style.boxShadow='';},1500);
}
function toggleSidebar(){
  const isOpen=document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
  document.getElementById('hamburger-btn')?.setAttribute('aria-expanded',isOpen);
}
function openSidebar(){
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('open');
  document.getElementById('hamburger-btn')?.setAttribute('aria-expanded','true');
}
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
  document.getElementById('hamburger-btn')?.setAttribute('aria-expanded','false');
}
// Keeps the "Let's Chat" bubble from ever floating on top of a modal's
// buttons — especially on mobile where the bubble and the modal footer
// both sit bottom-right/bottom-center. Any open .modal-overlay or the
// onboarding tour hides the fab (and closes the chat panel if it was
// open); it reappears the instant everything closes.
function scwSyncOverlayVisibility(){
  const blocking = !!(
    document.querySelector('.modal-overlay.open') ||
    document.getElementById('tour-overlay')?.classList.contains('open') ||
    document.getElementById('rl-tour-overlay')?.classList.contains('open') ||
    document.getElementById('sidebar-overlay')?.classList.contains('open') ||
    document.getElementById('lc-sheet')?.classList.contains('open') ||
    document.getElementById('lc-menu')?.classList.contains('open') ||
    document.body.style.overflow === 'hidden'
  );
  const fab=document.getElementById('scw-fab');
  if(fab) fab.classList.toggle('scw-hidden', blocking);
  if(blocking && typeof scwOpen!=='undefined' && scwOpen){
    scwOpen=false;
    document.getElementById('scw-panel')?.classList.remove('open');
    document.getElementById('scw-overlay')?.classList.remove('open');
  }
}
const modalReturnFocus=new WeakMap();
function openModal(id){
  const overlay=document.getElementById(id);
  if(!overlay) throw new Error(`Modal not found: ${id}`);
  modalReturnFocus.set(overlay,document.activeElement);
  const heading=overlay.querySelector('.modal-head h3, .modal h1, .modal h2, .modal h3');
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  if(heading){
    if(!heading.id) heading.id=`${id}-title`;
    overlay.setAttribute('aria-labelledby',heading.id);
  }else{
    overlay.setAttribute('aria-label','Dialog');
  }
  overlay.tabIndex=-1;
  overlay.classList.add('open');
  document.body.style.overflow='hidden';
  scwSyncOverlayVisibility();
  requestAnimationFrame(()=>{
    const target=overlay.querySelector('[autofocus], [data-autofocus], .modal-close, input:not([type="hidden"]), select, textarea, button, a[href], [tabindex]:not([tabindex="-1"])')||overlay;
    target.focus();
  });
}
function closeModal(id){
  const overlay=document.getElementById(id);
  if(!overlay) throw new Error(`Modal not found: ${id}`);
  overlay.classList.remove('open');
  const openOverlays=document.querySelectorAll('.modal-overlay.open');
  document.body.style.overflow=openOverlays.length?'hidden':'';
  scwSyncOverlayVisibility();
  if(openOverlays.length){
    const target=openOverlays[openOverlays.length-1].querySelector('button, input:not([type="hidden"]), select, textarea, a[href], [tabindex]:not([tabindex="-1"])');
    target?.focus();
    return;
  }
  const returnFocus=modalReturnFocus.get(overlay);
  modalReturnFocus.delete(overlay);
  if(returnFocus?.isConnected) returnFocus.focus();
}

// Safety net: automatically re-checks visibility whenever ANY popup opens/closes,
// even ones added later that forget to call scwSyncOverlayVisibility() directly.
(function scwWatchOverlays(){
  const watchTargets=[document.body, document.getElementById('tour-overlay'), document.getElementById('rl-tour-overlay'), document.getElementById('sidebar-overlay'), document.getElementById('lc-sheet'), document.getElementById('lc-menu')];
  document.querySelectorAll('.modal-overlay').forEach(el=>watchTargets.push(el));
  const observer=new MutationObserver(()=>scwSyncOverlayVisibility());
  watchTargets.filter(Boolean).forEach(el=>observer.observe(el,{attributes:true,attributeFilter:['class','style']}));
})();
document.addEventListener('keydown',e=>{
  const openOverlays=document.querySelectorAll('.modal-overlay.open');
  if(e.key==='Tab'&&openOverlays.length){
    const overlay=openOverlays[openOverlays.length-1];
    const focusable=[...overlay.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el=>el.getClientRects().length);
    if(!focusable.length){e.preventDefault();overlay.focus();return;}
    const first=focusable[0],last=focusable[focusable.length-1];
    if(e.shiftKey&&(document.activeElement===first||!overlay.contains(document.activeElement))){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&(document.activeElement===last||!overlay.contains(document.activeElement))){e.preventDefault();first.focus();}
    return;
  }
  if(e.key==='Escape'){
    if(typeof lcConfirmResolver!=='undefined'&&lcConfirmResolver){lcConfirmResolve(false);return;}
    if(openOverlays.length){closeModal(openOverlays[openOverlays.length-1].id);return;}
    if(document.getElementById('sidebar')?.classList.contains('open')){closeSidebar();document.getElementById('hamburger-btn')?.focus();}
  }
});
document.querySelectorAll('.modal-overlay').forEach(ov=>ov.addEventListener('click',e=>{if(e.target===ov)closeModal(ov.id);}));
async function doSignOut(){
  try{
    const{error}=await db.auth.signOut();
    if(error) throw error;
  }catch(error){
    console.error('Sign out failed:',error);
    showToast('Could not sign out. Please try again.','error');
    return;
  }
  clearInterval(msgPollTimer);clearInterval(listingStatusPollTimer);clearInterval(notifPollTimer);document.removeEventListener('visibilitychange',handleVisibilityChange);
  if(messagesChannel){messagesChannel.unsubscribe();messagesChannel=null;}
  if(notifBellChannel){notifBellChannel.unsubscribe();notifBellChannel=null;}
  dashLeaveAllPresence();scwCleanup();window.location.href='/login';
}
let toastTimer;
function showToast(msg,type='success'){const t=document.getElementById('toast'),m=document.getElementById('toast-msg');clearTimeout(toastTimer);t.className='toast '+type;m.textContent=msg;t.classList.add('show');toastTimer=setTimeout(()=>t.classList.remove('show'),type==='error'?7000:3500);}
function timeAgo(iso){if(!iso)return'';const d=(Date.now()-new Date(iso))/1000;if(d<60)return'just now';if(d<3600)return`${Math.floor(d/60)}m ago`;if(d<86400)return`${Math.floor(d/3600)}h ago`;if(d<604800)return`${Math.floor(d/86400)}d ago`;return new Date(iso).toLocaleDateString('en-KE',{day:'numeric',month:'short'});}
function fmtKES(n,suffix=''){return `KES ${Number(n||0).toLocaleString('en-KE')}${suffix}`;}
function escHtml(s){if(s===null||s===undefined||s==='')return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function escAttr(s){if(s===null||s===undefined||s==='')return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function safeInternalLink(l){try{const u=new URL(l,location.origin);return u.origin===location.origin?u.pathname+u.search+u.hash:null;}catch(e){return null;}}
function safeHttpLink(value){try{const url=new URL(value);return url.protocol==='https:'||url.protocol==='http:'?url.href:null;}catch(e){return null;}}
function csvCell(v){if(typeof v==='number')return String(v);let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function truncateWords(s,maxWords){
  if(!s)return'';
  const words=String(s).trim().split(/\s+/);
  if(words.length<=maxWords)return s;
  return words.slice(0,maxWords).join(' ')+'…';
}

/* ══════════════════════════════════════
   NOTIFICATIONS — email + sound
   ════════════════════════════════════════════════════
   notifyAdmin/notifySeller call one shared Edge Function
   (send-notification-email) with a `type` + payload. The
   Edge Function itself decides subject/body per type and
   looks up the right recipient — admin address is fixed
   there (hellonyumba254@gmail.com), seller address comes
   from payload.sellerEmail. Wire the matching call into
   your ADMIN panel for 'listing_approved' and 'listing_rejected'
   (those actions happen there, not in this file) — see the
   note further down for the exact snippet to add there.
══════════════════════════════════════ */
async function notifyBuyerIfOffline(buyerToken, listingTitle, messageText) {
  if (!buyerToken) return;
  try {
    const { data: contact } = await db.from('buyer_contacts').select('email,full_name,notify_email').eq('buyer_token', buyerToken).maybeSingle();
    if (!contact?.email || contact.notify_email === false) return;
    const listingIdRow = allListings.find(l => l.title === listingTitle);
    const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(`${listingIdRow?.id||''}:${buyerToken}`))));
    const accessLink = `${location.origin}/inbox.html?nk_resume=${encoded}`;
    await fetch(`${EDGE_URL}/send-notification-email`, {
      method: 'POST', headers: { 'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ type:'buyer_new_message_alert', buyerEmail: contact.email, buyerName: contact.full_name, sellerName: currentProfile?.full_name, listingTitle, messagePreview: messageText.slice(0,150), accessLink }),
    });
  } catch (e) { console.error('notifyBuyerIfOffline failed:', e); }
}
const NOTIFY_RETRY_KEY='ny_notify_retry_queue';
const NOTIFY_RETRY_MAX_AGE=7*86400000;
function notifyQueueKey(){
  return currentUser?.id?`${NOTIFY_RETRY_KEY}_${currentUser.id}`:null;
}
function discardUnscopedNotificationQueue(){
  try{
    if(localStorage.getItem(NOTIFY_RETRY_KEY)!==null){
      localStorage.removeItem(NOTIFY_RETRY_KEY);
      console.warn('Discarded legacy notification retries that were not associated with an account.');
    }
  }catch(error){console.error('Could not discard unscoped notification retries:',error);}
}
function notifyQueueRead(){
  const key=notifyQueueKey();
  if(!key)return[];
  try{
    const parsed=JSON.parse(localStorage.getItem(key)||'[]');
    if(!Array.isArray(parsed))throw new Error('Stored notification retry queue is not an array.');
    const now=Date.now();
    return parsed.filter(entry=>
      entry&&typeof entry.type==='string'&&entry.type.length>0&&
      entry.payload&&typeof entry.payload==='object'&&!Array.isArray(entry.payload)&&
      Number.isFinite(entry.queuedAt)&&entry.queuedAt<=now&&now-entry.queuedAt<NOTIFY_RETRY_MAX_AGE
    ).slice(-20);
  }catch(error){
    console.error('Could not read notification retry queue:',error);
    return[];
  }
}
function notifyQueueWrite(q){
  const key=notifyQueueKey();
  if(!key){console.error('Could not persist notification retry: no signed-in account is available.');return;}
  try{localStorage.setItem(key,JSON.stringify(q.slice(-20)));}
  catch(error){console.error('Could not persist notification retry queue:',error);}
}
async function notifyByEmail(type,payload,_isRetry){
  try{
    const res=await fetch(`${EDGE_URL}/send-notification-email`,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'apikey':SUPABASE_KEY,
        'Authorization':`Bearer ${SUPABASE_KEY}`,
      },
      body:JSON.stringify({type,...payload}),
    });
    if(!res.ok){
      console.error('notifyByEmail: edge function returned',res.status);
      if(!_isRetry){const q=notifyQueueRead();q.push({type,payload,queuedAt:Date.now()});notifyQueueWrite(q);}
      return false;
    }else if(_isRetry){
      // successful retry — drop it from the queue
      notifyQueueWrite(notifyQueueRead().filter(e=>!(e.type===type&&JSON.stringify(e.payload)===JSON.stringify(payload))));
    }
    return true;
  }catch(err){
    console.error('notifyByEmail failed:',err);
    if(!_isRetry){const q=notifyQueueRead();q.push({type,payload,queuedAt:Date.now()});notifyQueueWrite(q);}
    return false;
  }
}
async function retryQueuedNotifications(){
  const q=notifyQueueRead();
  notifyQueueWrite(q); // Persist pruning of expired or invalid entries before attempting retries.
  for(const entry of q){ await notifyByEmail(entry.type,entry.payload,true); }
}
function notifyAdmin(type,payload){return notifyByEmail(type,{...payload,audience:'admin'});}
function notifySeller(type,payload){return notifyByEmail(type,{...payload,audience:'seller'});}

// ── In-app notification helper — writes straight into the `notifications`
// table so it shows in the bell + Notification Center instantly, no email.
// `link` can be an internal page (e.g. '/listing?id=000123') or a full
// https:// URL — openNotifItem/openNotifItemFromPage already handle both.
async function notifyInApp(type,title,body,link){
  try{
    const{error}=await db.from('notifications').insert({seller_id:effectiveSellerId,type,title,body,link:link||null});
    if(error){console.error('notifyInApp failed:',error);return;}
    loadNotifBell();
    if(document.getElementById('page-notifications')?.classList.contains('active'))renderNotificationsPage();
  }catch(e){console.error('notifyInApp failed:',e);}
}

// ── Sound alert system ──────────────────────────────────
let listingStatusPollTimer=null,listingStatusSnapshot={};
function updateNotificationSoundToggle(){
  const button=document.getElementById('notification-sound-toggle'),sound=window.NKNotificationSound;
  if(!button||!sound)return;
  const on=sound.enabled(),ready=sound.unlocked();
  button.setAttribute('aria-pressed',String(on));
  button.setAttribute('aria-label',!on?'Enable notification sound':ready?'Turn off notification sound':'Click to enable notification sound');
  button.title=!on?'Enable notification sound':ready?'Turn off notification sound':'Click to enable notification sound';
  button.innerHTML=`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${on?'<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>':'<path d="M11 5 6 9H3v6h3l5 4z"/><line x1="16" y1="9" x2="22" y2="15"/><line x1="22" y1="9" x2="16" y2="15"/>'}</svg>`;
}
async function toggleNotificationSound(){
  const sound=window.NKNotificationSound;if(!sound)return;
  if(!sound.enabled()||!sound.unlocked()){
    const ready=await sound.setEnabled(true);
    if(!ready)showToast('Sound is enabled, but this browser has not unlocked audio yet. Click the sound button again.','error');
  }else await sound.setEnabled(false);
  updateNotificationSoundToggle();
}
document.getElementById('notification-sound-toggle')?.addEventListener('click',toggleNotificationSound);
window.addEventListener(window.NKNotificationSound?.eventName||'nk-notification-sound-change',updateNotificationSoundToggle);
updateNotificationSoundToggle();
function playActivitySound(){
  window.NKNotificationSound?.play();
}

async function pollListingStatusChanges(){
  await verifyAccountStillActive();
  if(!allListings.length)return;
  const ids=allListings.map(l=>l.id);
  const{data,error}=await db.from('listings').select('id,status,title').in('id',ids);
  if(error||!data)return;
  let changed=false;const changedIds=[];
  data.forEach(row=>{
    const prev=listingStatusSnapshot[row.id];
    if(prev!==undefined&&prev!==row.status){
      changed=true;changedIds.push(row.id);
      const l=allListings.find(x=>x.id===row.id);
      if(l)l.status=row.status;
      if(row.status==='active'){
        showToast(`"${row.title}" is now live ✓`,'success');
      }else if(row.status==='rejected'){
        showToast(`"${row.title}" was rejected — check the listing for details`,'error');
      }else{
        showToast(`"${row.title}" status changed to ${statusLabel(row.status)}`,'');
      }
    }
    listingStatusSnapshot[row.id]=row.status;
  });
  if(changed){
    playActivitySound();
    renderListingsTable();renderOverview();renderQuickListings();
    if(document.getElementById('page-listings')?.classList.contains('active')){
      changedIds.forEach(id=>setTimeout(()=>lcFlashCard(id),120));
    }
  }
}

// Stop polling entirely while the tab is backgrounded — no point spending
// Supabase quota checking for updates nobody's looking at. Catches up
// immediately and resumes both intervals the moment the tab is visible again.
function handleVisibilityChange(){
  if(document.hidden){
    clearInterval(msgPollTimer);msgPollTimer=null;
    clearInterval(listingStatusPollTimer);listingStatusPollTimer=null;
    clearInterval(notifPollTimer);notifPollTimer=null;
  }else{
    // A backgrounded tab's realtime sockets can silently drop — force a
    // resubscribe of all three, not just resume the poll-fallback timers.
    subscribeMessagesRealtime();
    refreshBnbPropertyIdSet(); // re-subscribes bnbBookingsChannel internally
    subscribeNotifBellRealtime();
    pollNewMessages();
    pollListingStatusChanges();
    loadNotifBell();
    if(!msgPollTimer)msgPollTimer=setInterval(pollNewMessages,MSG_POLL_MS);
    if(!listingStatusPollTimer)listingStatusPollTimer=setInterval(pollListingStatusChanges,LISTING_STATUS_POLL_MS);
    if(!notifPollTimer)notifPollTimer=setInterval(loadNotifBell,60000);
  }
}

/* ══════════════════════════════════════
   SUPPORT CHAT WIDGET v4
══════════════════════════════════════ */
let scwOpen=false,scwTab='home',scwSellerName='',scwSellerInits='',scwTickets=[],scwActiveTicket=null,scwPollTimer=null,scwLoaded=false,scwChannel=null,scwBotBusy=false,scwSoundEnabled=true,scwTypingHideTimer=null;

const SCW_TOPICS=[
  {id:'payments',label:'💳 Payments & M-Pesa'},
  {id:'listing_status',label:'🏠 Listing status & approval'},
  {id:'edit_delete',label:'✏️ Editing or deleting a listing'},
  {id:'pricing',label:'💰 Fees & pricing'},
  {id:'messages',label:'📬 Messages & enquiries'},
  {id:'bug',label:'🐛 Report a bug'},
  {id:'other',label:'💬 Something else'},
];

const SCW_TREE={
  payments:[
    {label:'My listing still shows trial/pending after paying',a:'Confirmed M-Pesa payments usually reflect within 2–5 minutes. If it\'s been longer, share your M-Pesa reference code and we\'ll trace it.'},
    {label:'How do I pay for a listing?',a:'Go to <strong>My listings</strong> and tap <strong>Pay now</strong> on an approved listing. Pay via M-Pesa to Paybill 522522 (account 1298476615), then enter the 10-character M-Pesa code. We verify it within minutes.'},
    {label:'I was charged twice',handoff:true},
    {label:'Something else about payments',handoff:true},
  ],
  listing_status:[
    {label:'My listing has been pending for a while',a:'Listings are usually reviewed within 24 hours. If it\'s been longer, share the listing name and we\'ll check on it.'},
    {label:'My listing was rejected',a:'Rejections are usually due to missing photos, an unclear price, or a duplicate post. Share the listing name and we\'ll tell you exactly what to fix.'},
    {label:'My account or listing is disabled',handoff:true},
    {label:'Something else about listing status',handoff:true},
  ],
  edit_delete:[
    {label:"I can't edit my pending/rejected listing",a:'Editing is locked while a listing awaits admin review, to avoid re-review loops. Once it\'s active or paused, edits unlock from the listings table.'},
    {label:'How do I mark a listing as sold/occupied?',a:'On <strong>My listings</strong>, use the ✓ icon on an active listing — it hides it from public search but keeps your messages and history. For a multi-unit property, use the purple "Manage units" icon instead to mark individual units.'},
    {label:'How do I mark one unit occupied in a multi-unit property?',a:'On <strong>My listings</strong>, use the purple grid icon ("Manage units") on that property\'s row. Pick the unit type, tap "Mark one occupied", and optionally note the floor, door number, and position.'},
    {label:'How do I permanently delete a listing?',a:'Use the 🗑 icon on the listing row. This is permanent and removes its messages, enquiries, and unit types too, so make sure first.'},
    {label:'Something else about editing',handoff:true},
  ],
  pricing:[
    {label:'How much does a listing cost?',a:'Pricing depends on your plan and listing category — check the trial banner on each listing, or ask an agent for current rates. Multi-unit properties pay a base fee plus a small per-unit fee.'},
    {label:'Can I get a refund?',handoff:true},
    {label:'Something else about pricing',handoff:true},
  ],
  messages:[
    {label:"A buyer's message isn't showing up",a:'New messages appear instantly. If one is missing, refresh the page, and if it\'s still missing, share the buyer\'s name and listing.'},
    {label:'How do I reply to a buyer?',a:'Open <strong>Messages</strong> on the main dashboard, pick the conversation, and type in the reply box — or tap WhatsApp on that thread.'},
    {label:'Something else about messages',handoff:true},
  ],
  bug:[
    {label:'A page is not loading or looks broken',handoff:true},
    {label:"A button or feature isn't working",handoff:true},
    {label:'Something else',handoff:true},
  ],
  other:[],
};

const SCW_FAQ=(function(){
  var seen={}, out=[];
  Object.keys(SCW_TREE).forEach(function(k){
    SCW_TREE[k].forEach(function(o){
      if(o.a && !seen[o.label]){seen[o.label]=true;out.push({q:o.label,a:o.a});}
    });
  });
  return out;
})();

function scwName(){return(scwSellerName||'there').split(' ')[0]||'there';}
function scwTicketRef(t){return t&&t.id?('NK-'+String(t.id).replace(/-/g,'').slice(0,7).toUpperCase()):'—';}
// Identifies standalone admin-to-seller broadcast messages (created outside
// the topic-picker flow, with the telltale "New message from admin" topic and
// a growing "__new_" session_key). These still need to trigger badges/sound
// and appear in Messages — they're just not formal support tickets, so they're
// excluded from the Tickets tab specifically (see scwRenderTicketList).
function scwIsBroadcast(t){
  const topic=(t.topic||'').toLowerCase();
  const key=(t.session_key||'').toLowerCase();
  return topic.includes('new message from admin')||key.includes('__new_');
}

function scwMatchFaq(text){
  if(!text)return null;
  const words=text.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w=>w.length>2);
  if(!words.length)return null;
  const stop=new Set(['the','and','for','with','about','this','that','have','you','your','are','was','were','not','how','can','get','has']);
  const sig=words.filter(w=>!stop.has(w));
  if(!sig.length)return null;
  let best=null,bestScore=0;
  SCW_FAQ.forEach(f=>{
    const hay=(f.q+' '+f.a).toLowerCase();
    let score=0;
    sig.forEach(w=>{if(hay.includes(w))score++;});
    if(score>bestScore){bestScore=score;best=f;}
  });
  return bestScore>=1?best:null;
}

function scwToggle(){
  scwOpen=!scwOpen;
  document.getElementById('scw-panel').classList.toggle('open',scwOpen);
  document.getElementById('scw-overlay').classList.toggle('open',scwOpen);
  if(scwOpen){
    document.getElementById('scw-fab-badge')?.classList.remove('show');
    scwRenderHomeFaq();scwRenderHelp(document.getElementById('scw-help-search')?.value||'');
    if(!scwLoaded){scwLoaded=true;scwInit();}
  }
}

async function scwInit(){
  try{
    scwSellerName=(currentProfile?.full_name||currentUser?.email?.split('@')[0]||'Seller').trim();
    scwSellerInits=scwSellerName.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()||'S';
    const nameEl=document.getElementById('scw-greet-name');if(nameEl)nameEl.textContent=scwName();
  }catch(err){console.error('SCW profile error:',err);}
  try{await scwLoadTickets();}catch(err){console.error('SCW load error:',err);}
  scwPollTimer=setInterval(scwPoll,45000);
}

async function scwLoadTickets(){
  const{data,error}=await db.from('chat_sessions').select('*').eq('session_type','seller')
    .like('session_key','seller_'+currentUser.id+'_%')
    .order('last_msg_at',{ascending:false});
  if(error){console.error(error);return;}
  const prevById={};scwTickets.forEach(t=>{prevById[t.id]=t;});
  const prevIds=scwTickets.map(t=>t.id).sort().join(',');
  scwTickets=(data||[]).map(t=>{
    const prev=prevById[t.id];
    return{...t,status:t.status||(t.is_resolved?'resolved':'open'),_messages:prev?prev._messages:null,_unread:prev?prev._unread:0,_topicId:prev?prev._topicId:null,_botMsgs:prev?prev._botMsgs:{},_suggested:prev?prev._suggested:false,_clarified:prev?prev._clarified:false,_textSuggested:prev?prev._textSuggested:false,_renderedCount:prev?prev._renderedCount:0};
  });
  const newIds=scwTickets.map(t=>t.id).sort().join(',');
  await scwRefreshUnreadCounts();
  scwRefreshListViews();
  scwUpdateBadges();
  // Only tear down/rebuild the realtime channel when the ticket id set
  // actually changed (or we don't have a live channel yet) — not on
  // every 45s poll, which was causing constant reconnect/flicker.
  if(newIds!==prevIds||!scwChannel)scwSubscribeRealtime();
}

// ── Real-time: instant delivery of new admin messages, even mid-conversation ──
function scwSubscribeRealtime(){
  if(scwChannel){scwChannel.unsubscribe();scwChannel=null;}
  const ids=scwTickets.map(t=>t.id);
  scwChannel=db.channel('scw-seller-'+currentUser.id)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_sessions',filter:`seller_id=eq.${currentUser.id}`},payload=>{
      scwHandleNewSession(payload.new);
    })
    .on('broadcast',{event:'typing'},payload=>{
      scwHandleTyping(payload.payload||{});
    });
  if(ids.length){
    scwChannel=scwChannel.on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_messages',filter:`session_id=in.(${ids.join(',')})`},payload=>{
      scwHandleIncoming(payload.new);
    });
  }
  scwChannel.subscribe((status)=>{
    if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
      console.warn('SCW realtime status:',status,'— relying on 45s poll fallback');
    }
  });
}

// A brand-new session/ticket created by admin (not opened by the seller
// first) won't be in scwTickets' id list yet, so the chat_messages filter
// above can't catch its first message. Catching the chat_sessions INSERT
// itself lets us add it and re-subscribe immediately, instead of waiting
// for the 45s poll fallback.
async function scwHandleNewSession(session){
  if(scwFindTicket(session.id))return; // already have it (e.g. we created it ourselves)
  const ticket={...session,status:session.status||(session.is_resolved?'resolved':'open'),_messages:[],_unread:0,_topicId:null,_botMsgs:{},_suggested:false,_clarified:false,_textSuggested:false};
  scwTickets.unshift(ticket);
  await scwRefreshUnreadCounts();
  scwSubscribeRealtime(); // widen the chat_messages filter to include this new id
  scwUpdateBadges();scwRefreshListViews();
  if(session.session_key && !scwIsBroadcast(ticket)) scwPlayNotifySound();
}

async function scwHandleIncoming(msg){
  const t=scwFindTicket(msg.session_id);if(!t)return;
  t._messages=t._messages||[];
  if(t._messages.some(m=>m.id===msg.id))return; // avoid dupes with our own optimistic inserts
  t._messages.push(msg);
  t.last_msg_at=msg.created_at;
  const isThisOpen=scwActiveTicket&&String(scwActiveTicket.id)===String(t.id)&&scwTab==='messages'&&document.getElementById('scw-msg-active').style.display==='flex';
  if(msg.sender==='admin'){
    scwHideTyping();
    if(isThisOpen){
      // Already looking at it — show instantly and mark read right away
      scwAppendBubble(msg.sender,msg.body);
      t._renderedCount=t._messages.length;
      scwMarkTicketRead(t);
    }else{
      t._unread=(t._unread||0)+1;
    }
    playActivitySound();
  }
  scwUpdateBadges();scwRefreshListViews();
}

function scwPlayNotifySound(){
  if(scwSoundEnabled)playActivitySound();
}

function scwHandleTyping(payload){
  if(!scwActiveTicket||String(payload.session_id)!==String(scwActiveTicket.id))return;
  if(payload.who!=='admin')return;
  scwShowTyping();
  clearTimeout(scwTypingHideTimer);
  scwTypingHideTimer=setTimeout(scwHideTyping,3000);
}

// Lets the seller's own typing be visible to an admin widget that listens for
// this same broadcast event (the admin-side chat panel needs a matching
// `channel.send({type:'broadcast', event:'typing', payload:{session_id, who:'seller'}})`
// call on its own input — wire that up in the admin dashboard's chat widget).
let scwTypingSendTimer=null;
function scwBroadcastTyping(){
  if(!scwActiveTicket||!scwChannel)return;
  clearTimeout(scwTypingSendTimer);
  scwTypingSendTimer=setTimeout(()=>{
    scwChannel.send({type:'broadcast',event:'typing',payload:{session_id:scwActiveTicket.id,who:'seller'}});
  },150);
}

async function scwRefreshUnreadCounts(){
  if(!scwTickets.length)return;
  const ids=scwTickets.map(t=>t.id);
  const{data}=await db.from('chat_messages').select('session_id').in('session_id',ids).eq('sender','admin').is('read_at',null);
  const counts={};(data||[]).forEach(m=>{counts[m.session_id]=(counts[m.session_id]||0)+1;});
  scwTickets.forEach(t=>t._unread=counts[t.id]||0);
}

async function scwPoll(){
  await scwLoadTickets();
  if(scwOpen&&scwActiveTicket){
    const fresh=scwTickets.find(x=>String(x.id)===String(scwActiveTicket.id));
    if(fresh){
      fresh._renderedCount=scwActiveTicket._renderedCount||0;
      await scwLoadTicketMessages(fresh);
      scwActiveTicket=fresh;
      if(scwTab==='messages'&&document.getElementById('scw-msg-active').style.display==='flex'){
        scwRenderThreadHead(scwActiveTicket);
        const newMsgs=(scwActiveTicket._messages||[]).slice(scwActiveTicket._renderedCount);
        if(newMsgs.length){
          newMsgs.forEach(m=>scwAppendBubble(m.sender,m.body,!!(scwActiveTicket._botMsgs&&scwActiveTicket._botMsgs[m.id])));
          scwActiveTicket._renderedCount=scwActiveTicket._messages.length;
          scwMarkTicketRead(scwActiveTicket);
        }
      }
    }
  }
}

function scwUpdateBadges(){
  const unreadConvos=scwTickets.filter(t=>(t._unread||0)>0).length;
  const fabBadge=document.getElementById('scw-fab-badge');
  if(fabBadge){fabBadge.textContent=unreadConvos>0?String(unreadConvos):'';fabBadge.classList.toggle('show',unreadConvos>0&&!scwOpen);}
  const tabBadge=document.getElementById('scw-tab-badge-messages');
  if(tabBadge){tabBadge.textContent=unreadConvos>0?String(unreadConvos):'';tabBadge.classList.toggle('show',unreadConvos>0);}
}

function scwSetTab(tab){
  scwTab=tab;
  document.querySelectorAll('.scw-view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.scw-tab').forEach(b=>b.classList.remove('active'));
  document.getElementById('scw-view-'+tab).classList.add('active');
  document.querySelector(`.scw-tab[data-tab="${tab}"]`).classList.add('active');
  if(tab==='tickets')scwRenderTicketList();
  if(tab==='home')scwRenderHomeFaq();
  if(tab==='help')scwRenderHelp(document.getElementById('scw-help-search')?.value||'');
  if(tab==='messages'&&!scwActiveTicket)scwShowInbox();
}

function scwShowInbox(){
  document.getElementById('scw-msg-active').style.display='none';
  if(!scwTickets.length){
    document.getElementById('scw-msg-empty').style.display='flex';
    document.getElementById('scw-msg-inbox').style.display='none';
    return;
  }
  document.getElementById('scw-msg-empty').style.display='none';
  document.getElementById('scw-msg-inbox').style.display='flex';
  scwRenderInboxList();
}
function scwRenderInboxList(){
  const el=document.getElementById('scw-inbox-list');if(!el)return;
  const sorted=[...scwTickets].sort((a,b)=>(b._unread||0)-(a._unread||0)||new Date(b.last_msg_at)-new Date(a.last_msg_at));
  el.innerHTML=sorted.map(t=>{
    const last=(t._messages&&t._messages.length)?t._messages[t._messages.length-1]:null;
    const preview=last?(last.sender==='admin'?'Support: ':'You: ')+(last.body||'').replace(/<[^>]+>/g,''):'No messages yet';
    return `<div class="scw-ticket-card" onclick="scwOpenTicket('${t.id}')" role="button" tabindex="0" aria-label="Open ticket: ${escAttr(t.topic||'General enquiry')}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
      <div class="scw-ticket-top"><span class="scw-ticket-topic">${escHtml(t.topic||'General enquiry')}${t._unread?' <span class="scw-ticket-dot"></span>':''}</span><span class="scw-ticket-status ${t.status}">${t.status}</span></div>
      <div class="scw-ticket-preview">${escHtml(preview)}</div>
      <div class="scw-ticket-meta">${scwTicketRef(t)} · ${timeAgo(t.last_msg_at)}${t._unread?` · ${t._unread} new`:''}</div>
    </div>`;
  }).join('');
}

function scwRefreshListViews(){
  scwRenderRecentTicket();
  if(document.getElementById('scw-view-tickets')?.classList.contains('active'))scwRenderTicketList();
  if(document.getElementById('scw-view-messages')?.classList.contains('active')&&!scwActiveTicket)scwShowInbox();
}

function scwRenderRecentTicket(){
  const el=document.getElementById('scw-recent-ticket');if(!el)return;
  if(!scwTickets.length){el.innerHTML='<div class="scw-empty-mini">No conversations yet — start one below.</div>';return;}
  const t=scwTickets[0];
  el.innerHTML=`<div class="scw-recent-card" onclick="scwOpenTicket('${t.id}')" role="button" tabindex="0" aria-label="Open ticket: ${escAttr(t.topic||'General enquiry')}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
    <div class="scw-recent-icon"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></div>
    <div class="scw-recent-body"><div class="scw-recent-topic">${escHtml(t.topic||'General enquiry')}</div><div class="scw-recent-preview">${scwTicketRef(t)} · ${t.status==='open'?'Open':(t.status==='resolved'?'Resolved':'Closed')}</div></div>
    <div class="scw-recent-meta">${timeAgo(t.last_msg_at)}</div>
  </div>`;
}
function scwRenderHomeFaq(){
  const el=document.getElementById('scw-home-faq');if(!el)return;
  try{
    if(typeof SCW_FAQ==='undefined'){el.innerHTML='<div class="scw-empty-mini" style="color:var(--red)">Widget error: SCW_FAQ is not defined — the script likely failed to load fully. Check the browser console for a red error.</div>';return;}
    if(!SCW_FAQ.length){el.innerHTML='<div class="scw-empty-mini">No quick answers configured yet.</div>';return;}
    el.innerHTML=SCW_FAQ.slice(0,3).map((f,i)=>`<div class="scw-mini-faq" onclick="scwOpenHelpAndExpand(${i})" role="button" tabindex="0" aria-label="${escAttr(f.q)}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}"><strong>${escHtml(f.q)}</strong>${escHtml(f.a.replace(/<[^>]+>/g,'').slice(0,70))}…</div>`).join('');
  }catch(err){
    console.error('scwRenderHomeFaq error:',err);
    el.innerHTML=`<div class="scw-empty-mini" style="color:var(--red)">Widget error: ${escHtml(err.message||String(err))}</div>`;
  }
}
function scwOpenHelpAndExpand(idx){
  scwSetTab('help');
  if(idx>=0)setTimeout(()=>{document.getElementById('scw-faq-'+idx)?.classList.add('open');document.getElementById('scw-faq-'+idx)?.scrollIntoView({block:'nearest'});},50);
}
function scwShowTopicPicker(from){
  const wrapId=from==='home'?'scw-topic-picker':'scw-tickets-topic-picker';
  const ctaId=from==='home'?'scw-home-cta-wrap':null;
  const wrap=document.getElementById(wrapId);if(!wrap)return;
  wrap.style.display='flex';wrap.innerHTML=SCW_TOPICS.map(t=>`<button class="scw-topic-btn" onclick="scwCreateTicket('${t.id}')">${t.label}</button>`).join('');
  if(ctaId)document.getElementById(ctaId).style.display='none';
}

// NOTE: topicLabel is looked up here from SCW_TOPICS rather than passed through
// the onclick attribute string. Embedding arbitrary label text (which can contain
// apostrophes, e.g. "editing a listing") into an inline onclick="...('...')" broke
// the JS string as soon as the browser HTML-decoded the escaped quote back into a
// literal ' before the JS parser ever saw it — this was the actual cause of the
// bot menu silently failing on certain options. Only ids/indices go into onclick now.
async function scwCreateTicket(topicId){
  const topicObj=SCW_TOPICS.find(t=>t.id===topicId);
  const topicLabel=topicObj?topicObj.label.replace(/^\S+\s/,''):topicId;
  const sessionKey=`seller_${currentUser.id}_${Date.now()}`;
  const payload={session_key:sessionKey,session_type:'seller',seller_id:currentUser.id,visitor_name:scwSellerName,page:'dashboard.html',topic:topicLabel,status:'open',is_resolved:false,last_msg_at:new Date().toISOString()};
  const{data,error}=await db.from('chat_sessions').insert(payload).select().single();
  if(error){showToast('Could not start ticket: '+error.message,'error');return;}
  const ticket={...data,status:'open',_messages:[],_unread:0,_topicId:topicId,_botMsgs:{},_suggested:false,_clarified:false,_textSuggested:false,_pendingCategory:null};
  scwTickets.unshift(ticket);
  scwSubscribeRealtime();
  document.getElementById('scw-topic-picker').style.display='none';
  document.getElementById('scw-tickets-topic-picker').style.display='none';
  document.getElementById('scw-home-cta-wrap').style.display='block';
  await scwOpenTicket(ticket.id,true);
  notifyAdmin('new_support_ticket',{ticketId:ticket.id,ticketRef:scwTicketRef(ticket),topic:topicLabel,sellerName:currentProfile?.full_name||currentUser?.email,sellerEmail:currentUser?.email});
}

function scwStartNewTicket(){scwSetTab('home');scwShowTopicPicker('home');}

async function scwOpenTicket(id,isNew){
  const t=scwTickets.find(x=>String(x.id)===String(id));if(!t)return;
  scwActiveTicket=t;
  if(!isNew)await scwLoadTicketMessages(t);
  scwSetTab('messages');
  document.getElementById('scw-msg-empty').style.display='none';
  document.getElementById('scw-msg-inbox').style.display='none';
  document.getElementById('scw-msg-active').style.display='flex';
  scwRenderThreadHead(t);
  document.getElementById('scw-msgs').innerHTML='';
  (t._messages||[]).forEach(m=>scwAppendBubble(m.sender,m.body,!!(t._botMsgs&&t._botMsgs[m.id])));
  t._renderedCount=(t._messages||[]).length;
  if(isNew){
    await scwRunBotMenu(t);
  }else if(t.status==='open'&&(!t._messages||!t._messages.length)){
    await scwRunBotMenu(t);
  }
  await scwMarkTicketRead(t);
}

async function scwLoadTicketMessages(t){
  const{data}=await db.from('chat_messages').select('*').eq('session_id',t.id).order('created_at',{ascending:true});
  t._messages=data||[];
}

function scwRenderThreadHead(t){
  const closed=t.status!=='open';
  document.getElementById('scw-thread-head').innerHTML=`
    <button class="scw-back-btn" onclick="scwBackToInbox()" title="Back to inbox"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button>
    <div><div class="scw-thread-head-topic">${escHtml(t.topic||'General enquiry')}</div><div class="scw-thread-head-ref">${scwTicketRef(t)} · ${(t.status||'open').toUpperCase()}</div></div>
    <div class="scw-thread-head-action">
      ${!closed
        ? `<button class="scw-chip-btn" onclick="scwResolveTicket('${t.id}')">✓ Mark resolved</button>`
        : `<button class="scw-chip-btn" onclick="scwReopenTicket('${t.id}')">↻ Reopen chat</button>`}
    </div>
  `;
  document.getElementById('scw-closed-banner').style.display=closed?'block':'none';
  document.getElementById('scw-closed-banner').textContent=closed?'This ticket is closed. Tap "Reopen chat" above to continue this conversation, or start a new topic.':'';
  document.getElementById('scw-input-bar').style.display=(closed||scwBotBusy)?'none':'flex';
}
// Lets a seller pick back up a resolved/closed ticket instead of being forced
// to start a brand new one — reopens it in place, keeping the full history.
async function scwReopenTicket(ticketId){
  const t=scwFindTicket(ticketId); if(!t) return;
  const{error}=await db.from('chat_sessions').update({status:'open',is_resolved:false}).eq('id',ticketId);
  if(error){ showToast('Could not reopen: '+error.message,'error'); return; }
  t.status='open'; t.is_resolved=false;
  scwRenderThreadHead(t);
  scwRefreshListViews();
  showToast('Ticket reopened — you can continue the conversation','success');
  document.getElementById('scw-input')?.focus();
}
function scwBackToInbox(){scwActiveTicket=null;scwShowInbox();}

function scwAppendBubble(sender,body,isHtml){
  const mc=document.getElementById('scw-msgs');if(!mc)return;
  const isAdmin=sender==='admin';
  const div=document.createElement('div');
  div.className=`scw-msg ${isAdmin?'from-admin':'from-visitor'}`;
  // isHtml is only ever true for our own bot-authored strings (see the calls
  // that pass it explicitly). Anything typed by a visitor/seller/admin always
  // goes through escHtml — a message body is never trusted as raw HTML.
  div.innerHTML=`<div class="scw-msg-av">${isAdmin?'NK':scwSellerInits}</div><div class="scw-msg-bub">${isHtml?body:escHtml(body)}</div>`;
  mc.appendChild(div);
  setTimeout(()=>{mc.scrollTop=mc.scrollHeight;},20);
}
function scwShowTyping(){
  const mc=document.getElementById('scw-msgs');if(!mc||document.getElementById('scw-typing'))return;
  const div=document.createElement('div');div.id='scw-typing';div.className='scw-msg from-admin';
  div.innerHTML=`<div class="scw-msg-av">NK</div><div class="scw-typing-bub"><div class="scw-dot"></div><div class="scw-dot"></div><div class="scw-dot"></div></div>`;
  mc.appendChild(div);mc.scrollTop=mc.scrollHeight;
}
function scwHideTyping(){document.getElementById('scw-typing')?.remove();}
function scwRemoveOptions(){document.getElementById('scw-options-wrap')?.remove();}
function scwShowOptions(buttons){
  scwRemoveOptions();
  const mc=document.getElementById('scw-msgs');if(!mc)return;
  const wrap=document.createElement('div');wrap.className='scw-options';wrap.id='scw-options-wrap';
  wrap.innerHTML=buttons.map(b=>`<button class="scw-option-btn" onclick="${b.onclick}">${escHtml(b.label)}</button>`).join('');
  mc.appendChild(wrap);mc.scrollTop=mc.scrollHeight;
}

async function scwPersistVisitor(ticket,body){
  const{data,error}=await db.from('chat_messages').insert({session_id:ticket.id,sender:'visitor',body}).select().single();
  if(!error&&data){ticket._messages=ticket._messages||[];ticket._messages.push(data);ticket.last_msg_at=data.created_at;await db.from('chat_sessions').update({last_msg_at:data.created_at}).eq('id',ticket.id);}
  return data;
}
async function scwPersistBot(ticket,body){
  const{data,error}=await db.from('chat_messages').insert({session_id:ticket.id,sender:'admin',body,read_at:new Date().toISOString()}).select().single();
  if(!error&&data){ticket._messages=ticket._messages||[];ticket._messages.push(data);ticket._botMsgs=ticket._botMsgs||{};ticket._botMsgs[data.id]=true;ticket.last_msg_at=data.created_at;await db.from('chat_sessions').update({last_msg_at:data.created_at}).eq('id',ticket.id);}
  return data;
}

async function scwRunBotMenu(ticket){
  scwBotBusy=true;
  document.getElementById('scw-input-bar').style.display='none';
  scwShowTyping();
  await scwWait(600);
  scwHideTyping();
  const greet=`Hi ${scwName()}! You picked "<strong>${escHtml(ticket.topic)}</strong>" — what specifically is it about?`;
  scwAppendBubble('admin',greet,true);
  await scwPersistBot(ticket,greet);
  const opts=SCW_TREE[ticket._topicId]||[];
  if(!opts.length){ticket._pendingCategory=ticket.topic;await scwGoToHandoff(ticket);return;}
  scwShowOptions(opts.map((o,i)=>({label:o.label,onclick:`scwPickLeaf('${ticket.id}',${i})`})));
  scwBotBusy=false;
}

function scwFindTicket(id){return scwTickets.find(x=>String(x.id)===String(id));}

async function scwPickLeaf(ticketId,idx){
  const ticket=scwFindTicket(ticketId);if(!ticket||scwBotBusy)return;
  scwBotBusy=true;
  scwRemoveOptions();
  const opts=SCW_TREE[ticket._topicId]||[];
  const opt=opts[idx];if(!opt){scwBotBusy=false;return;}
  scwAppendBubble('visitor',opt.label);
  await scwPersistVisitor(ticket,opt.label);
  if(opt.handoff){ticket._pendingCategory=opt.label;await scwGoToHandoff(ticket);return;}
  scwShowTyping();await scwWait(700);scwHideTyping();
  scwAppendBubble('admin',opt.a,true);
  await scwPersistBot(ticket,opt.a);
  await scwWait(250);
  scwAppendBubble('admin','Did that solve it?');
  await scwPersistBot(ticket,'Did that solve it?');
  scwShowOptions([
    {label:'✅ Yes, that solved it',onclick:`scwResolveByBot('${ticket.id}')`},
    {label:'❌ No, I need an agent',onclick:`scwHandoffFromLeaf('${ticket.id}',${idx})`},
  ]);
  scwBotBusy=false;
}
// Called from the "No, I need an agent" button after a leaf answer — looks the
// option's label back up from SCW_TREE by index rather than having the label
// text travel through an onclick="..." attribute (see note above scwCreateTicket).
async function scwHandoffFromLeaf(ticketId,idx){
  const ticket=scwFindTicket(ticketId);if(!ticket||scwBotBusy)return;
  const opts=SCW_TREE[ticket._topicId]||[];
  const opt=opts[idx];
  ticket._pendingCategory=opt?opt.label:ticket.topic;
  await scwGoToHandoff(ticket);
}

async function scwResolveByBot(ticketId){
  const ticket=scwFindTicket(ticketId);
  if(!ticket||scwBotBusy)return;
  scwBotBusy=true;scwRemoveOptions();
  scwAppendBubble('visitor','Yes, that solved it — thanks!');
  await scwPersistVisitor(ticket,'Yes, that solved it — thanks!');
  scwShowTyping();await scwWait(500);scwHideTyping();
  const bye='Glad we could help! 🎉 This ticket is now closed — start a new topic any time if you need more help.';
  scwAppendBubble('admin',bye);
  await scwPersistBot(ticket,bye);
  await scwResolveTicket(ticket.id,true);
  scwBotBusy=false;
}

// `category` now comes from ticket._pendingCategory (set by the caller right
// before invoking this) instead of a second function argument threaded through
// onclick="..." attribute text — see the note above scwCreateTicket for why
// that broke on any option whose label contained an apostrophe.
async function scwGoToHandoff(ticketOrId){
  const ticket=typeof ticketOrId==='string'?scwFindTicket(ticketOrId):ticketOrId;
  if(!ticket)return;
  const category=ticket._pendingCategory||ticket.topic;
  scwBotBusy=true;scwRemoveOptions();
  if(!ticket._suggested){
    ticket._suggested=true;
    const match=scwMatchFaq((category||'')+' '+(ticket.topic||''));
    if(match){
      scwShowTyping();await scwWait(650);scwHideTyping();
      const sugg=`Before I connect you — this might help:<br><strong>${escHtml(match.q)}</strong><br>${match.a}`;
      scwAppendBubble('admin',sugg,true);
      await scwPersistBot(ticket,sugg);
      await scwWait(200);
      scwAppendBubble('admin','Did that solve it?');
      await scwPersistBot(ticket,'Did that solve it?');
      scwShowOptions([
        {label:'✅ Yes, that solved it',onclick:`scwResolveByBot('${ticket.id}')`},
        {label:'🙋 No, connect me to an agent',onclick:`scwGoToHandoff('${ticket.id}')`},
      ]);
      scwBotBusy=false;
      return;
    }
  }
  if(!ticket._clarified){
    ticket._clarified=true;
    scwShowTyping();await scwWait(600);scwHideTyping();
    const clarify=`I don't have an exact answer for that yet. Let's narrow it down — is it actually about one of these?`;
    scwAppendBubble('admin',clarify);
    await scwPersistBot(ticket,clarify);
    const buttons=SCW_TOPICS.map(t=>({label:t.label,onclick:`scwReRoute('${ticket.id}','${t.id}')`}));
    buttons.push({label:'🙋 None of those — just get me an agent',onclick:`scwGoToHandoff('${ticket.id}')`});
    scwShowOptions(buttons);
    scwBotBusy=false;
    return;
  }
  scwShowTyping();await scwWait(650);scwHideTyping();
  const msg=`Got it — connecting you with an agent about "<strong>${escHtml(category||ticket.topic)}</strong>". Describe it below and someone will reply right here as soon as they're available.`;
  scwAppendBubble('admin',msg,true);
  await scwPersistBot(ticket,msg);
  scwBotBusy=false;
  document.getElementById('scw-input-bar').style.display='flex';
  document.getElementById('scw-input')?.focus();
  notifyAdmin('support_handoff',{ticketId:ticket.id,ticketRef:scwTicketRef(ticket),category:category||ticket.topic,sellerName:currentProfile?.full_name||currentUser?.email,sellerEmail:currentUser?.email});
}

async function scwReRoute(ticketId,topicId){
  const ticket=scwFindTicket(ticketId);if(!ticket||scwBotBusy)return;
  const topicObj=SCW_TOPICS.find(t=>t.id===topicId);
  const topicLabel=topicObj?topicObj.label.replace(/^\S+\s/,''):topicId;
  scwBotBusy=true;scwRemoveOptions();
  scwAppendBubble('visitor',topicLabel);
  await scwPersistVisitor(ticket,topicLabel);
  ticket._topicId=topicId;
  // A fresh topic deserves one fresh chance at an FAQ suggestion, since a
  // different category may have a genuinely relevant answer. But _clarified
  // must NOT reset here — that flag exists to guarantee the "is it actually
  // about one of these?" menu is shown at most once per ticket. Resetting it
  // on every re-route caused that menu to loop indefinitely whenever someone
  // bounced between topics before reaching a live agent (the reported bug).
  ticket._suggested=false;
  const opts=SCW_TREE[topicId]||[];
  if(!opts.length){ticket._pendingCategory=topicLabel;await scwGoToHandoff(ticket);return;}
  scwShowTyping();await scwWait(500);scwHideTyping();
  const ask='Got it — what specifically about that?';
  scwAppendBubble('admin',ask);
  await scwPersistBot(ticket,ask);
  scwShowOptions(opts.map((o,i)=>({label:o.label,onclick:`scwPickLeaf('${ticket.id}',${i})`})));
  scwBotBusy=false;
}

function scwWait(ms){return new Promise(res=>setTimeout(res,ms));}

async function scwMarkTicketRead(t){
  if(!t._unread)return;
  const expected=t._unread;
  // Uses the mark_ticket_messages_read() Postgres function (security definer)
  // instead of a direct table UPDATE. A direct UPDATE depends on an RLS policy
  // matching exactly right on both chat_messages and the chat_sessions
  // subquery it references — any small mismatch (column type, missing SELECT
  // policy needed for .select() to return the updated rows, etc.) silently
  // blocks it with no clear error. The RPC function enforces the ownership
  // check itself and runs with elevated privilege internally, so it isn't
  // subject to that fragility. Run the SQL for mark_ticket_messages_read()
  // in Supabase -> SQL Editor once if this keeps failing.
  const{data:updatedCount,error}=await db.rpc('mark_ticket_messages_read',{p_session_id:t.id});
  if(error){
    console.error('scwMarkTicketRead: RPC failed —',error.message);
    if(!window.__scwRlsWarned){window.__scwRlsWarned=true;showToast('Support badges can\'t clear — the mark_ticket_messages_read() function is missing or misconfigured. See console for the SQL to run.','error');}
    return;
  }
  if(typeof updatedCount==='number'&&updatedCount<expected){
    console.warn(`scwMarkTicketRead: expected to mark ${expected} message(s) read but the function only updated ${updatedCount}. Double-check mark_ticket_messages_read() exists and matches your chat_sessions.id column type (uuid vs bigint).`);
  }
  // Re-read the actual unread count from the database rather than assuming
  // the RPC fully succeeded — this is the ground-truth fix. If something is
  // still off, this reflects that instead of hiding it.
  const{count}=await db.from('chat_messages').select('id',{count:'exact',head:true}).eq('session_id',t.id).eq('sender','admin').is('read_at',null);
  t._unread=count||0;
  scwUpdateBadges();scwRefreshListViews();
}

async function scwResolveTicket(id,skipRerender){
  const t=scwFindTicket(id);if(!t)return;
  const{error}=await db.from('chat_sessions').update({status:'resolved',is_resolved:true}).eq('id',id);
  if(error){showToast('Could not update ticket: '+error.message,'error');return;}
  t.status='resolved';t.is_resolved=true;
  scwRenderThreadHead(t);scwRefreshListViews();
  if(!skipRerender)showToast('Ticket marked resolved ✓','success');
}

function scwRenderTicketList(){
  const el=document.getElementById('scw-ticket-list');if(!el)return;
  const realTickets=scwTickets.filter(t=>!scwIsBroadcast(t));
  if(!realTickets.length){el.innerHTML='<div class="scw-empty-mini">No tickets yet. Tap + New to start one.</div>';return;}
  el.innerHTML=realTickets.map(t=>{
    return `<div class="scw-ticket-card" onclick="scwOpenTicket('${t.id}')" role="button" tabindex="0" aria-label="Open ticket: ${escAttr(t.topic||'General enquiry')}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
      <div class="scw-ticket-top"><span class="scw-ticket-topic">${escHtml(t.topic||'General enquiry')}${t._unread?' <span class="scw-ticket-dot"></span>':''}</span><span class="scw-ticket-status ${t.status}">${t.status}</span></div>
      <div class="scw-ticket-meta">${scwTicketRef(t)} · ${timeAgo(t.last_msg_at)}${t._unread?` · ${t._unread} new`:''}</div>
    </div>`;
  }).join('');
}

async function scwSend(){
  const t=scwActiveTicket;if(!t||t.status!=='open'||scwBotBusy)return;
  const input=document.getElementById('scw-input');const body=input.value.trim();if(!body)return;
  input.value='';input.style.height='auto';
  scwAppendBubble('visitor',body);
  await scwPersistVisitor(t,body);
  scwRenderRecentTicket();

  const visitorMsgCount=(t._messages||[]).filter(m=>m.sender==='visitor').length;
  const hasHumanReply=(t._messages||[]).some(m=>m.sender==='admin'&&!(t._botMsgs&&t._botMsgs[m.id]));
  if(visitorMsgCount===1&&!t._textSuggested&&!hasHumanReply){
    const match=scwMatchFaq(body);
    if(match){
      t._textSuggested=true;
      scwBotBusy=true;
      scwShowTyping();await scwWait(600);scwHideTyping();
      const sugg=`While you wait — this might help:<br><strong>${escHtml(match.q)}</strong><br>${match.a}`;
      scwAppendBubble('admin',sugg,true);
      await scwPersistBot(t,sugg);
      await scwWait(200);
      scwAppendBubble('admin','Did that solve it, or should we keep this with an agent?');
      await scwPersistBot(t,'Did that solve it, or should we keep this with an agent?');
      scwShowOptions([
        {label:'✅ Yes, that solved it',onclick:`scwResolveByBot('${t.id}')`},
        {label:'🙋 Keep it with an agent',onclick:`scwDismissSuggestion('${t.id}')`},
      ]);
      scwBotBusy=false;
    }
  }
}
async function scwDismissSuggestion(ticketId){
  const t=scwFindTicket(ticketId);if(!t)return;
  scwRemoveOptions();
  const msg='No problem — an agent will follow up here shortly.';
  scwAppendBubble('admin',msg);
  await scwPersistBot(t,msg);
}
function scwKeydown(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();scwSend();}}
function scwResize(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,100)+'px';scwBroadcastTyping();}

function scwRenderHelp(query){
  const el=document.getElementById('scw-faq-list');if(!el)return;
  try{
    if(typeof SCW_FAQ==='undefined'){el.innerHTML='<div class="scw-empty-mini" style="color:var(--red)">Widget error: SCW_FAQ is not defined — the script likely failed to load fully. Check the browser console for a red error.</div>';return;}
    const q=(query||'').toLowerCase();
    const items=SCW_FAQ.filter(f=>!q||f.q.toLowerCase().includes(q)||f.a.toLowerCase().includes(q));
    if(!items.length){el.innerHTML=`<div class="scw-empty-mini">${SCW_FAQ.length?'No articles match that search.':'No help articles configured yet.'}</div>`;return;}
    el.innerHTML=items.map((f,i)=>`<div class="scw-faq-item" id="scw-faq-${i}"><div class="scw-faq-q" onclick="scwToggleFaq(${i})" role="button" tabindex="0" aria-expanded="false" aria-label="${escAttr(f.q)}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}"><span class="scw-faq-q-text">${escHtml(f.q)}</span><span class="chev">›</span></div><div class="scw-faq-a"><div class="scw-faq-a-inner">${f.a}</div></div></div>`).join('');
  }catch(err){
    console.error('scwRenderHelp error:',err);
    el.innerHTML=`<div class="scw-empty-mini" style="color:var(--red)">Widget error: ${escHtml(err.message||String(err))}</div>`;
  }
}
function scwToggleFaq(i){document.getElementById('scw-faq-'+i)?.classList.toggle('open');}

function scwCleanup(){clearInterval(scwPollTimer);if(scwChannel){scwChannel.unsubscribe();scwChannel=null;}}

let scwFirstError=null;
window.addEventListener('error',function(e){
  if(scwFirstError)return;
  scwFirstError=(e&&e.message)?e.message:'Unknown script error';
  console.error('SCW page error:',scwFirstError);
});

try{scwRenderHomeFaq();scwRenderHelp('');}catch(e){console.error('SCW eager render error:',e);}
if(window.__scwEarlyErrors&&window.__scwEarlyErrors.length){
  console.error('SCW early errors:',window.__scwEarlyErrors.join(' | '));
}

/* ══════════════════════════════════════
   ONBOARDING TOUR
   Highlights each sidebar section (plus the "New listing" button)
   in turn with a spotlight + tooltip. Runs once per seller — a flag
   is stored in this browser's localStorage keyed to their user id,
   so it never runs again once they finish or skip it. (It's a
   per-browser flag, not stored server-side, so it would reappear if
   they sign in from a different device or clear site data.)
══════════════════════════════════════ */
const Tour = (() => {
  // `page`: dashboard page this step's target lives on (forces a showPage()
  // switch as a fallback/safety net). `click:true`: this step is a real
  // in-app nav button — the highlighted element becomes genuinely clickable
  // (overlay lets the click through) and clicking it advances the tour.
  // The Continue button still works too ("Click it for me").
  const STEPS = [
    { selector:'#nav-overview', page:'overview', title:'Welcome to your dashboard', desc:"Let's take a quick tour of everything you can do here. This is your Overview — your home base every time you sign in." },
    { selector:'#theme-switch', page:'overview', title:'Choose your theme', desc:'Switch between Emerald, Sandstone, and Midnight — your choice is saved for next time.' },
    { selector:'#verify-warning-banner', page:'overview', title:'Get verified', desc:'Verify your account here to unlock unlimited listings and a trust badge buyers can see. It only takes about 2 minutes.' },
    { selector:'.stat-grid', page:'overview', title:'Your key numbers', desc:'Active listings, total enquiries, unread messages, payments and views — all at a glance.' },
    { selector:'#overview-activity-card', page:'overview', title:'Recent activity', desc:'A live feed of new enquiries, messages, listings and payments. Tap any item to jump straight to it.' },
    { selector:'#overview-chart-card', page:'overview', title:'Messages this week', desc:'See how buyer activity on your listings has trended over the last 7 days.' },
    { selector:'#overview-quicklistings-card', page:'overview', title:'Your listings at a glance', desc:'A quick preview of your properties — tap "Manage" any time to see them all.' },
    { selector:'#btn-new-listing-tour', page:'overview', title:'Post a listing', desc:'Ready to list a property? Tap this any time to add a new apartment, house, or commercial space.' },

    { selector:'#nav-listings', page:'overview', title:'My listings', desc:'Tap "My listings" now to see everything you\'ve posted.', click:true },
    { selector:'#lc-pill-group', page:'listings', title:'Filter by status', desc:'Swipe this strip sideways to jump between Live, Awaiting payment, Pending review, Paused and more. "Needs attention" is always first — it collects everything that needs you today.' },
    { selector:'#lc-saved-views', page:'listings', title:'Smart views', desc:'Shortcuts that find problems for you: underperformers, listings missing photos, buyers you haven\'t replied to, and listings going stale. They only appear when they actually apply.' },
    { selector:'#lc-search-wrap', page:'listings', title:'Search anything', desc:'Search by title, area, address, or listing number — type a number like 000123 to jump straight to it. Press "/" any time to focus this box.' },
    { selector:'#lc-view-btn', page:'listings', title:'Sort, density and CSV', desc:'Tap ⚙ View to change the sort order, switch between roomy cards and a compact list, or download all your listings as a CSV.' },
    { selector:'#lc-select-toggle-btn', page:'listings', title:'Do several at once', desc:'Tap ☑ Select to tick multiple listings, then pause, resume, duplicate, feature, share or delete them all in one go. On mobile you can also long-press any card to jump straight into select mode.' },
    { selector:'#listings-table-card', page:'listings', title:'Your listing cards', desc:"Each card shows the photo, price, status, live stats and a health-score ring — tap the ring for exactly what to fix, or tap anywhere on the card for the full detail panel." },
    { selector:'#listings-table-card', page:'listings', title:'Share, and everything else', desc:'Share to WhatsApp, Facebook, Instagram, TikTok, or a QR code — free for every seller. The ⋯ menu holds the rest: duplicate, manage units, add video, request a price change, download a brochure, pause or delete.' },

    { selector:'#nav-messages', page:'listings', title:'Messages', desc:'Tap "Messages" to see every conversation with buyers in one place.', click:true },
    { selector:'#thread-list', page:'messages', title:'Your inbox', desc:'All your buyer conversations live here, newest first. A green dot marks unread ones.' },
    { selector:'#chat-pane', page:'messages', title:'Chat with buyers', desc:'Open a conversation to reply directly, or via WhatsApp if the buyer shared their number. Tap the message icon by the input box any time for ready-made professional replies.' },
    { selector:'#nav-reviews', page:'messages', title:'Reviews', desc:'Tap "Reviews" to see what buyers are saying about you.', click:true },
    { selector:'#reviews-list', page:'reviews', title:'Buyer reviews', desc:'Respond to reviews to build trust — your reply appears publicly once posted.' },
    { selector:'#nav-payments', page:'reviews', title:'Payments', desc:'Tap "Payments" to see your listing fee history.', click:true },
    { selector:'#payment-summary', page:'payments', title:'Payment history', desc:'Track what you\'ve paid, download receipts, and export everything to CSV.' },
    { selector:'#nav-rent-ledger', page:'payments', title:'Rent Ledger (Elite)', desc:'Tap "Rent Ledger" — track rent due dates, tenants, and payments for units you manage long-term.', click:true },
    { selector:['#rent-ledger-content','#rent-ledger-locked'], page:'rent-ledger', title:'Your rent roll', desc:'Add rental units, log payments, and get automatic overdue and lease-expiry alerts.' },
    { selector:'#rl-capacity-switcher', page:'rent-ledger', title:'Switch ledger view', desc:'If you manage both long-term rentals and Airbnb/BNB, switch between the two ledgers here.' },
    { selector:'#nav-demand-heatmap', page:'rent-ledger', title:'Demand Insights (Elite)', desc:'Tap "Demand Insights" to see where buyers are searching most right now.', click:true },
    { selector:['#demand-content','#demand-locked'], page:'demand-heatmap', title:'Platform-wide demand', desc:'See top areas, categories, and rent-vs-sale demand — and how your listings compare to the area average.' },

    { selector:'#nav-settings', page:'demand-heatmap', title:'Settings', desc:'Tap "Settings" to manage your profile, notifications, and plan.', click:true },
    { selector:'#verification-settings-section', page:'settings', title:'Account verification', desc:'Submit your ID and proof of ownership here to get verified and unlock unlimited listings.' },
    { selector:'#settings-quicknav', page:'settings', title:'Jump to any settings section', desc:'Use these shortcuts to jump straight to Profile, Verification, Privacy, Notifications, Premium, Elite or Team — no more scrolling to find what you need.' },
    { selector:'#settings-contact-privacy-section', page:'settings', title:'Contact privacy', desc:'Hide your Call/WhatsApp buttons platform-wide so buyers can only reach you through chat — right here, not buried at the bottom.' },
    { selector:'#settings-premium-section', page:'settings', title:'Premium & Elite', desc:'Premium unlocks managed chat, a Pro badge and SMS alerts. Video walkthroughs are free. Elite adds AI tools, Instant Valuation, a branded Storefront, Rent Ledger and Demand Insights.' },
    { selector:'#nav-premium-upgrade', page:'settings', title:'Upgrade any time', desc:'Your plan status always shows here in the sidebar — tap it any time to upgrade.' },
    { selector:'#sidebar-user-block', page:'settings', title:"That's it!", desc:'Your account and sign-out are always one tap away from here. Enjoy Nyumba254! 🎉' },
  ];

  let idx = 0, storageKey = null, advancedThisStep = false, clickListener = null, repositionRaf = null;

  function isVisible(el){
    if(!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function resolveTarget(step){
    const selectors = Array.isArray(step.selector) ? step.selector : [step.selector];
    for(const sel of selectors){
      const el = document.querySelector(sel);
      if(el && isVisible(el)) return el;
    }
    return null;
  }
  function isMobile(){ return window.matchMedia('(max-width:640px)').matches; }
  function currentPageName(){
    const active = document.querySelector('.page.active');
    return active ? active.id.replace('page-','') : null;
  }

  function maybeStart(){
    if(!currentUser) return;
    storageKey = `ny_tour_v4_seen_${currentUser.id}`;
    if(localStorage.getItem(storageKey)) return;
    idx = 0;
    start();
  }
  function restart(){
    if(currentUser){ storageKey = `ny_tour_v4_seen_${currentUser.id}`; localStorage.removeItem(storageKey); }
    idx = 0;
    start();
  }
  function start(){
    openSidebar();
    document.getElementById('tour-overlay').classList.add('open');
    scwSyncOverlayVisibility();
    showStep(1);
  }

  function showStep(dir){
    dir = dir || 1;
    if(idx < 0) idx = 0;
    const step = STEPS[idx];
    if(!step){ finish(); return; }

    if(window.__tourShort && !['Welcome to your dashboard','Your key numbers','Post a listing','My listings','Messages','Settings',"That's it!"].includes(step.title)){ idx += dir; showStep(dir); return; }
    if(!window.__tourShort && step.page && currentPageName() !== step.page) showPage(step.page);

    requestAnimationFrame(() => {
      const target = resolveTarget(step);
      if(!target){ idx += dir; showStep(dir); return; }

      if(isMobile()){
        const sb = document.getElementById('sidebar');
        if(sb && sb.contains(target) && !sb.classList.contains('open')) openSidebar();
      }
      target.scrollIntoView({ block:'center', inline:'nearest' });
      setTimeout(() => renderStep(step, target), isMobile() ? 240 : 60);
    });
  }

  function renderStep(step, target){
    advancedThisStep = false;
    detachClickListener();

    document.getElementById('tour-step-label').textContent = window.__tourShort ? 'Quick tour' : `Step ${idx+1} of ${STEPS.length}`;
    document.getElementById('tour-progress-fill').style.width = Math.round(((idx+1)/STEPS.length)*100) + '%';
    document.getElementById('tour-title').textContent = step.title;
    document.getElementById('tour-desc').textContent = step.desc;
    document.getElementById('tour-click-hint').style.display = step.click ? 'flex' : 'none';
    document.getElementById('tour-btn-continue').textContent = (idx === STEPS.length-1) ? 'Finish' : (step.click ? 'Click it for me' : 'Continue');
    document.getElementById('tour-btn-back').style.visibility = idx === 0 ? 'hidden' : 'visible';

    document.getElementById('tour-overlay').classList.toggle('tour-passthrough', !!step.click);
    document.getElementById('tour-spotlight').classList.toggle('tour-clickable', !!step.click);

    positionSpotlight(target);
    positionTooltip(target);

    if(step.click) attachClickListener(target);
  }

  function positionSpotlight(target){
    const r = target.getBoundingClientRect();
    const pad = 8;
    const spot = document.getElementById('tour-spotlight');
    spot.style.top = Math.max(0, r.top - pad) + 'px';
    spot.style.left = Math.max(0, r.left - pad) + 'px';
    spot.style.width = Math.min(r.width + pad*2, window.innerWidth) + 'px';
    spot.style.height = (r.height + pad*2) + 'px';
  }

  function positionTooltip(target){
    const tip = document.getElementById('tour-tooltip');
    tip.style.bottom = 'auto';
    const margin = isMobile() ? 8 : 16;
    const vw = window.innerWidth, vh = window.innerHeight;
    const r = target.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const tipH = Math.min(tipRect.height, vh - margin*2);
    const tipW = tipRect.width;

    // Prefer directly below the target; flip above if there's no room below;
    // if neither fits cleanly, pin to whichever edge keeps more of the
    // target visible, then clamp fully inside the viewport either way.
    let top;
    const below = r.bottom + 14;
    const above = r.top - 14 - tipH;
    if(below + tipH <= vh - margin){
      top = below;
    }else if(above >= margin){
      top = above;
    }else{
      top = (r.top > vh - r.bottom) ? margin : Math.max(margin, vh - tipH - margin);
    }
    top = Math.max(margin, Math.min(top, vh - tipH - margin));

    let left = isMobile() ? margin : r.left;
    if(!isMobile()){
      if(left + tipW > vw - margin) left = vw - tipW - margin;
      if(left < margin) left = margin;
    }

    tip.style.top = top + 'px';
    tip.style.left = left + 'px';
  }

  function attachClickListener(target){
    const fn = function(){
      if(advancedThisStep) return;
      advancedThisStep = true;
      setTimeout(() => { idx += 1; showStep(1); }, 180);
    };
    target.addEventListener('click', fn, true);
    clickListener = { el: target, fn };
  }
  function detachClickListener(){
    if(clickListener){
      clickListener.el.removeEventListener('click', clickListener.fn, true);
      clickListener = null;
    }
  }

  function next(){
    const step = STEPS[idx];
    if(step && step.click && !advancedThisStep){
      const target = resolveTarget(step);
      if(target){ target.click(); return; }
    }
    idx += 1;
    showStep(1);
  }
  function back(){
    if(idx <= 0) return;
    idx -= 1;
    showStep(-1);
  }
  function skip(){ finish(); }

  function finish(){
    detachClickListener();
    document.getElementById('tour-overlay').classList.remove('open','tour-passthrough');
    closeSidebar();
    scwSyncOverlayVisibility();
    if(storageKey) localStorage.setItem(storageKey, '1');
  }

  function reposition(){
    if(!document.getElementById('tour-overlay').classList.contains('open')) return;
    if(repositionRaf) cancelAnimationFrame(repositionRaf);
    repositionRaf = requestAnimationFrame(() => {
      const step = STEPS[idx];
      const target = step ? resolveTarget(step) : null;
      if(!target) return;
      positionSpotlight(target);
      positionTooltip(target);
    });
  }
  window.addEventListener('resize', reposition);
  window.addEventListener('scroll', reposition, { passive:true, capture:true });

  return { maybeStart, next, back, skip, restart };
})();
/* ══════════════════════════════════════
   RENT LEDGER TOUR — fully independent of the main onboarding Tour.
   Own overlay ids (rl-tour-*), own localStorage key, own replay button
   (top of the Rent Ledger toolbar). Never touches window.Tour.
══════════════════════════════════════ */
const RLTour = (() => {
  const STEPS = [
    { selector:'#rl-portfolio-health-card', title:'Your Portfolio Health Score', desc:'One number blending occupancy, this month\'s collection rate, 12-month tenant reliability, and lease-expiry risk. Aim to keep this green.' },
    { selector:'#rl-goal-card', title:'Set a rent-roll goal', desc:'Give yourself a monthly income target and watch this bar fill up as your active leases add up.' },
    { selector:'.rl-tabs', title:'Six views into your portfolio', desc:'Units, the full 12-month ledger, Analytics, the Lease pipeline, Finances (income vs expenses), and Maintenance — all in one place.' },
    { selector:'#rental-units-list', title:'Each unit, at a glance', desc:'Colour-coded by health. Log payments, view full tenant history, send staged rent reminders, set up automatic rent escalation, or mark a unit vacant/occupied.' },
    { selector:'#btn-reminder-settings', title:'Automatic reminders', desc:'Turn on auto-reminders and choose how many days before rent is due tenants get a heads-up. Reminders escalate automatically the longer rent stays unpaid.' },
    { selector:'[data-tab="pipeline"]', title:'Lease renewal pipeline', desc:'Tap "Lease pipeline" — every lease expiring in the next 90 days, sorted so you never get caught off guard by a move-out.', click:true },
    { selector:'[data-tab="finances"]', title:'Real income vs expenses', desc:'Tap "Finances" — log repairs, rates, and other costs, and see your true net income per unit and across your whole portfolio.', click:true },
    { selector:'[data-tab="maintenance"]', title:'Maintenance log', desc:'Tap "Maintenance" — track every repair request from reported to resolved, with cost, so nothing falls through the cracks.', click:true },
    { selector:'#btn-remind-overdue', title:"That's the tour!", desc:'One more thing: "Remind all overdue" sends a reminder to every tenant currently behind on rent, in one click. Enjoy your upgraded ledger! 🎉' },
  ];
  let idx = 0, storageKey = null, advancedThisStep = false, clickListener = null;

  function isVisible(el){ if(!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
  function isMobile(){ return window.matchMedia('(max-width:640px)').matches; }

  function maybeStart(){
    if(!currentUser || !eliteActive()) return;
    storageKey = `ny_rl_tour_seen_${currentUser.id}`;
    if(localStorage.getItem(storageKey)) return;
    idx = 0;
    start();
  }
  function restart(){
    if(currentUser) localStorage.removeItem(`ny_rl_tour_seen_${currentUser.id}`);
    idx = 0;
    start();
  }
  function start(){
    document.getElementById('rl-tour-overlay').classList.add('open');
    scwSyncOverlayVisibility();
    showStep(1);
  }

  function showStep(dir){
    dir = dir || 1;
    if(idx < 0) idx = 0;
    const step = STEPS[idx];
    if(!step){ finish(); return; }
    requestAnimationFrame(() => {
      const target = document.querySelector(step.selector);
      if(!target || !isVisible(target)){ idx += dir; showStep(dir); return; }
      target.scrollIntoView({ block:'center', inline:'nearest' });
      setTimeout(() => renderStep(step, target), 80);
    });
  }

  function renderStep(step, target){
    advancedThisStep = false;
    detachClickListener();
    document.getElementById('rl-tour-step-label').textContent = `Step ${idx+1} of ${STEPS.length}`;
    document.getElementById('rl-tour-progress-fill').style.width = Math.round(((idx+1)/STEPS.length)*100) + '%';
    document.getElementById('rl-tour-title').textContent = step.title;
    document.getElementById('rl-tour-desc').textContent = step.desc;
    document.getElementById('rl-tour-btn-continue').textContent = (idx === STEPS.length-1) ? 'Finish' : (step.click ? 'Click it for me' : 'Continue');
    document.getElementById('rl-tour-btn-back').style.visibility = idx === 0 ? 'hidden' : 'visible';
    document.getElementById('rl-tour-overlay').classList.toggle('tour-passthrough', !!step.click);
    document.getElementById('rl-tour-spotlight').classList.toggle('tour-clickable', !!step.click);
    positionSpotlight(target);
    positionTooltip(target);
    if(step.click) attachClickListener(target);
  }

  function positionSpotlight(target){
    const r = target.getBoundingClientRect(); const pad = 8;
    const spot = document.getElementById('rl-tour-spotlight');
    spot.style.top = Math.max(0, r.top - pad) + 'px';
    spot.style.left = Math.max(0, r.left - pad) + 'px';
    spot.style.width = Math.min(r.width + pad*2, window.innerWidth) + 'px';
    spot.style.height = (r.height + pad*2) + 'px';
  }
  function positionTooltip(target){
    const tip = document.getElementById('rl-tour-tooltip');
    tip.style.bottom = 'auto';
    const margin = isMobile() ? 8 : 16;
    const vw = window.innerWidth, vh = window.innerHeight;
    const r = target.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const tipH = Math.min(tipRect.height, vh - margin*2);
    const tipW = tipRect.width;
    let top;
    const below = r.bottom + 14, above = r.top - 14 - tipH;
    if(below + tipH <= vh - margin) top = below;
    else if(above >= margin) top = above;
    else top = (r.top > vh - r.bottom) ? margin : Math.max(margin, vh - tipH - margin);
    top = Math.max(margin, Math.min(top, vh - tipH - margin));
    let left = isMobile() ? margin : r.left;
    if(!isMobile()){ if(left + tipW > vw - margin) left = vw - tipW - margin; if(left < margin) left = margin; }
    tip.style.top = top + 'px'; tip.style.left = left + 'px';
  }
  function attachClickListener(target){
    const fn = function(){ if(advancedThisStep) return; advancedThisStep = true; setTimeout(() => { idx += 1; showStep(1); }, 180); };
    target.addEventListener('click', fn, true);
    clickListener = { el: target, fn };
  }
  function detachClickListener(){ if(clickListener){ clickListener.el.removeEventListener('click', clickListener.fn, true); clickListener = null; } }

  function next(){
    const step = STEPS[idx];
    if(step && step.click && !advancedThisStep){ const target = document.querySelector(step.selector); if(target){ target.click(); return; } }
    idx += 1; showStep(1);
  }
  function back(){ if(idx <= 0) return; idx -= 1; showStep(-1); }
  function skip(){ finish(); }
  function finish(){
    detachClickListener();
    document.getElementById('rl-tour-overlay').classList.remove('open','tour-passthrough');
    scwSyncOverlayVisibility();
    if(storageKey) localStorage.setItem(storageKey, '1');
  }

  window.addEventListener('resize', () => { if(document.getElementById('rl-tour-overlay').classList.contains('open')){ const step=STEPS[idx]; const target=step&&document.querySelector(step.selector); if(target){ positionSpotlight(target); positionTooltip(target); } } });

  return { maybeStart, next, back, skip, restart };
})();
async function joinEliteWaitlist(){
  try{localStorage.setItem('ny_elite_waitlist_'+currentUser.id,'1');}catch(e){}
  notifyAdmin('elite_waitlist',{sellerName:currentProfile?.full_name||currentUser?.email,sellerEmail:currentUser?.email});
  showToast("You're on the list — we'll notify you here and by email when Elite opens.",'success');
}
function tourOffer(){
  const key=`ny_tour_v4_seen_${currentUser.id}`;
  if(localStorage.getItem(key)||document.getElementById('tour-offer'))return;
  const d=document.createElement('div');
  d.id='tour-offer';
  d.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:calc(88px + env(safe-area-inset-bottom));z-index:395;background:var(--white);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-lg);padding:14px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;max-width:calc(100vw - 24px)';
  d.innerHTML='<span style="font-size:13px;font-weight:600">👋 New here? Take a quick tour.</span><button class="btn btn-primary btn-sm" id="tour-offer-yes">Start tour</button><button class="btn btn-outline btn-sm" id="tour-offer-no">Not now</button>';
  document.body.appendChild(d);
  d.querySelector('#tour-offer-yes').onclick=()=>{d.remove();window.__tourShort=true;Tour.restart();};
  d.querySelector('#tour-offer-no').onclick=()=>{d.remove();localStorage.setItem(key,'1');};
}
/* ── Pay modal helpers ── */
function copyPayDetail(val,label){
  navigator.clipboard.writeText(val).then(()=>showToast(label+' copied ✓','success')).catch(()=>showToast(label+': '+val,''));
}
function parsePaySms(text){
  const note=document.getElementById('pay-sms-note');
  const refInput=document.getElementById('pay-listing-ref');
  text=text||'';
  if(!note||!refInput)return;
  if(!text.trim()){note.textContent='';return;}
  const m=text.match(/\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{10}\b/);
  if(!m){note.style.color='var(--red)';note.textContent="Couldn't find a 10-character code in that message — type it above instead.";return;}
  refInput.value=m[0];
  const a=text.match(/Ksh\.?\s?([\d,]+(?:\.\d+)?)/i);
  const paid=a?parseFloat(a[1].replace(/,/g,'')):null;
  const expected=parseFloat((document.getElementById('pay-listing-amount-display')?.textContent||'').replace(/[^\d.]/g,''))||0;
  if(paid!==null&&expected&&Math.round(paid)<Math.round(expected)){
    note.style.color='var(--red)';
    note.textContent=`Code ${m[0]} found, but the SMS shows KES ${paid.toLocaleString('en-KE')} and this costs KES ${expected.toLocaleString('en-KE')}.`;
    return;
  }
  note.style.color='var(--green-dark)';
  note.textContent=`Code ${m[0]} found${paid!==null?' · KES '+paid.toLocaleString('en-KE'):''} ✓`;
}

/* ── Editable quick replies (saved per device) ── */
function qrKey(){return 'ny_custom_qr_'+(currentUser?.id||'');}
function qrCustom(){try{return JSON.parse(localStorage.getItem(qrKey())||'[]');}catch(e){return[];}}
function qrSaveCustom(a){try{localStorage.setItem(qrKey(),JSON.stringify(a.slice(0,20)));}catch(e){}}
function qrAll(){return [...QUICK_REPLIES,...qrCustom().map(q=>({...q,custom:true}))];}
function qrFill(text){
  const t=activeThread;
  const l=t?allListings.find(x=>String(x.id)===String(t.listing_id)):null;
  const price=l?(lcHasUnits(l)?muPriceRangeText(l):fmtKES(l.price,l.price_type==='rent'?'/mo':'')):'';
  const first=t?(t.buyer_name||'').split(' ')[0]:'';
  return String(text)
    .replace(/\{listing_title\}/g,l?l.title:(t?t.listing_title:''))
    .replace(/\{price\}/g,price)
    .replace(/\{buyer_name\}/g,first)
    .replace(/\{area\}/g,l?(l.area||''):'');
}
function renderQuickReplyBar(){
  const bar=document.getElementById('chat-quickreply-bar');
  if(!bar)return;
  bar.innerHTML=qrAll().map((q,i)=>`<div class="qr-chip" onclick="insertQuickReply(${i})">${escHtml(q.label)}${q.custom?`<span onclick="event.stopPropagation();deleteCustomQuickReply(${i-QUICK_REPLIES.length})" title="Delete" style="margin-left:6px;opacity:.6">✕</span>`:''}</div>`).join('')
    +`<div class="qr-chip" style="border-style:dashed;background:transparent" onclick="saveCustomQuickReply()">＋ Save my message</div>`;
}
function toggleQuickReplyBar(){
  const bar=document.getElementById('chat-quickreply-bar');
  if(!bar)return;
  const show=bar.style.display==='none';
  if(show)renderQuickReplyBar();
  bar.style.display=show?'flex':'none';
}
function insertQuickReply(i){
  const q=qrAll()[i];if(!q)return;
  const input=document.getElementById('chat-reply-input');
  if(!input)return;
  input.value=qrFill(q.text);
  autoResizeTextarea(input);
  input.focus();
  document.getElementById('chat-quickreply-bar').style.display='none';
}
function saveCustomQuickReply(){
  const input=document.getElementById('chat-reply-input');
  const text=(input?.value||'').trim();
  if(!text){showToast('Type your message in the box first, then tap Save','error');return;}
  const label=text.split(/\s+/).slice(0,3).join(' ').slice(0,28);
  const list=qrCustom();
  list.push({label,text});
  qrSaveCustom(list);
  renderQuickReplyBar();
  showToast('Saved ✓ — tip: use {listing_title}, {price}, {buyer_name} or {area} to auto-fill','success');
}
function deleteCustomQuickReply(idx){
  const list=qrCustom();
  list.splice(idx,1);
  qrSaveCustom(list);
  renderQuickReplyBar();
}

/* ── Settings tabs ── */
const SETTINGS_TABS={
  'settings-profile-anchor':'profile','settings-contact-privacy-section':'profile',
  'verification-settings-section':'verification',
  'settings-notifications-section':'notifications','settings-sms-section':'notifications','settings-concierge-section':'notifications',
  'settings-premium-section':'plan','settings-bnb-section':'plan','settings-elite-section':'plan','settings-rm-section':'plan',
  'settings-team-section':'team'
};
function settingsApplyTab(tab,activeId){
  Object.entries(SETTINGS_TABS).forEach(([id,t])=>document.getElementById(id)?.classList.toggle('st-hide',t!==tab));
  document.querySelectorAll('#settings-quicknav .filter-pill').forEach(b=>{
    const m=(b.getAttribute('onclick')||'').match(/'([^']+)'/);
    b.classList.toggle('active',!!m&&m[1]===activeId);
  });
  const grid=document.querySelector('#page-settings .settings-grid');
  if(grid)grid.style.gridTemplateColumns=tab==='profile'?'':'minmax(0,760px)';
}
function settingsJumpTo(id){
  const tab=SETTINGS_TABS[id];
  if(tab)settingsApplyTab(tab,id);
  const el=document.getElementById(id);
  if(!el)return;
  el.scrollIntoView({behavior:'smooth',block:'start'});
  el.style.transition='box-shadow .3s';
  el.style.boxShadow='0 0 0 3px var(--green)';
  setTimeout(()=>{el.style.boxShadow='';},1500);
}
settingsApplyTab('profile','settings-profile-anchor');
window.addEventListener('popstate',()=>{const n=location.hash.slice(1);if(n&&document.getElementById('page-'+n)){window.__navFromHash=true;showPage(n);window.__navFromHash=false;}});
init();
