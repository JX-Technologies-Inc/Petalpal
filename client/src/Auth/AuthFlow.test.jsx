import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import AuthFlow from "./AuthFlow";
import { completeVerifiedRegistration, pendingPasswordRegistration, registerWithPassword } from "./firebaseSession";

vi.mock("./firebaseSession", () => ({
  completePasswordlessProfile: vi.fn(),
  completeVerifiedRegistration: vi.fn(),
  loginWithPassword: vi.fn(),
  pendingPasswordRegistration: vi.fn(),
  recoverPendingRegistrationEmail: vi.fn().mockResolvedValue(""),
  registerWithPassword: vi.fn(),
  resendRegistrationVerificationEmail: vi.fn()
}));

beforeEach(() => {
  vi.clearAllMocks();
  pendingPasswordRegistration.mockReturnValue(null);
});

it("transitions CREATE_ACCOUNT to VERIFY_EMAIL to COMPLETE_PROFILE", async () => {
  registerWithPassword.mockResolvedValue({ email: "mobile-verified@example.com" });
  completeVerifiedRegistration.mockResolvedValue({
    user: null,
    needsProfile: true,
    email: "mobile-verified@example.com",
    authMethod: "password"
  });
  render(<AuthFlow />);
  await userEvent.click(screen.getAllByRole("button", { name: /^create account$/i }).at(-1));
  await userEvent.type(screen.getByLabelText(/^email$/i), "mobile-verified@example.com");
  await userEvent.type(screen.getByLabelText(/^petalpal password$/i), "secret12");
  await userEvent.type(screen.getByLabelText(/confirm password/i), "secret12");
  await userEvent.click(screen.getAllByRole("button", { name: /^create account$/i }).at(-1));
  expect(await screen.findByRole("heading", { name: /verify your email/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^log in$/i })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /i’ve verified my email/i }));
  expect(await screen.findByRole("heading", { name: /complete profile/i })).toBeInTheDocument();
});
