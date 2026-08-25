import { useEffect, useState } from "react";
import {
  completePendingRegistration,
  loginWithFirebase
} from "./firebaseSession";

function LoginForm({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);

  useEffect(() => {
    if (!verificationPending) return undefined;
    let active = true;
    let checking = false;

    async function checkVerification() {
      if (checking) return;
      checking = true;
      try {
        const user = await completePendingRegistration();
        if (active && typeof onLogin === "function") onLogin(user);
      } catch {
        // Wait until the verification link has been opened.
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
  }, [verificationPending, onLogin]);

  async function handleLogin(event) {
    event.preventDefault();

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setMessage("Please enter your email and password.");
      return;
    }

    try {
      setIsLoading(true);
      setMessage("");

      const result = await loginWithFirebase(trimmedEmail, password);

      if (result.pendingVerification) {
        setVerificationPending(true);
        setMessage("Email is not verified. We sent you a new verification email.");
        return;
      }

      const loggedInUser = result.user;

      setMessage("Login successful!");

      if (typeof onLogin === "function") {
        onLogin(loggedInUser);
      }
    } catch (error) {
      console.error("Login error:", error);

      setMessage(
        error.message ||
          "Something went wrong while logging in."
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (verificationPending) {
    return (
      <section className="auth-form verification-panel" aria-live="polite">
        <div className="verification-icon">✉️</div>
        <h3>Verify your email</h3>
        <p>
          We sent a verification link to <strong>{email.trim()}</strong>.
          Click it, then return here to continue automatically.
        </p>
        <p className="verification-waiting">Waiting for verification…</p>
      </section>
    );
  }

  return (
    <form
      id="loginForm"
      className="auth-form"
      onSubmit={handleLogin}
    >
      <h3>Welcome Back</h3>

      <p className="auth-form-description">
        Enter your account details to return to your garden.
      </p>

      <label htmlFor="loginEmail">
        Email
      </label>

      <input
        id="loginEmail"
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

      <label htmlFor="loginPassword">
        Password
      </label>

      <input
        id="loginPassword"
        type="password"
        value={password}
        placeholder="Enter your password"
        autoComplete="current-password"
        disabled={isLoading}
        onChange={(event) => {
          setPassword(event.target.value);
          setMessage("");
        }}
      />

      <button
        id="loginBtn"
        type="submit"
        disabled={isLoading}
      >
        {isLoading ? "Logging In..." : "Log In"}
      </button>

      <p
        id="loginMessage"
        className="auth-message"
        aria-live="polite"
      >
        {message}
      </p>
    </form>
  );
}

export default LoginForm;
