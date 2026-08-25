import { useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "";

function RegisterForm({ onRegister }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatar, setAvatar] = useState("🦋");
  const [aiConsent, setAiConsent] = useState(false);

  const [message, setMessage] = useState("");
  const [accountId, setAccountId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleRegister(event) {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (
      !trimmedName ||
      !trimmedEmail ||
      !password ||
      !confirmPassword
    ) {
      setMessage("Please complete all fields.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    try {
      setIsLoading(true);
      setMessage("");
      setAccountId("");

      const response = await fetch(
        `${API_BASE_URL}/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: trimmedName,
            email: trimmedEmail,
            password,
            avatar,
            timezone:
              Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
            aiConsent,
          }),
        }
      );

      const contentType =
        response.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        throw new Error(
          `Server returned a non-JSON response (${response.status}).`
        );
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.message ||
            "Unable to register."
        );
      }

      if (!data.user || !data.token) {
        throw new Error("Server did not return a valid login session.");
      }

      localStorage.setItem(
        "petalPalAccessToken",
        data.token
      );

      localStorage.setItem(
        "petalPalCurrentUser",
        JSON.stringify(data.user)
      );

      setAccountId(data.user.accountId || "");
      setMessage("Registration successful!");

      if (typeof onRegister === "function") {
        onRegister(data.user);
      }
    } catch (error) {
      console.error("Register error:", error);

      setMessage(
        error.message ||
          "Something went wrong while registering."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form
      id="registerForm"
      className="auth-form"
      onSubmit={handleRegister}
    >
      <h3>Create Your Garden</h3>

      <p className="auth-form-description">
        Create an account and begin recording your daily blooms.
      </p>

      <label htmlFor="registerName">
        Display Name
      </label>

      <input
        id="registerName"
        type="text"
        value={name}
        placeholder="Enter your name"
        autoComplete="name"
        disabled={isLoading}
        onChange={(event) => {
          setName(event.target.value);
          setMessage("");
        }}
      />

      <label htmlFor="registerEmail">
        Email
      </label>

      <input
        id="registerEmail"
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

      <label htmlFor="registerPassword">
        Password
      </label>

      <input
        id="registerPassword"
        type="password"
        value={password}
        placeholder="At least 6 characters"
        autoComplete="new-password"
        disabled={isLoading}
        onChange={(event) => {
          setPassword(event.target.value);
          setMessage("");
        }}
      />

      <label htmlFor="registerConfirmPassword">
        Confirm Password
      </label>

      <input
        id="registerConfirmPassword"
        type="password"
        value={confirmPassword}
        placeholder="Enter your password again"
        autoComplete="new-password"
        disabled={isLoading}
        onChange={(event) => {
          setConfirmPassword(event.target.value);
          setMessage("");
        }}
      />

      <label htmlFor="registerAvatar">
        Choose Avatar
      </label>

      <select
        id="registerAvatar"
        value={avatar}
        disabled={isLoading}
        onChange={(event) => {
          setAvatar(event.target.value);
          setMessage("");
        }}
      >
        <option value="🦋">🦋 Butterfly</option>
        <option value="🐝">🐝 Bee</option>
        <option value="🐦">🐦 Bird</option>
      </select>

      <label className="consent-option" htmlFor="registerAiConsent">
        <input
          id="registerAiConsent"
          type="checkbox"
          checked={aiConsent}
          disabled={isLoading}
          onChange={(event) => setAiConsent(event.target.checked)}
        />
        Allow PetalPal to analyze optional journal text for mood detection.
        You can change this later.
      </label>

      <button
        id="registerBtn"
        type="submit"
        disabled={isLoading}
      >
        {isLoading
          ? "Creating Account..."
          : "Create My Garden"}
      </button>

      <p
        id="registerMessage"
        className="auth-message"
        aria-live="polite"
      >
        {message}
      </p>

      {accountId && (
        <div
          id="accountResult"
          className="account-result"
        >
          <p>Registration successful!</p>
          <p>Your PetalPal account ID is:</p>
          <strong id="generatedAccountId">
            {accountId}
          </strong>
        </div>
      )}
    </form>
  );
}

export default RegisterForm;
