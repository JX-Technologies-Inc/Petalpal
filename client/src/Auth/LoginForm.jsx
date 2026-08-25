import { useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "";

function LoginForm({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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

      const response = await fetch(
        `${API_BASE_URL}/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: trimmedEmail,
            password,
          }),
        }
      );

      const contentType =
        response.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        const responseText = await response.text();

        throw new Error(
          `Server returned a non-JSON response (${response.status}).`
        );
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Unable to log in."
        );
      }

      const loggedInUser = data.user;

      if (!loggedInUser || !data.token) {
        throw new Error("Server did not return a valid login session.");
      }

      localStorage.setItem(
        "petalPalAccessToken",
        data.token
      );

      localStorage.setItem(
        "petalPalCurrentUser",
        JSON.stringify(loggedInUser)
      );

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
