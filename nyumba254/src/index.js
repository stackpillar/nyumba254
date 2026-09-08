export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === 'admin.nyumba254.com' && (url.pathname === '/' || url.pathname === '')) {
      url.pathname = '/nk-ctrl-7f3k2x9';
      return env.ASSETS.fetch(new Request(url, request));
    }

    const response = await env.ASSETS.fetch(request);

    if (response.status === 404) {
      const notFoundUrl = new URL('/404', request.url);
      const notFoundResponse = await env.ASSETS.fetch(new Request(notFoundUrl, request));
      return new Response(notFoundResponse.body, {
        status: 404,
        headers: notFoundResponse.headers,
      });
    }

    return response;
  },
};