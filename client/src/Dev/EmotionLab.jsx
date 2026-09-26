import { useRef, useState } from "react";
import { apiRequest } from "../api";

const moods = ["SUNNY_BLOOM", "GENTLE_BLOOM", "QUIET_BLOOM", "HEALING_BLOOM", "FIRE_BLOOM", "WONDER_BLOOM", "DRIFTING_BLOOM", "PEACEFUL_BLOOM"];
const testEmail = import.meta.env.VITE_AUTH_E2E_TEST_EMAIL?.trim().toLowerCase();

export default function EmotionLab({ currentUser }) {
  const [text, setText] = useState("");
  const [primaryGardenMood, setPrimaryGardenMood] = useState("SUNNY_BLOOM");
  const [diagnostic, setDiagnostic] = useState(null);
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const idempotencyKey = useRef(crypto.randomUUID());

  async function run(path, save) {
    setBusy(true);
    setError("");
    try {
      const response = await apiRequest(path, {
        method: "POST",
        headers: {
          "X-PetalPal-Emotion-Lab": "1",
          ...(save ? { "Idempotency-Key": idempotencyKey.current } : {})
        },
        body: JSON.stringify(save ? { content: text, primaryGardenMood } : { text, primaryGardenMood })
      });
      if (save) {
        setSaved(response);
        idempotencyKey.current = crypto.randomUUID();
      } else setDiagnostic(response);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  if (!currentUser?.id) return <main><h1>Emotion Lab</h1><p>Sign in to preview or save an Event.</p><a href="/">Go to sign in</a></main>;
  if (!testEmail || currentUser.email?.trim().toLowerCase() !== testEmail) {
    return <main><h1>Emotion Lab</h1><p>Only the dedicated E2E test account can use Emotion Lab.</p></main>;
  }
  return <main style={{ maxWidth: 720, margin: "2rem auto", padding: "1rem" }}>
    <h1>Emotion Lab</h1>
    <p>Developer test page for your own Events.</p>
    <label htmlFor="event-text">Event text</label>
    <textarea id="event-text" rows="7" maxLength="4000" value={text} onChange={(event) => { setText(event.target.value); setSaved(null); idempotencyKey.current = crypto.randomUUID(); }} style={{ display: "block", width: "100%" }} />
    <label htmlFor="primary-mood">Primary Garden Mood</label>
    <select id="primary-mood" value={primaryGardenMood} onChange={(event) => setPrimaryGardenMood(event.target.value)}>
      {moods.map((mood) => <option key={mood} value={mood}>{mood}</option>)}
    </select>
    <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
      <button disabled={busy || !text.trim()} onClick={() => run("/dev/emotion-preview", false)}>Preview Emotion</button>
      <button disabled={busy || !text.trim()} onClick={() => run("/events", true)}>Save Event</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {diagnostic && <section aria-label="Preview diagnostics">
      <h2>Preview</h2>
      <p>Classifier: {diagnostic.classifierEnabled ? "enabled" : "disabled"}</p>
      <p>Inference: {diagnostic.inferenceStatus}</p>
      <p>Labels: {diagnostic.labels.join(", ") || "none"}</p>
      <p>Latency: {diagnostic.latencyMs} ms</p>
      <p>Fallback: {diagnostic.fallbackReason || "none"}</p>
      <pre>{JSON.stringify({ probabilities: diagnostic.probabilities, flower: diagnostic.flower }, null, 2)}</pre>
    </section>}
    {saved && <section aria-label="Saved Event">
      <h2>Saved Event</h2>
      <p>Event ID: {saved.event.id}</p>
      <p>Inference: {saved.emotion.status}</p>
      <p>Labels: {saved.emotion.labels.join(", ") || "none"}</p>
      <pre>{JSON.stringify({ flower: saved.flower }, null, 2)}</pre>
    </section>}
  </main>;
}
