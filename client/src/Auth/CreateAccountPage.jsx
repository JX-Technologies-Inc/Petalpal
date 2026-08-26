import { useState } from "react";
import { registerWithPassword } from "./firebaseSession";

function CreateAccountPage({ onAccountCreated }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (password.length < 6) return setMessage("Password must be at least 6 characters.");
    if (password !== confirmPassword) return setMessage("Passwords do not match.");
    try {
      setIsLoading(true);
      const user = await registerWithPassword(email.trim(), password);
      if (typeof onAccountCreated === "function") onAccountCreated(user?.email || email.trim());
    } catch (error) {
      setMessage(error.message || "Unable to create account.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h3>Create Account</h3>
      <label htmlFor="registerEmail">Email</label>
      <input id="registerEmail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      <label htmlFor="registerPassword">PetalPal Password</label>
      <input id="registerPassword" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      <label htmlFor="registerConfirmPassword">Confirm Password</label>
      <input id="registerConfirmPassword" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
      <button type="submit" disabled={isLoading}>{isLoading ? "Creating..." : "Create Account"}</button>
      <p className="auth-message" aria-live="polite">{message}</p>
    </form>
  );
}

export default CreateAccountPage;
