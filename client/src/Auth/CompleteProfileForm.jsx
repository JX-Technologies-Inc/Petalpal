import { useState } from "react";
import { completePasswordlessProfile } from "./firebaseSession";

function CompleteProfileForm({ email, authMethod = "passwordless", onComplete, onCancel }) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🦋");
  const [aiConsent, setAiConsent] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setIsLoading(true);
      const data = await completePasswordlessProfile({
        name: name.trim(),
        avatar,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        aiConsent
      });
      if (typeof onComplete === "function") onComplete(data.user);
    } catch (error) {
      setMessage(error.message || "Unable to complete your profile.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h3>Complete Profile</h3>
      <p className="auth-form-description">
        You’re signed in as {email}. {authMethod === "password" ? "Your email is verified. Complete your profile to continue." : "No password is needed for this account."}
      </p>
      <label htmlFor="completeProfileName">Display Name</label>
      <input id="completeProfileName" value={name} onChange={(event) => setName(event.target.value)} required />
      <label htmlFor="completeProfileAvatar">Choose Avatar</label>
      <select id="completeProfileAvatar" value={avatar} onChange={(event) => setAvatar(event.target.value)}>
        <option value="🦋">🦋 Butterfly</option>
        <option value="🐝">🐝 Bee</option>
        <option value="🐦">🐦 Bird</option>
      </select>
      <label className="consent-option" htmlFor="completeProfileAiConsent">
        <input id="completeProfileAiConsent" type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} />
        Allow PetalPal to analyze optional journal text for mood detection.
      </label>
      <button type="submit" disabled={isLoading}>{isLoading ? "Saving..." : "Continue to Onboarding"}</button>
      <button type="button" className="verification-resend-link" onClick={onCancel}>Sign out</button>
      <p className="auth-message" aria-live="polite">{message}</p>
    </form>
  );
}

export default CompleteProfileForm;
