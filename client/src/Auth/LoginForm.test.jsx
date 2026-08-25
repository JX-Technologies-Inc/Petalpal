import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginForm from "./LoginForm";
import {
  completePendingRegistration,
  loginWithFirebase
} from "./firebaseSession";

vi.mock("./firebaseSession", () => ({
  loginWithFirebase: vi.fn(),
  completePendingRegistration: vi.fn(),
  resendVerificationEmail: vi.fn()
}));

describe("LoginForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hands a Firebase-verified user to App", async () => {
    const onLogin = vi.fn();
    loginWithFirebase.mockResolvedValue({
      pendingVerification: false,
      user: { id: "user-1", name: "Petal", emailVerified: true }
    });

    render(<LoginForm onLogin={onLogin} />);
    await userEvent.type(screen.getByLabelText(/email/i), "petal@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "secret12");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));

    expect(await screen.findByText("Login successful!")).toBeInTheDocument();
    expect(onLogin).toHaveBeenCalledWith({
      id: "user-1",
      name: "Petal",
      emailVerified: true
    });
  });

  it("blocks an unverified Firebase user", async () => {
    loginWithFirebase.mockResolvedValue({ pendingVerification: true });
    completePendingRegistration.mockRejectedValue(
      new Error("Email is not verified yet")
    );

    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "pending@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "secret12");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));

    expect(await screen.findByText(/verify your email/i)).toBeInTheDocument();
    expect(screen.getByText(/waiting for verification/i)).toBeInTheDocument();
  });
});
