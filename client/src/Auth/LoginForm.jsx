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
  const [linkEmail, setLinkEmail] = useState("");
  const [passwordEmail, setPasswordEmail] = useState("");
  const [password, setPassword] = useState("");
  const [callbackEmail, setCallbackEmail] = useState("");
  const [needsCallbackEmail, setNeedsCallbackEmail] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const callbackStarted = useRef(false);

  async function completeLink(email) {
    try {
      setIsLoading(true);
      const data = await finishPasswordlessLogin(email);
      if (typeof onLogin === "function") onLogin(data.user);
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
      await sendPasswordlessLoginLink(linkEmail.trim());
      setMessage(`Login link sent to ${linkEmail.trim()}. No password is required.`);
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
      const data = await loginWithPassword(passwordEmail.trim(), password);
      if (typeof onLogin === "function") onLogin(data.user);
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
      if (typeof onLogin === "function") onLogin(data.user);
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

      <form onSubmit={handleSendLink}>
        <h4>Passwordless email link</h4>
        <label htmlFor="linkEmail">Email</label>
        <input id="linkEmail" type="email" value={linkEmail} onChange={(e) => setLinkEmail(e.target.value)} required />
        <button type="submit" disabled={isLoading}>Send me a login link</button>
      </form>

      <div className="auth-divider"><span>or sign in with password</span></div>
      <form onSubmit={handlePasswordLogin}>
        <label htmlFor="passwordEmail">Email</label>
        <input id="passwordEmail" type="email" value={passwordEmail} onChange={(e) => setPasswordEmail(e.target.value)} required />
        <label htmlFor="loginPassword">Password</label>
        <input id="loginPassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" disabled={isLoading}>Sign in with password</button>
      </form>
      <p className="auth-message" aria-live="polite">{message}</p>
    </section>
  );
}

export default LoginForm;
