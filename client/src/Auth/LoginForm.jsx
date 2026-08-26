import { useEffect, useRef, useState } from "react";
import {
  finishPasswordlessLogin,
  isPasswordlessCallback,
  loginWithGoogle,
  loginWithPassword,
  savedPasswordlessEmail,
  sendPasswordlessLoginLink
} from "./firebaseSession";

function LoginForm({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [callbackEmail, setCallbackEmail] = useState("");
  const [needsCallbackEmail, setNeedsCallbackEmail] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const callbackStarted = useRef(false);

  function notifyLogin(data) {
    if (typeof onLogin !== "function") return;
    if (data.needsProfile) onLogin(null, data);
    else onLogin(data.user);
  }

  async function completeLink(email) {
    try {
      setIsLoading(true);
      const data = await finishPasswordlessLogin(email);
      notifyLogin(data);
    } catch (error) {
      callbackStarted.current = false;
      setMessage(error.message || "Unable to complete email-link sign-in.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!isPasswordlessCallback() || callbackStarted.current) return;
    const savedEmail = savedPasswordlessEmail();
    if (!savedEmail) {
      setNeedsCallbackEmail(true);
      return;
    }
    callbackStarted.current = true;
    void completeLink(savedEmail);
  }, []);

  async function handleSendLink(event) {
    event.preventDefault();
    try {
      setIsLoading(true);
      await sendPasswordlessLoginLink(email.trim());
      setMessage(`Login link sent to ${email.trim()}. No password is required.`);
    } catch (error) {
      setMessage(error.message || "Unable to send login link.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePasswordLogin(event) {
    event.preventDefault();
    try {
      setIsLoading(true);
      const data = await loginWithPassword(email.trim(), password);
      notifyLogin(data);
    } catch (error) {
      setMessage(error.message || "Unable to sign in with password.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleLogin() {
    try {
      setIsLoading(true);
      const data = await loginWithGoogle();
      notifyLogin(data);
    } catch (error) {
      setMessage(error.message || "Unable to sign in with Google.");
    } finally {
      setIsLoading(false);
    }
  }

  if (needsCallbackEmail) {
    return (
      <form className="auth-form" onSubmit={(event) => {
        event.preventDefault();
        callbackStarted.current = true;
        void completeLink(callbackEmail.trim());
      }}>
        <h3>Confirm your email</h3>
        <p>You opened the login link in a different browser. Enter the same email address to finish.</p>
        <label htmlFor="callbackEmail">Email</label>
        <input id="callbackEmail" type="email" value={callbackEmail} onChange={(e) => setCallbackEmail(e.target.value)} required />
        <button type="submit" disabled={isLoading}>Finish Sign-In</button>
        <p className="auth-message">{message}</p>
      </form>
    );
  }

  return (
    <section className="auth-form auth-methods">
      <h3>Welcome Back</h3>
      <button type="button" className="google-auth-button" disabled={isLoading} onClick={handleGoogleLogin}>
        Continue with Google
      </button>
      <div className="auth-divider"><span>or</span></div>

      <form onSubmit={handlePasswordLogin}>
        <h4>Passwordless email link</h4>
        <label htmlFor="loginEmail">Email</label>
        <input id="loginEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <button type="button" disabled={isLoading || !email.trim()} onClick={handleSendLink}>Send me a login link</button>

        <div className="auth-divider"><span>or sign in with password</span></div>
        <label htmlFor="loginPassword">PetalPal Password</label>
        <input id="loginPassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <p className="auth-form-description">Use the PetalPal password you set when creating your account—not your email provider password.</p>
        <button type="submit" disabled={isLoading}>Sign in with password</button>
      </form>
      <p className="auth-message" aria-live="polite">{message}</p>
    </section>
  );
}

export default LoginForm;
