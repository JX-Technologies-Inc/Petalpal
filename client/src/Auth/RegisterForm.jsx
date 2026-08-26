import { useCallback, useEffect, useState } from "react";
import {
  completeVerifiedRegistration,
  pendingPasswordRegistration,
  recoverPendingRegistrationEmail,
  resendRegistrationVerificationEmail,
  registerWithPassword
} from "./firebaseSession";

function RegisterForm({ onVerified }) {
  const initialRegistration = pendingPasswordRegistration();
  const [email, setEmail] = useState(initialRegistration?.email || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState(Boolean(initialRegistration));

  const finishRegistration = useCallback(async ({ quiet = false } = {}) => {
    try {
      if (!quiet) setIsLoading(true);
      const data = await completeVerifiedRegistration();
      if (typeof onVerified === "function") onVerified(data.user, data);
      return true;
    } catch (error) {
      if (!quiet || !/not verified yet|session is unavailable/i.test(error.message || "")) {
        setMessage(error.message || "Unable to confirm email verification.");
      }
      return false;
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, [onVerified]);

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

  useEffect(() => {
    if (!awaitingVerification || email) return;
    void recoverPendingRegistrationEmail().then((recoveredEmail) => {
      if (recoveredEmail) setEmail(recoveredEmail);
    });
  }, [awaitingVerification, email]);

  async function handleRegister(event) {
    event.preventDefault();
    if (password.length < 6) return setMessage("Password must be at least 6 characters.");
    if (password !== confirmPassword) return setMessage("Passwords do not match.");

    try {
      setIsLoading(true);
      const registeredUser = await registerWithPassword(email.trim(), password);
      setEmail(registeredUser?.email || email.trim());
      setAwaitingVerification(true);
      setMessage("Account created. Open the verification link on any device, then return to this page to continue to Onboarding.");
    } catch (error) {
      setMessage(error.message || "Unable to create account.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    try {
      setIsLoading(true);
      await resendRegistrationVerificationEmail();
      setMessage("A new verification email has been sent. Check your inbox and spam folder.");
    } catch (error) {
      setMessage(error.message || "Unable to resend the verification email.");
    } finally {
      setIsLoading(false);
    }
  }

  if (awaitingVerification) {
    return (
      <section className="auth-form" aria-live="polite">
        <h3>Verify Your Email</h3>
        <p>
          {email
            ? `We sent a verification link to ${email}.`
            : "We sent a verification link to your registered email."}
          {" "}You can open it on any device. After verifying, return to this page and click the button below.
        </p>
        <button type="button" disabled={isLoading} onClick={() => void finishRegistration()}>
          {isLoading ? "Checking..." : "I’ve Verified My Email"}
        </button>
        <button type="button" className="verification-resend-link" disabled={isLoading} onClick={() => void handleResend()}>
          Resend Verification Email
        </button>
        <p className="auth-message">{message}</p>
      </section>
    );
  }

  return (
    <form id="registerForm" className="auth-form" onSubmit={handleRegister}>
      <h3>Create Account</h3>
      <p className="auth-form-description">Step 1 of 3 — Create your sign-in credentials. You’ll verify your email before completing your PetalPal profile.</p>
      <label htmlFor="registerEmail">Email</label>
      <input id="registerEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <label htmlFor="registerPassword">PetalPal Password</label>
      <input id="registerPassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <label htmlFor="registerConfirmPassword">Confirm Password</label>
      <input id="registerConfirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
      <button type="submit" disabled={isLoading}>{isLoading ? "Creating..." : "Create account"}</button>
      <p className="auth-message" aria-live="polite">{message}</p>
    </form>
  );
}

export default RegisterForm;
