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
