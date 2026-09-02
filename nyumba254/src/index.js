export default {
  async fetch(request, env) {
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