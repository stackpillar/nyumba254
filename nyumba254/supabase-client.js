// Centralized Supabase client initializer for Nyumba254
// Sets global variables so existing inline scripts keep working without local keys.
(function(){
  if (typeof supabase === 'undefined') {
    console.warn('Supabase SDK not loaded before supabase-client.js');
    return;
  }

  // Public (publishable) values used by client-side code. Keep as globals so
  // existing inline scripts that call createClient(SUPABASE_URL, SUPABASE_KEY)
  // continue to work after these in-page consts are removed.
  window.SUPABASE_URL = 'https://vliuuloyfhyxcsuchpss.supabase.co';
  window.SUPABASE_KEY = 'sb_publishable_oIIcecf3wzKMual5K24Z8Q_zmxVfgsx';

  // Create and expose a shared client instance and common aliases.
  try {
    const client = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
    window.supabaseClient = client;
    window.sb = client;
    window.db = client;
  } catch (err) {
    console.error('Failed to create Supabase client in supabase-client.js', err);
  }
})();
