import { useState } from "react";
import { registerWithPassword } from "./firebaseSession";

function RegisterForm({ onSwitchToLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatar, setAvatar] = useState("🦋");
  const [aiConsent, setAiConsent] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleRegister(event) {
    event.preventDefault();
    if (password.length < 6) return setMessage("Password must be at least 6 characters.");
    if (password !== confirmPassword) return setMessage("Passwords do not match.");

    try {
      setIsLoading(true);
      await registerWithPassword(email.trim(), password, {
        name: name.trim(),
        avatar,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        aiConsent
      });
      setMessage("Account created. Check your email to verify it, then sign in with your password.");
    } catch (error) {
      setMessage(error.message || "Unable to create account.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form id="registerForm" className="auth-form" onSubmit={handleRegister}>
      <h3>Create a password account</h3>
      <p className="auth-form-description">Prefer no password? Use “Send me a login link” on the Log In tab.</p>
      <label htmlFor="registerName">Display Name</label>
      <input id="registerName" value={name} onChange={(e) => setName(e.target.value)} required />
      <label htmlFor="registerEmail">Email</label>
      <input id="registerEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <label htmlFor="registerPassword">Password</label>
      <input id="registerPassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <label htmlFor="registerConfirmPassword">Confirm Password</label>
      <input id="registerConfirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
      <label htmlFor="registerAvatar">Choose Avatar</label>
      <select id="registerAvatar" value={avatar} onChange={(e) => setAvatar(e.target.value)}>
        <option value="🦋">🦋 Butterfly</option>
        <option value="🐝">🐝 Bee</option>
        <option value="🐦">🐦 Bird</option>
      </select>
      <label className="consent-option" htmlFor="registerAiConsent">
        <input id="registerAiConsent" type="checkbox" checked={aiConsent} onChange={(e) => setAiConsent(e.target.checked)} />
        Allow PetalPal to analyze optional journal text for mood detection.
      </label>
      <button type="submit" disabled={isLoading}>{isLoading ? "Creating..." : "Create account"}</button>
      <button type="button" className="verification-resend-link" onClick={onSwitchToLogin}>Use passwordless login instead</button>
      <p className="auth-message" aria-live="polite">{message}</p>
    </form>
  );
}

export default RegisterForm;
