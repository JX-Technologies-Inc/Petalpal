import staticWorker from './worker.js';
import { installPreviewFixtures } from './preview-fixtures.js';

// Separate entry point prevents any fixture/bypass code entering normal hosting.
export default {
  async fetch(request, env) {
    if (env.STATIC_PREVIEW_ONLY !== '1') {
      return new Response('Synthetic preview configuration required', { status: 503,
        headers: { 'Cache-Control': 'no-store' } });
    }
    const path = new URL(request.url).pathname;
    const response = path === '/__preview-fixtures.js' && ['GET', 'HEAD'].includes(request.method)
      ? new Response(request.method === 'HEAD' ? null : `(${installPreviewFixtures.toString()})();`, {
        headers: { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff' }
      })
      : await staticWorker.fetch(request, env);
    const result = new Response(response.body, response);
    const policy = result.headers.get('Content-Security-Policy');
    if (policy) result.headers.set('Content-Security-Policy', policy.replace(' https://lh3.googleusercontent.com', ''));
    if (request.method === 'GET' && result.headers.get('Content-Type')?.includes('text/html')) {
      return new HTMLRewriter().on('head', { element(head) {
        head.prepend('<script src="/__preview-fixtures.js"></script>', { html: true });
      } }).transform(result);
    }
    return result;
  }
};
