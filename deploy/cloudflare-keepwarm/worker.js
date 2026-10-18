// Cron-only Worker: one anonymous request keeps the free Render API instance
// awake during waking hours. No secrets, no routes, no user data; the API
// answers 401 and that is the expected result.
export const KEEPWARM_URL = 'https://petalpal-v2.onrender.com/healthz';

export async function ping(fetchImpl = fetch) {
  const response = await fetchImpl(KEEPWARM_URL, {
    method: 'GET', headers: { 'User-Agent': 'petalpal-keepwarm' }, signal: AbortSignal.timeout(60_000)
  });
  if (response.body) await response.body.cancel();
  return response.status;
}

export default {
  async scheduled(_event, _env, ctx) {
    ctx.waitUntil(ping().catch(() => 0));
  }
};
