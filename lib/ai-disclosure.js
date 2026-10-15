export const AI_DISCLOSURE_VERSION = 'ai-2026-10-15';
// Public feature status only. Never return URLs, keys, account IDs or raw env.
export function aiDisclosure(env = process.env) {
  const workers = Boolean(env.CLOUDFLARE_WORKER_AI_URL && env.CLOUDFLARE_WORKER_AI_TOKEN);
  const anthropic = env.AI_GATEWAY_ENABLED === 'true' && env.AI_GATEWAY_ANTHROPIC_ENABLED === 'true';
  const emotion = env.AI_EVENT_EMOTION_PROVIDER ?? 'workers-ai';
  const weekly = env.AI_WEEKLY_REPORT_PROVIDER ?? 'workers-ai';
  const monthly = env.AI_MONTHLY_REPORT_PROVIDER ?? 'workers-ai';
  return { version: AI_DISCLOSURE_VERSION, features: [
    { feature:'Event emotion labels', processor:emotion==='anthropic'?'Anthropic through Cloudflare AI Gateway':'Cloudflare Workers AI', configured:emotion==='anthropic'?anthropic:emotion==='workers-ai'&&workers },
    { feature:'Voice transcription (including voice used while writing a Journal)', processor:'Cloudflare Workers AI', configured:workers },
    { feature:'Event memory embeddings', processor:'Cloudflare Workers AI', configured:workers },
    { feature:'Weekly reflection narrative', processor:weekly==='anthropic'?'Anthropic through Cloudflare AI Gateway':'Cloudflare Workers AI', configured:weekly==='anthropic'?anthropic:weekly==='workers-ai'&&workers },
    { feature:'Monthly reflection narrative', processor:monthly==='anthropic'?'Anthropic through Cloudflare AI Gateway':'Cloudflare Workers AI', configured:monthly==='anthropic'?anthropic:monthly==='workers-ai'&&workers },
  ], explanation:'AI Processing permits sending Event text and selected mood for emotion suggestions, and recordings you submit for speech transcription, to the configured services below. Personalization permits using eligible Events for personalized reflections. Long-term Memory permits storing Event summaries and embeddings and using them in weekly/monthly reflections. Reflection requests can include Event excerpts, dates, mood labels and derived memories. Typed Journal text and Journal photos are excluded from Event memory and reflections. Voice recordings are sent for transcription even when used to compose a Journal. You can type instead. Features shown as unavailable do not become active by granting consent. Configured does not guarantee service availability.',
    retention:'Processing may occur outside your country. Provider retention, regional processing and contract settings require owner verification; no zero-retention or no-training guarantee is made here. Withdrawal prevents future eligible dispatch and discards stale results, but cannot recall requests already sent or erase provider copies automatically. Disabling Memory removes derived memories and saved reflections from the active database; original Events and Journals remain until you delete them.' };
}
