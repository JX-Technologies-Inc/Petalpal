import { useCallback, useEffect, useState } from "react";
import {
  completeVerifiedRegistration,
  recoverPendingRegistrationEmail,
  resendRegistrationVerificationEmail
} from "./firebaseSession";

function VerifyEmailPage({ email: initialEmail, onVerified, onRequireLogin }) {
  const [email, setEmail] = useState(initialEmail || "");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const checkVerification = useCallback(async ({ quiet = false } = {}) => {
    try {
      if (!quiet) setIsLoading(true);
      const data = await completeVerifiedRegistration();
      if (typeof onVerified === "function") onVerified(data);
    } catch (error) {
      if (/session is unavailable/i.test(error.message || "")) {
        if (typeof onRequireLogin === "function") onRequireLogin();
      } else if (!quiet || !/not verified yet/i.test(error.message || "")) {
        setMessage(error.message || "Unable to confirm email verification.");
      }
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, [onRequireLogin, onVerified]);

  useEffect(() => {
    if (email) return;
    void recoverPendingRegistrationEmail().then((recoveredEmail) => {
      if (recoveredEmail) setEmail(recoveredEmail);
    });
  }, [email]);

  useEffect(() => {
    const checkOnFocus = () => void checkVerification({ quiet: true });
    window.addEventListener("focus", checkOnFocus);
    return () => window.removeEventListener("focus", checkOnFocus);
  }, [checkVerification]);

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

  return (
    <section className="auth-form" aria-live="polite">
      <h3>Verify Your Email</h3>
      <p>{email || "Your registered email"}</p>
      <button type="button" disabled={isLoading} onClick={() => void checkVerification()}>
        {isLoading ? "Checking..." : "I’ve Verified My Email"}
      </button>
      <button type="button" className="verification-resend-link" disabled={isLoading} onClick={() => void handleResend()}>
        Resend Verification Email
      </button>
      <p className="auth-message">{message}</p>
    </section>
  );
}

export default VerifyEmailPage;
