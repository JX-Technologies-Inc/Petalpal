# REAL AI smoke preparation — not executed

Prepared from PR #37 at `f9584e7b22563e36e1d3b887c0fc049fe4e10318` in a separate
worktree. No production code, MOCK workflow, existing data or credentials changed.
This preparation is not evidence of real AI success. Do not commit, publish,
provision, configure secrets, dispatch or infer without explicit owner approval.

## Scope and acceptance

The manual workflow reuses the pgvector service and pre/post-migration verifier
from PR #37. The same disposable database name exists only inside each job's own
service container; no hosted or developer database is used. Node is pinned to
24.21.0. Firebase Auth Emulator uses `demo-petalpal-real-ai`, synthetic users, real
Admin SDK verification and existing HTTP ownership/consent middleware. No verifier
stub or Firebase cloud credential is used. This does not validate hosted Firebase.

Five existing Events: A's a04 (September), a05, a06, a08 (October), and B's b01.
Weekly Oct 5: two Events versus two in the previous week. October Monthly: three
versus one in September. The recovery query should rank a08 first and exclude B.
A Journal decoy goes through Daily Grow and must create no Event, memory job or
inference. The empty Sep 21 week exercises insufficient evidence without an LLM.

Reuse actual Event, deterministic EventMemory extraction, Cloudflare BGE profile,
pgvector retrieval, cost gate, report worker and provenance validation. Weekly
uses the authenticated route; Monthly uses the existing job repository/worker.
The test-only factory hook supplies a real worker with the simulated report date.
Jobs are run once; no queue, background worker, retry or automatic workflow rerun.

The evidence artifact contains synthetic Events, classified emotions, memory
summaries, vector metadata, ranked IDs, report text, deterministic trends and
citations. Automated success is explicitly `QUALITY_REVIEW_REQUIRED`. A human
must check every factual claim against Events, causal/temporal accuracy, emotion
appropriateness, omitted milestones and leakage; valid citation IDs alone are
not proof of groundedness. No full vectors, tokens, SDK errors or raw logs are
uploaded. Runtime evidence is not yet recorded in LONG_TERM_AI.md.

## Manual setup — only after approval

1. In a dedicated non-production Cloudflare account, use the prepared
   `cloudflare-worker/wrangler.real-ai-smoke.jsonc`, never the default/staging/
   production config. From the reviewed worktree, an authorized human may run
   `wrangler deploy --config cloudflare-worker/wrangler.real-ai-smoke.jsonc`.
   This creates only `petalpal-real-ai-smoke`; before its secret exists, all
   requests fail closed. Review Wrangler's proposed resources before proceeding.
   The config binds Workers AI as `AI`, sets `SMOKE_ONLY=1` and pins
   `REPORT_NARRATIVE_MODEL=@cf/meta/llama-3.3-70b-instruct-fp8-fast`.
   No queue, executor URL/token, Cron, database, routes or production bindings.
2. Human operator creates a fresh test-only random secret in a password manager.
   Set it on this Worker using the interactive prompt:
   `wrangler secret put RENDER_SHARED_SECRET --config cloudflare-worker/wrangler.real-ai-smoke.jsonc`.
   Never supply its value as a command argument, in a file committed to Git, or
   in chat. Store the same value through GitHub's secret UI below. No production
   or hosted integration secret is reusable for this run.
3. Create GitHub environment `petalpal-real-ai-smoke`, require an owner reviewer,
   prevent self-review/admin bypass where supported, and allow only the reviewed
   smoke branch. Verify these protections are effective before any dispatch.
   Add environment variable `REAL_AI_WORKER_URL` with the dedicated Worker root
   URL (`https://petalpal-real-ai-smoke.<account-subdomain>.workers.dev`), and
   environment secret `REAL_AI_WORKER_TOKEN` with the test secret above.
   Only the inference step maps these to `CLOUDFLARE_WORKER_AI_URL` and
   `CLOUDFLARE_WORKER_AI_TOKEN`; installation and migrations receive neither.
4. Publishing needs separate approval. GitHub requires a workflow_dispatch
   workflow to exist on the default branch before it can be manually launched.
   A reviewed companion change must establish this workflow there, or an
   explicitly approved isolated test repository must host the reviewed source.
   Do not merge PR #37 as a shortcut. Do not add push/PR triggers.
5. After explicit approval of the reviewed source, target and estimated spend,
   select that exact commit's branch and enter its full SHA as `source_sha` and
   `APPROVE-16-REAL-AI-CALLS` as authorization. The job also requires the protected
   environment approval. First attempt only; inspect a failure before proposing
   any fresh dispatch. Download only the synthetic evidence artifact for review.

## Calls and cost

| Provider model | Maximum requests in one runner | Bound |
|---|---:|---|
| `@cf/meta/llama-3.1-8b-instruct-fast` | 5 | 600-character fixture text; 2,000-byte serialized messages; 64 output tokens |
| `@cf/baai/bge-small-en-v1.5` | 9 | 5 document + 4 query embeddings; one text of at most 2,000 characters/request; 384 dimensions |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 2 | 24,000-byte serialized messages/request; 1,024 output tokens/request |

Four BGE queries are relevance/owner scoping, Weekly, Monthly and insufficient
evidence. Failed or ambiguous attempts consume the runner's allowance; no refund.
Request counting is additional to the unchanged application consent/cost gate.
The dedicated Worker bounds model/input/output and allows one AI invocation per
HTTP request. It does NOT maintain an account-wide request or dollar balance.

Planning estimate: about US$0.01 for the small fixtures; provisionally allow
US$0.05, excluding any base subscription and CI costs. This is NOT a guaranteed
maximum or an enforced monetary spending limit. The BGE rate is $0.020/million
input tokens; the report model is $0.293/million input and $2.253/million output.
For a conservative BGE/report estimate, budget 18,000 embedding input tokens,
52,000 report input tokens (including schema overhead), and 2,048 report output
tokens: approximately $0.0202. Real fixture inputs should be much smaller.
The exact emotion model's rate is missing from the published pricing table.
Using $0.282/million input and $0.827/million output as an explicit planning proxy
(10,000 input + 320 output tokens) adds approximately $0.0031; this is NOT its
verified rate. Confirm that exact model's billing/availability before approving
inference; do not silently substitute the fp8 model or claim a firm ceiling.

Sources checked 2026-10-13:
- [Cloudflare pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Active fast variants](https://developers.cloudflare.com/changelog/post/2026-05-08-planned-model-deprecations/)
- [GitHub manual dispatch prerequisite](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)
- [Firebase Auth Emulator](https://firebase.google.com/docs/emulator-suite/connect_auth)

No resources have been provisioned, secrets configured, workflows dispatched,
real models invoked, docs committed, or branch contents pushed by preparation.
