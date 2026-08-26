import { useEffect, useState } from "react";
import CompleteProfileForm from "./CompleteProfileForm";
import CreateAccountPage from "./CreateAccountPage";
import LoginForm from "./LoginForm";
import VerifyEmailPage from "./VerifyEmailPage";
import { pendingPasswordRegistration, restorePendingPasswordRegistration } from "./firebaseSession";

const AUTH_VIEWS = {
  LOGIN: "LOGIN",
  CREATE_ACCOUNT: "CREATE_ACCOUNT",
  VERIFY_EMAIL: "VERIFY_EMAIL",
  COMPLETE_PROFILE: "COMPLETE_PROFILE",
  RESTORING: "RESTORING"
};

function AuthFlow({ onAuthenticated, onLogout }) {
  const pendingRegistration = pendingPasswordRegistration();
  const [view, setView] = useState(pendingRegistration ? AUTH_VIEWS.RESTORING : AUTH_VIEWS.LOGIN);
  const [registrationEmail, setRegistrationEmail] = useState(pendingRegistration?.email || "");

  useEffect(() => {
    if (view !== AUTH_VIEWS.RESTORING) return;
    void restorePendingPasswordRegistration().then((restored) => {
      if (restored) {
        setRegistrationEmail(restored.email);
        setView(AUTH_VIEWS.VERIFY_EMAIL);
      } else {
        setRegistrationEmail("");
        setView(AUTH_VIEWS.CREATE_ACCOUNT);
      }
    });
  }, [view]);

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
      />
    );
  }

  if (view === AUTH_VIEWS.RESTORING) {
    return <p className="auth-message">Restoring registration...</p>;
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
        <LoginForm onLogin={handleAuthResult} />
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
