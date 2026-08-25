import { useEffect, useState } from "react";
import {
  beginFirebaseRegistration,
  completePendingRegistration,
  resendVerificationEmail
} from "./firebaseSession";

function RegisterForm({ onRegister }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatar, setAvatar] = useState("🦋");
  const [aiConsent, setAiConsent] = useState(false);

  const [message, setMessage] = useState("");
  const [accountId, setAccountId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = window.setTimeout(
      () => setResendCooldown((seconds) => seconds - 1),
      1000
    );
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (!verificationPending) return undefined;
    let active = true;
    let checking = false;

    async function checkVerification() {
      if (checking) return;
      checking = true;
      try {
        const user = await completePendingRegistration();
        if (!active) return;
        setAccountId(user.accountId || "");
        setMessage("Email verified. Opening your garden...");
        if (typeof onRegister === "function") onRegister(user);
      } catch {
        // Being unverified is expected while the user checks their inbox.
      } finally {
        checking = false;
      }
    }

    const handleFocus = () => void checkVerification();
    const timer = window.setInterval(checkVerification, 4000);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);
    void checkVerification();

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [verificationPending, onRegister]);

  function readableFirebaseError(error, fallback) {
    if (error?.code === "auth/too-many-requests") {
      return "Too many attempts. Please wait a few minutes before trying again.";
    }
    if (error?.code === "auth/email-already-in-use") {
      return "This email already has an account. Use the Log In tab to continue.";
    }
    if (error?.code === "auth/invalid-email") {
      return "Enter a valid email address.";
    }
    return error?.message || fallback;
  }

  async function handleRegister(event) {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (
      !trimmedName ||
      !trimmedEmail ||
      !password ||
      !confirmPassword
    ) {
      setMessage("Please complete all fields.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    try {
      setIsLoading(true);
      setMessage("");
      setAccountId("");

      await beginFirebaseRegistration(trimmedEmail, password, {
        name: trimmedName,
        avatar,
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        aiConsent
      });
      setVerificationPending(true);
      setResendCooldown(60);
      setMessage("Verification email sent. Open it before continuing.");
    } catch (error) {
      console.error("Register error:", error);

      setMessage(readableFirebaseError(
        error,
        "Something went wrong while registering."
      ));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    try {
      setIsLoading(true);
      await resendVerificationEmail();
      setResendCooldown(60);
      setMessage("A new verification email has been sent.");
    } catch (error) {
      setMessage(readableFirebaseError(
        error,
        "Unable to resend verification email."
      ));
    } finally {
      setIsLoading(false);
    }
  }

  if (verificationPending) {
    return (
      <section className="auth-form verification-panel" aria-live="polite">
        <div className="verification-icon">✉️</div>
        <h3>Check your email</h3>
        <p>
          We sent a verification link to <strong>{email.trim()}</strong>.
        </p>
        <ol>
          <li>Open your email inbox or spam folder.</li>
          <li>Click the link from Firebase / PetalPal.</li>
          <li>Return here. PetalPal will sign you in automatically.</li>
        </ol>
        <p className="verification-waiting">Checking verification status…</p>
        <button
          type="button"
          className="verification-resend-link"
          disabled={isLoading || resendCooldown > 0}
          onClick={handleResend}
        >
          {resendCooldown > 0
            ? `Resend available in ${resendCooldown}s`
            : "Resend Verification Email"}
        </button>
        <p className="auth-message">{message}</p>
      </section>
    );
  }

  return (
    <form
      id="registerForm"
      className="auth-form"
      onSubmit={handleRegister}
    >
      <h3>Create Your Garden</h3>

      <p className="auth-form-description">
        Create an account and begin recording your daily blooms.
      </p>

      <label htmlFor="registerName">
        Display Name
      </label>

      <input
        id="registerName"
        type="text"
        value={name}
        placeholder="Enter your name"
        autoComplete="name"
        disabled={isLoading}
        onChange={(event) => {
          setName(event.target.value);
          setMessage("");
        }}
      />

      <label htmlFor="registerEmail">
        Email
      </label>

      <input
        id="registerEmail"
        type="email"
        value={email}
        placeholder="Enter your email"
        autoComplete="email"
        disabled={isLoading}
        onChange={(event) => {
          setEmail(event.target.value);
          setMessage("");
        }}
      />

      <label htmlFor="registerPassword">
        Password
      </label>

      <input
        id="registerPassword"
        type="password"
        value={password}
        placeholder="At least 6 characters"
        autoComplete="new-password"
        disabled={isLoading}
        onChange={(event) => {
          setPassword(event.target.value);
          setMessage("");
        }}
      />

      <label htmlFor="registerConfirmPassword">
        Confirm Password
      </label>

      <input
        id="registerConfirmPassword"
        type="password"
        value={confirmPassword}
        placeholder="Enter your password again"
        autoComplete="new-password"
        disabled={isLoading}
        onChange={(event) => {
          setConfirmPassword(event.target.value);
          setMessage("");
        }}
      />

      <label htmlFor="registerAvatar">
        Choose Avatar
      </label>

      <select
        id="registerAvatar"
        value={avatar}
        disabled={isLoading}
        onChange={(event) => {
          setAvatar(event.target.value);
          setMessage("");
        }}
      >
        <option value="🦋">🦋 Butterfly</option>
        <option value="🐝">🐝 Bee</option>
        <option value="🐦">🐦 Bird</option>
      </select>

      <label className="consent-option" htmlFor="registerAiConsent">
        <input
          id="registerAiConsent"
          type="checkbox"
          checked={aiConsent}
          disabled={isLoading}
          onChange={(event) => setAiConsent(event.target.checked)}
        />
        Allow PetalPal to analyze optional journal text for mood detection.
        You can change this later.
      </label>

      <button
        id="registerBtn"
        type="submit"
        disabled={isLoading}
      >
        {isLoading
          ? "Creating Account..."
          : "Create My Garden"}
      </button>

      <p
        id="registerMessage"
        className="auth-message"
        aria-live="polite"
      >
        {message}
      </p>

      {accountId && (
        <div
          id="accountResult"
          className="account-result"
        >
          <p>Your PetalPal account ID is:</p>
          <strong id="generatedAccountId">
            {accountId}
          </strong>
        </div>
      )}
    </form>
  );
}

export default RegisterForm;
