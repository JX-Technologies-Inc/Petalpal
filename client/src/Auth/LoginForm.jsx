import { useState } from "react";
import { loginWithPassword } from "./firebaseSession";

function LoginForm({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function notifyLogin(data) {
    if (typeof onLogin !== "function") return;
    if (data.needsProfile) onLogin(null, data);
    else onLogin(data.user);
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

  return (
    <section className="auth-form">
      <h3>Welcome Back</h3>
      <form onSubmit={handlePasswordLogin}>
        <label htmlFor="loginEmail">Email</label>
        <input id="loginEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
