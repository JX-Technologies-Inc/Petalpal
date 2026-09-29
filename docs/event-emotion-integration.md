# Event secondary-emotion integration

Production verified at commit `15a4ea0`.

## Production Event flow

`POST /events` accepts a **user-selected Primary Mood** (`primaryGardenMood`). It is authoritative: inference cannot replace it. When the user has enabled `aiProcessing` consent and a Primary Mood is present, the backend sends the Event text and Primary Mood to the Cloudflare Worker. The Worker uses Workers AI model `@cf/meta/llama-3.1-8b-instruct-fast`; the backend retains 0–2 Product-18 secondary emotions from its response. These labels are inferred, unconfirmed Event metadata.

The LLM selection policy in `lib/secondary-emotion-selector.js` keeps only Product-18 labels, removes exact duplicates and labels explicitly redundant with the selected Primary Mood, preserves Worker order, and caps the result at two. It does **not** apply `CLUSTER_CONFLICT`. The older scored/custom-ML path retains the cluster policy.

Primary Mood determines the base flower species and identity. Secondary emotion #1 supplies the main flower modifier (such as color accent or halo) and the default visual effect when there is no second label. Secondary emotion #2, when present, supplies or overrides the visual effect. Secondary labels never change the base species. A skipped call, missing consent, unavailable provider, or invalid response leaves `secondaryEmotions: []`; Event creation and the Primary-based flower still proceed. A successful empty result is an abstention. Use Event status/outcome to distinguish abstention, skip, and failure rather than relying on array length.

The Cloudflare Worker is the production Event classifier. The old custom ML/ONNX pipeline remains available for benchmark and research work, but is not used for production Event inference.

## Development Emotion Lab

`/dev/emotion-lab` calls the development-only `POST /dev/emotion-preview` endpoint, which uses the same consent gate, Worker classifier, LLM selection policy, and flower preview as production Events. Access is restricted to the dedicated `AUTH_E2E_TEST_EMAIL` account. Development resolves its database from `DEV_DATABASE_URL` and fails closed rather than falling back to production `DATABASE_URL`.

The Lab shows Worker labels, Product-18 labels, validated labels, removed labels with reasons, provider/attempt status, fallback reason, and the flower preview. Its diagnostic endpoint is unavailable in production. Consent-disabled previews report a skipped call with no secondary labels.
