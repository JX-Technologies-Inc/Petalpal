import { useState } from "react";
import {
  completePendingRegistration,
  loginWithFirebase,
  resendVerificationEmail
} from "./firebaseSession";

function LoginForm({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);

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

  async function handleVerifiedLogin() {
    try {
      setIsLoading(true);
      const user = await completePendingRegistration();
      setMessage("Email verified. Login successful!");
      if (typeof onLogin === "function") onLogin(user);
    } catch (error) {
      setMessage(error.message || "Email has not been verified yet.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    try {
      setIsLoading(true);
      await resendVerificationEmail();
      setMessage("A new verification email has been sent.");
    } catch (error) {
      setMessage(error.message || "Unable to resend verification email.");
    } finally {
      setIsLoading(false);
    }
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

      {verificationPending && (
        <div className="verification-actions">
          <button type="button" disabled={isLoading} onClick={handleVerifiedLogin}>
            I Have Verified My Email
          </button>
          <button type="button" disabled={isLoading} onClick={handleResend}>
            Resend Verification Email
          </button>
        </div>
      )}

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
