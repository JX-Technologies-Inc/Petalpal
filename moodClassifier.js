import natural from "natural";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let classifierPromise = null;

function loadMoodModel() {
  if (classifierPromise) {
    return classifierPromise;
  }

  classifierPromise = new Promise((resolve, reject) => {
    natural.BayesClassifier.load(
      path.join(__dirname, "data", "mood-model.json"),
      null,
      (err, classifier) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(classifier);
      }
    );
  });

  return classifierPromise;
}

async function predictMood(text) {
  if (!text || !text.trim()) {
    return "calm";
  }

  const classifier = await loadMoodModel();
  return classifier.classify(text.trim());
}

async function classifyMoodWithScores(text) {
  if (!text || !text.trim()) {
    throw new Error("Mood classification requires non-empty text");
  }

  const classifier = await loadMoodModel();
  const classifications = classifier.getClassifications(text.trim());
  const valid = classifications.filter(
    ({ label, value }) =>
      ["happy", "calm", "tired", "sad", "stressed"].includes(label) &&
      Number.isFinite(value) &&
      value >= 0
  );
  const total = valid.reduce((sum, item) => sum + item.value, 0);
  if (!valid.length || !Number.isFinite(total) || total <= 0) {
    throw new Error("Natural classifier returned invalid routing scores");
  }

  const scores = valid
    .map(({ label, value }) => ({ label, score: value / total }))
    .sort((a, b) => b.score - a.score);
  return {
    label: scores[0].label,
    confidence: scores[0].score,
    margin: scores[0].score - (scores[1]?.score || 0),
    scores
  };
}

export { predictMood, classifyMoodWithScores, loadMoodModel };
