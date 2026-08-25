import { useState } from "react";
import DailyCheckIn from "../Garden/DailyCheckIn";

function OnboardingFlow({
  fairyState,
  onAdvance,
  onBloom,
  disabled = false
}) {
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [error, setError] = useState("");
  const step = fairyState?.onboardingStep || "EMPTY_GARDEN";
  const readyForMood = [
    "MOOD_SELECTION",
    "PLANT_FIRST_FLOWER",
    "FLOWER_BLOOM"
  ].includes(step);

  async function beginJourney() {
    try {
      setIsAdvancing(true);
      setError("");
      await onAdvance({
        onboardingStep: "MOOD_SELECTION",
        lastEvent: "FAIRY_APPEARS"
      });
    } catch (advanceError) {
      setError(advanceError.message || "Could not save onboarding progress.");
    } finally {
      setIsAdvancing(false);
    }
  }

  return (
    <section className="onboarding-flow" aria-labelledby="onboardingTitle">
      <div className="onboarding-fairy" aria-hidden="true">🧚‍♀️</div>
      <p className="auth-eyebrow">YOUR FIRST BLOOM</p>
      <h2 id="onboardingTitle">
        {readyForMood ? "How are you feeling today?" : "Meet your garden fairy"}
      </h2>

      {!readyForMood ? (
        <>
          <p>
            I will help turn one feeling each day into a flower and keep it
            safely in your garden.
          </p>
          <button
            type="button"
            disabled={disabled || isAdvancing}
            onClick={beginJourney}
          >
            {isAdvancing ? "Saving..." : "Plant My First Flower"}
          </button>
        </>
      ) : (
        <>
          <p>
            Choose a mood in a few seconds. Your journal is optional, and is
            only analyzed when you have enabled AI consent.
          </p>
          <DailyCheckIn onBloom={onBloom} disabled={disabled} />
        </>
      )}

      {error && <p className="auth-message">{error}</p>}
    </section>
  );
}

export default OnboardingFlow;
