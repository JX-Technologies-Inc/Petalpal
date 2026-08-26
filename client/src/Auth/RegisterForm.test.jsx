import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RegisterForm from "./RegisterForm";
import { pendingPasswordRegistration, recoverPendingRegistrationEmail, registerWithPassword } from "./firebaseSession";

vi.mock("./firebaseSession", () => ({
  completeVerifiedRegistration: vi.fn(),
  pendingPasswordRegistration: vi.fn(),
  recoverPendingRegistrationEmail: vi.fn(),
  registerWithPassword: vi.fn()
}));

describe("RegisterForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pendingPasswordRegistration.mockReturnValue(null);
    recoverPendingRegistrationEmail.mockResolvedValue("");
  });

  it("creates a Firebase password account and requests email verification", async () => {
    registerWithPassword.mockResolvedValue({ email: "bloom@example.com" });
    render(<RegisterForm />);
    await userEvent.type(screen.getByLabelText(/display name/i), "Bloom");
    await userEvent.type(screen.getByLabelText(/^email$/i), "bloom@example.com");
    await userEvent.type(screen.getByLabelText(/^petalpal password$/i), "secret12");
    await userEvent.type(screen.getByLabelText(/confirm password/i), "secret12");
    await userEvent.click(screen.getByRole("button", { name: /^create account$/i }));
    expect(registerWithPassword).toHaveBeenCalledWith(
      "bloom@example.com",
      "secret12",
      expect.objectContaining({ name: "Bloom" })
    );
    expect(await screen.findByRole("heading", { name: /verify your email/i })).toBeInTheDocument();
    expect(screen.getByText(/verification link to bloom@example\.com/i)).toBeInTheDocument();
    expect(screen.getByText(/open it on any device/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /use passwordless login instead/i })).not.toBeInTheDocument();
  });

  it("restores the registration email while awaiting verification", () => {
    pendingPasswordRegistration.mockReturnValue({ email: "saved@example.com" });
    render(<RegisterForm />);
    expect(screen.getByText(/verification link to saved@example\.com/i)).toBeInTheDocument();
  });

  it("never renders an empty email sentence for a legacy pending registration", () => {
    pendingPasswordRegistration.mockReturnValue({ name: "Legacy Bloom" });
    render(<RegisterForm />);
    expect(screen.getByText(/verification link to your registered email/i)).toBeInTheDocument();
    expect(screen.queryByText(/verification link to \s*\./i)).not.toBeInTheDocument();
  });
});
