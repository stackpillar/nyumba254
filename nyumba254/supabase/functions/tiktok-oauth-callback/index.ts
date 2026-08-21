// supabase/functions/tiktok-oauth-callback/index.ts

const TIKTOK_CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY")!;
const TIKTOK_CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// This must exactly match the callback URL, and must be set as the
// Redirect URI in your TikTok Developer app's Login Kit settings.
const REDIRECT_URI = `${SUPABASE_URL.replace(".supabase.co", ".supabase.co")}/functions/v1/tiktok-oauth-callback`;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  // Case 1: TikTok sent us back an error (user declined, etc.)
  if (error) {
    return new Response(
      `<h2>TikTok authorization failed</h2><p>${url.searchParams.get("error_description") ?? error}</p>`,
      { headers: { "Content-Type": "text/html" }, status: 400 }
    );
  }

  // Case 2: No code yet — send the user to TikTok's consent screen
  if (!code) {
    const authUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
    authUrl.searchParams.set("client_key", TIKTOK_CLIENT_KEY);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "user.info.basic,video.publish");
    authUrl.searchParams.set("state", crypto.randomUUID());
    return Response.redirect(authUrl.toString(), 302);
  }

  // Case 3: We have a code — exchange it for tokens
  try {
    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: TIKTOK_CLIENT_KEY,
        client_secret: TIKTOK_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      return new Response(
        `<h2>Token exchange failed</h2><pre>${JSON.stringify(tokenData, null, 2)}</pre>`,
        { headers: { "Content-Type": "text/html" }, status: 400 }
      );
    }

    // Save tokens to Supabase using the service role key (bypasses RLS)
    const nowIso = new Date().toISOString();
    const saveRes = await fetch(
      `${SUPABASE_URL}/rest/v1/social_oauth_tokens?on_conflict=platform`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Prefer": "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          platform: "tiktok",
          open_id: tokenData.open_id,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          refresh_expires_at: tokenData.refresh_expires_in
            ? new Date(Date.now() + tokenData.refresh_expires_in * 1000).toISOString()
            : null,
          updated_at: nowIso,
        }),
      }
    );

    if (!saveRes.ok) {
      const errText = await saveRes.text();
      return new Response(
        `<h2>Saved token exchange but DB insert failed</h2><pre>${errText}</pre>`,
        { headers: { "Content-Type": "text/html" }, status: 500 }
      );
    }

    return new Response(`<h2>TikTok connected ✓</h2><p>You can close this tab.</p>`, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (err) {
    return new Response(`<h2>Unexpected error</h2><pre>${err}</pre>`, {
      headers: { "Content-Type": "text/html" },
      status: 500,
    });
  }
});