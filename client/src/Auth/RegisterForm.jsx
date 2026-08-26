import { useCallback, useEffect, useState } from "react";
import {
  completeVerifiedRegistration,
  pendingPasswordRegistration,
  registerWithPassword
} from "./firebaseSession";

function RegisterForm({ onLogin }) {
  const initialRegistration = pendingPasswordRegistration();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(initialRegistration?.email || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatar, setAvatar] = useState("🦋");
  const [aiConsent, setAiConsent] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState(Boolean(initialRegistration));

  const finishRegistration = useCallback(async ({ quiet = false } = {}) => {
    try {
      if (!quiet) setIsLoading(true);
      const data = await completeVerifiedRegistration();
      if (typeof onLogin === "function") onLogin(data.user);
      return true;
    } catch (error) {
      if (!quiet || !/not verified yet|session is unavailable/i.test(error.message || "")) {
        setMessage(error.message || "Unable to confirm email verification.");
      }
      return false;
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, [onLogin]);

  useEffect(() => {
    if (!awaitingVerification) return undefined;
    const checkVerification = () => void finishRegistration({ quiet: true });
    window.addEventListener("focus", checkVerification);
    const timer = window.setInterval(checkVerification, 4000);
    return () => {
      window.removeEventListener("focus", checkVerification);
      window.clearInterval(timer);
    };
  }, [awaitingVerification, finishRegistration]);

  async function handleRegister(event) {
    event.preventDefault();
    if (password.length < 6) return setMessage("Password must be at least 6 characters.");
    if (password !== confirmPassword) return setMessage("Passwords do not match.");

    try {
      setIsLoading(true);
      const registeredUser = await registerWithPassword(email.trim(), password, {
        name: name.trim(),
        avatar,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        aiConsent
      });
      setEmail(registeredUser?.email || email.trim());
      setAwaitingVerification(true);
      setMessage("Account created. Check your email and click the verification link. Return here after verification to continue to Onboarding.");
    } catch (error) {
      setMessage(error.message || "Unable to create account.");
    } finally {
      setIsLoading(false);
    }
  }

  if (awaitingVerification) {
    return (
      <section className="auth-form" aria-live="polite">
        <h3>Verify Your Email</h3>
        <p>We sent a verification link to {email}. Click it once, then return to PetalPal.</p>
        <button type="button" disabled={isLoading} onClick={() => void finishRegistration()}>
          {isLoading ? "Checking..." : "I’ve Verified My Email"}
        </button>
        <p className="auth-message">{message}</p>
      </section>
    );
  }

  return (
    <form id="registerForm" className="auth-form" onSubmit={handleRegister}>
      <h3>Create Account</h3>
      <p className="auth-form-description">Create your PetalPal account and verify your email once. Your PetalPal password is used for future password login.</p>
      <label htmlFor="registerName">Display Name</label>
      <input id="registerName" value={name} onChange={(e) => setName(e.target.value)} required />
      <label htmlFor="registerEmail">Email</label>
      <input id="registerEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <label htmlFor="registerPassword">PetalPal Password</label>
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
      <p className="auth-message" aria-live="polite">{message}</p>
    </form>
  );
}

export default RegisterForm;
