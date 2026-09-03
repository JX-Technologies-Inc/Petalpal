import { useState } from "react";

function DailyCheckIn({
  onBloom,
  disabled = false,
  completed = false
}) {
  const [eventText, setEventText] = useState("");
  const [selectedMood, setSelectedMood] =
    useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  async function handleSubmit() {
    const trimmedEvent = eventText.trim();

    if (!selectedMood) {
      setMessage("Choose a Primary Bloom.");
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage("");

      await onBloom({
        event: trimmedEvent,
        mood: selectedMood
      });

      setEventText("");
      setSelectedMood("");
      setMessage(
        "Your flower bloomed successfully 🌸"
      );
    } catch (error) {
      console.error("Bloom error:", error);

      setMessage(
        error.status === 409
          ? "Today’s flower is already growing."
          : error.message || "Failed to bloom a flower."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="checkin-section">
      <h2>Daily Check-In</h2>

      {completed ? (
        <p className="auth-message">
          Today&apos;s flower is already growing. Come back tomorrow 🌸
        </p>
      ) : (
        <>

      <textarea
        id="eventInput"
        placeholder="Optional: what happened today?"
        value={eventText}
        disabled={disabled || isSubmitting}
        onChange={(event) =>
          setEventText(event.target.value)
        }
      />

      <div className="mood-section">
        <p>How are you feeling today?</p>

        <select
          id="moodSelect"
          value={selectedMood}
          disabled={disabled || isSubmitting}
          onChange={(event) =>
            setSelectedMood(event.target.value)
          }
        >
          <option value="">Choose a Primary Bloom</option>
          <option value="SUNNY_BLOOM">Sunny Bloom</option>
          <option value="GENTLE_BLOOM">Gentle Bloom</option>
          <option value="QUIET_BLOOM">Quiet Bloom</option>
          <option value="HEALING_BLOOM">Healing Bloom</option>
          <option value="FIRE_BLOOM">Fire Bloom</option>
          <option value="WONDER_BLOOM">Wonder Bloom</option>
          <option value="DRIFTING_BLOOM">Drifting Bloom</option>
          <option value="PEACEFUL_BLOOM">Peaceful Bloom</option>
        </select>
      </div>

      <button
        id="submitBtn"
        type="button"
        disabled={disabled || isSubmitting}
        onClick={handleSubmit}
      >
        {isSubmitting
          ? "Blooming..."
          : "Bloom"}
      </button>

      {message && (
        <p className="auth-message">
          {message}
        </p>
      )}
        </>
      )}
    </section>
  );
}

export default DailyCheckIn;
