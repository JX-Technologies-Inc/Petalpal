import { useEffect, useState } from "react";
import CompleteProfileForm from "./CompleteProfileForm";
import CreateAccountPage from "./CreateAccountPage";
import LoginForm from "./LoginForm";
import VerifyEmailPage from "./VerifyEmailPage";
import { completeVerifiedRegistration, restorePendingPasswordRegistration, signOutVerificationSession } from "./firebaseSession";

const AUTH_VIEWS = {
  LOGIN: "LOGIN",
  CREATE_ACCOUNT: "CREATE_ACCOUNT",
  VERIFY_EMAIL: "VERIFY_EMAIL",
  COMPLETE_PROFILE: "COMPLETE_PROFILE",
  RESTORING: "RESTORING"
};

function AuthFlow({ onAuthenticated, onLogout }) {
  const [view, setView] = useState(AUTH_VIEWS.RESTORING);
  const [registrationEmail, setRegistrationEmail] = useState("");
  const [restoreError, setRestoreError] = useState("");

  useEffect(() => {
    if (view !== AUTH_VIEWS.RESTORING) return;
    let active = true;
    void (async () => {
      try {
        const restored = await restorePendingPasswordRegistration();
        if (!active) return;
        if (!restored) {
          setView(AUTH_VIEWS.LOGIN);
        } else if (!restored.emailVerified) {
          setRegistrationEmail(restored.email);
          setView(AUTH_VIEWS.VERIFY_EMAIL);
        } else {
          const result = await completeVerifiedRegistration();
          if (!active) return;
          if (result.needsProfile) {
            setRegistrationEmail(result.email || restored.email);
            setView(AUTH_VIEWS.COMPLETE_PROFILE);
          } else {
            onAuthenticated?.(result.user);
          }
        }
      } catch (error) {
        if (!active) return;
        setRestoreError(error.message || "Unable to restore your session.");
        setView(AUTH_VIEWS.LOGIN);
      }
    })();
    return () => { active = false; };
  }, [view, onAuthenticated]);

  async function handleSignOut() {
    await signOutVerificationSession();
    setRegistrationEmail("");
    setRestoreError("");
    setView(AUTH_VIEWS.LOGIN);
  }

  function handleAuthResult(user, result = {}) {
    if (result.needsProfile) {
      setRegistrationEmail(result.email || registrationEmail);
      setView(AUTH_VIEWS.COMPLETE_PROFILE);
    } else if (typeof onAuthenticated === "function") {
      onAuthenticated(user);
    }
  }

  function handleVerified(result) {
    handleAuthResult(result.user, result);
  }

  if (view === AUTH_VIEWS.VERIFY_EMAIL) {
    return (
      <VerifyEmailPage
        email={registrationEmail}
        onVerified={handleVerified}
        onRequireLogin={() => setView(AUTH_VIEWS.LOGIN)}
        onSignOut={handleSignOut}
      />
    );
  }

  if (view === AUTH_VIEWS.RESTORING) {
    return <p className="auth-message">Restoring sign-in...</p>;
  }

  if (view === AUTH_VIEWS.COMPLETE_PROFILE) {
    return (
      <CompleteProfileForm
        email={registrationEmail}
        authMethod="password"
        onComplete={onAuthenticated}
        onCancel={onLogout}
      />
    );
  }

  return (
    <>
      <div className="auth-tabs">
        <button id="showLoginBtn" className={`auth-tab ${view === AUTH_VIEWS.LOGIN ? "active" : ""}`} type="button" onClick={() => setView(AUTH_VIEWS.LOGIN)}>
          Log In
        </button>
        <button id="showRegisterBtn" className={`auth-tab ${view === AUTH_VIEWS.CREATE_ACCOUNT ? "active" : ""}`} type="button" onClick={() => setView(AUTH_VIEWS.CREATE_ACCOUNT)}>
          Create Account
        </button>
      </div>
      {view === AUTH_VIEWS.LOGIN ? (
        <>
          {restoreError && <p className="auth-message" role="alert">{restoreError}</p>}
          <LoginForm onLogin={handleAuthResult} onVerificationRequired={(email) => {
            setRegistrationEmail(email);
            setView(AUTH_VIEWS.VERIFY_EMAIL);
          }} />
        </>
      ) : (
        <CreateAccountPage
          onAccountCreated={(email) => {
            setRegistrationEmail(email);
            setView(AUTH_VIEWS.VERIFY_EMAIL);
          }}
        />
      )}
    </>
  );
}

export default AuthFlow;
