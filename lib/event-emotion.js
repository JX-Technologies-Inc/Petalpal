import path from "node:path";
import { fileURLToPath } from "node:url";
import { SECONDARY_EMOTION_LABELS, EXCLUDED_SECONDARY_EMOTIONS } from "./flower-variant-config.js";
import { selectFlowerSecondaryEmotions } from "./secondary-emotion-selector.js";

const productLabels = SECONDARY_EMOTION_LABELS.filter((label) => !EXCLUDED_SECONDARY_EMOTIONS.includes(label));
const checkpoint = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../experiments/emotion-classifier-v2/v4/aligned-supervision-v1/goemotions-targeted-v1/experiment/epoch-1-checkpoint");
const onnxModel = path.resolve(checkpoint, "../../onnx-cpu/artifacts/model-fp32.onnx");
let runtimePromise;

export function emotionClassifierEnabled(env = process.env) {
  return env.EMOTION_CLASSIFIER_ENABLED === "true" && ["development", "test"].includes(env.NODE_ENV);
}

export const EVENT_EMOTION_MODEL_ID = "goemotions-targeted-v1/experiment/epoch-1-checkpoint";
export const EVENT_EMOTION_MODEL_VERSION = "epoch-1-onnx-fp32";

async function runtime() {
  runtimePromise ||= (async () => {
    const [{ AutoTokenizer, env }, ort] = await Promise.all([
      import("@huggingface/transformers"), import("onnxruntime-node")
    ]);
    env.allowRemoteModels = false;
    const [tokenizer, session] = await Promise.all([
      AutoTokenizer.from_pretrained(checkpoint, { local_files_only: true }),
      ort.InferenceSession.create(onnxModel)
    ]);
    const config = (await import("node:fs/promises")).readFile;
    const modelConfig = JSON.parse(await config(path.join(checkpoint, "config.json"), "utf8"));
    const headPositions = productLabels.map((label) => Number(Object.entries(modelConfig.id2label).find(([, name]) => name === label)?.[0]));
    if (headPositions.some((position) => !Number.isInteger(position))) throw new Error("INVALID_MODEL_MAPPING");
    return { tokenizer, session, ort, headPositions };
  })().catch((error) => { runtimePromise = null; throw error; });
  return runtimePromise;
}

async function probabilitiesFor(text) {
  const { tokenizer, session, ort, headPositions } = await runtime();
  const encoded = await tokenizer(text, { truncation: true, max_length: 512 });
  const feeds = Object.fromEntries(session.inputNames.map((name) => {
    const value = encoded[name];
    if (!value) throw new Error("INVALID_TOKENIZER_OUTPUT");
    return [name, new ort.Tensor("int64", BigInt64Array.from(value.data, BigInt), value.dims)];
  }));
  const output = await session.run(feeds);
  const logits = output.logits?.data;
  if (!logits || logits.length !== 28 || [...logits].some((value) => !Number.isFinite(value))) {
    throw new Error("INVALID_MODEL_OUTPUT");
  }
  return Object.fromEntries(productLabels.map((label, index) => [label, 1 / (1 + Math.exp(-logits[headPositions[index]]))]));
}

export async function classifyEventEmotion({ userId, eventId, text, primaryGardenMood, env = process.env, infer = probabilitiesFor }) {
  if (!userId || typeof text !== "string" || !text.trim()) throw new Error("INVALID_EVENT_INPUT");
  const startedAt = Date.now();
  if (!emotionClassifierEnabled(env)) return { status: "SKIPPED", labels: [], latencyMs: 0, fallbackReason: env.EMOTION_CLASSIFIER_ENABLED === "true" ? "RESEARCH_ONLY_CONTEXT" : "FEATURE_DISABLED" };
  const timeout = Number(env.AI_REQUEST_TIMEOUT_MS) > 0 ? Number(env.AI_REQUEST_TIMEOUT_MS) : 3000;
  let timer;
  try {
    const probabilities = await Promise.race([
      infer(text),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("TIMEOUT")), timeout); })
    ]);
    if (!probabilities || typeof probabilities !== "object" || Array.isArray(probabilities) ||
        Object.keys(probabilities).some((label) => !productLabels.includes(label)) ||
        productLabels.some((label) => !Number.isFinite(probabilities[label]) || probabilities[label] < 0 || probabilities[label] > 1)) {
      throw new Error("INVALID_MODEL_OUTPUT");
    }
    const candidates = productLabels.filter((label) => probabilities[label] >= 0.35)
      .map((label) => ({ label, score: probabilities[label] }));
    const labels = selectFlowerSecondaryEmotions({ primaryGardenMood, candidates }).map(({ label }) => label);
    console.info("Event emotion inference", { eventId, status: "SUCCESS", latencyMs: Date.now() - startedAt, labels, outputCardinality: labels.length });
    return { status: "SUCCESS", labels, probabilities, latencyMs: Date.now() - startedAt };
  } catch (error) {
    const fallbackReason = error?.message === "TIMEOUT" ? "TIMEOUT" : error?.message === "INVALID_MODEL_OUTPUT" ? "INVALID_MODEL_OUTPUT" : "RUNTIME_UNAVAILABLE";
    console.info("Event emotion inference", { eventId, status: "FAILED", latencyMs: Date.now() - startedAt, fallbackReason, outputCardinality: 0 });
    return { status: "FAILED", labels: [], latencyMs: Date.now() - startedAt, fallbackReason };
  } finally {
    clearTimeout(timer);
  }
}

export const EVENT_SECONDARY_MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fast";
export const EVENT_SECONDARY_MODEL_VERSION = "event-secondary-v1";

export function eventSecondaryEmotionEnabled(env = process.env) {
  return Boolean(env.CLOUDFLARE_WORKER_AI_URL && env.CLOUDFLARE_WORKER_AI_TOKEN);
}

function safeDiagnosticLabel(label) {
  return typeof label === "string" && /^[a-z_-]{1,64}$/i.test(label.trim())
    ? label.trim() : "[invalid label]";
}

export async function classifyEventSecondaryEmotions({ text, primaryGardenMood, env = process.env, fetchImpl = fetch, includeDiagnostics = false }) {
  const startedAt = Date.now();
  const diagnostics = includeDiagnostics ? {
    attempted: false, status: "SKIPPED", fallbackReason: "FEATURE_DISABLED",
    workerLabels: [], productLabels: [], validatedLabels: [], removedLabels: []
  } : null;
  if (!primaryGardenMood || typeof text !== "string" || !text.trim() || !eventSecondaryEmotionEnabled(env)) {
    const result = { status: "SKIPPED", labels: [], latencyMs: 0, fallbackReason: "FEATURE_DISABLED" };
    return diagnostics ? { ...result, diagnostics } : result;
  }
  if (diagnostics) diagnostics.attempted = true;
  const timeout = Number(env.AI_REQUEST_TIMEOUT_MS) > 0 ? Number(env.AI_REQUEST_TIMEOUT_MS) : 3000;
  const controller = new AbortController();
  let timer;
  let failureReason = "NETWORK_ERROR";
  try {
    const output = await Promise.race([
      (async () => {
        const response = await fetchImpl(`${String(env.CLOUDFLARE_WORKER_AI_URL).replace(/\/$/, "")}/v1/event-emotion`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.CLOUDFLARE_WORKER_AI_TOKEN}` },
          body: JSON.stringify({ p: primaryGardenMood, e: text }),
          signal: controller.signal
        });
        failureReason = "HTTP_ERROR";
        if (!response.ok) throw new Error("PROVIDER_ERROR");
        failureReason = "MALFORMED_JSON";
        return response.json();
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("TIMEOUT")); }, timeout); })
    ]);
    failureReason = "INVALID_MODEL_OUTPUT";
    if (diagnostics && Array.isArray(output?.e)) diagnostics.workerLabels = output.e.map(safeDiagnosticLabel);
    if (!output || typeof output !== "object" || Array.isArray(output) ||
        Object.keys(output).some((key) => key !== "e") || !Array.isArray(output.e)) {
      throw new Error("INVALID_MODEL_OUTPUT");
    }
    const selectorDiagnostics = diagnostics ? {} : undefined;
    const labels = selectFlowerSecondaryEmotions({ primaryGardenMood,
      candidates: output.e.filter((label) => typeof label === "string"),
      selectionPolicy: "llm", diagnostics: selectorDiagnostics }).map(({ label }) => label);
    const result = { status: "SUCCESS", labels, latencyMs: Date.now() - startedAt };
    if (!diagnostics) return result;
    Object.assign(diagnostics, {
      status: "SUCCESS", fallbackReason: null,
      productLabels: selectorDiagnostics.productLabels,
      validatedLabels: selectorDiagnostics.validatedLabels,
      removedLabels: [
        ...output.e.filter((label) => typeof label !== "string").map(() => ({ label: "[invalid label]", reason: "INVALID_TAXONOMY" })),
        ...selectorDiagnostics.removedLabels.map(({ label, reason }) => ({ label: safeDiagnosticLabel(label), reason }))
      ]
    });
    return { ...result, diagnostics };
  } catch (error) {
    const result = { status: "FAILED", labels: [], latencyMs: Date.now() - startedAt,
      fallbackReason: error?.message === "TIMEOUT" || error?.name === "AbortError" ? "TIMEOUT" : "PROVIDER_ERROR" };
    if (!diagnostics) return result;
    const timedOut = result.fallbackReason === "TIMEOUT";
    diagnostics.status = !timedOut && ["MALFORMED_JSON", "INVALID_MODEL_OUTPUT"].includes(failureReason)
      ? "INVALID_RESPONSE" : "PROVIDER_ERROR";
    diagnostics.fallbackReason = timedOut ? "TIMEOUT" : failureReason;
    return { ...result, diagnostics };
  } finally {
    clearTimeout(timer);
  }
}
