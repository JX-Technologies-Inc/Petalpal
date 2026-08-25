import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginForm from "./LoginForm";
import {
  finishPasswordlessLogin,
  isPasswordlessCallback,
  loginWithGoogle,
  loginWithPassword,
  savedPasswordlessEmail,
  sendPasswordlessLoginLink
} from "./firebaseSession";

vi.mock("./firebaseSession", () => ({
  finishPasswordlessLogin: vi.fn(),
  isPasswordlessCallback: vi.fn(),
  loginWithGoogle: vi.fn(),
  loginWithPassword: vi.fn(),
  savedPasswordlessEmail: vi.fn(),
  sendPasswordlessLoginLink: vi.fn()
}));

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isPasswordlessCallback.mockReturnValue(false);
  });

  it("sends a passwordless Firebase email link", async () => {
    sendPasswordlessLoginLink.mockResolvedValue();
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("Email", { selector: "#linkEmail" }), "link@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send me a login link/i }));
    expect(sendPasswordlessLoginLink).toHaveBeenCalledWith("link@example.com");
    expect(await screen.findByText(/no password is required/i)).toBeInTheDocument();
  });

  it("completes an email link and logs in without a password", async () => {
    const onLogin = vi.fn();
    isPasswordlessCallback.mockReturnValue(true);
    savedPasswordlessEmail.mockReturnValue("link@example.com");
    finishPasswordlessLogin.mockResolvedValue({ user: { id: "link-user" } });
    render(<LoginForm onLogin={onLogin} />);
    await waitFor(() => expect(onLogin).toHaveBeenCalledWith({ id: "link-user" }));
  });

  it("supports Firebase email and password login separately", async () => {
    const onLogin = vi.fn();
    loginWithPassword.mockResolvedValue({ user: { id: "password-user" } });
    render(<LoginForm onLogin={onLogin} />);
    await userEvent.type(screen.getByLabelText("Email", { selector: "#passwordEmail" }), "password@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "secret12");
    await userEvent.click(screen.getByRole("button", { name: /sign in with password/i }));
    expect(onLogin).toHaveBeenCalledWith({ id: "password-user" });
  });

  it("supports Google sign-in", async () => {
    const onLogin = vi.fn();
    loginWithGoogle.mockResolvedValue({ user: { id: "google-user" } });
    render(<LoginForm onLogin={onLogin} />);
    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    expect(onLogin).toHaveBeenCalledWith({ id: "google-user" });
  });
});
