import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import AuthFlow from "./AuthFlow";
import { completeVerifiedRegistration, registerWithPassword, restorePendingPasswordRegistration, signOutVerificationSession } from "./firebaseSession";

vi.mock("./firebaseSession", () => ({
  completePasswordlessProfile: vi.fn(),
  completeVerifiedRegistration: vi.fn(),
  loginWithPassword: vi.fn(),
  recoverPendingRegistrationEmail: vi.fn().mockResolvedValue(""),
  restorePendingPasswordRegistration: vi.fn(),
  signOutVerificationSession: vi.fn(),
  registerWithPassword: vi.fn(),
  resendRegistrationVerificationEmail: vi.fn()
}));

beforeEach(() => {
  vi.clearAllMocks();
  restorePendingPasswordRegistration.mockResolvedValue(null);
});

it("shows login when there is no Firebase user", async () => {
  render(<AuthFlow />);
  expect(await screen.findByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
});

it("shows verification for an unverified Firebase user and signs out to switch accounts", async () => {
  restorePendingPasswordRegistration.mockResolvedValue({ email: "first@example.com", emailVerified: false });
  signOutVerificationSession.mockResolvedValue();
  render(<AuthFlow />);
  expect(await screen.findByRole("heading", { name: /verify your email/i })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /sign out \/ use another account/i }));
  expect(signOutVerificationSession).toHaveBeenCalledOnce();
  expect(await screen.findByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
});

it("restores an already verified Firebase user", async () => {
  const user = { id: "user-1" };
  const onAuthenticated = vi.fn();
  restorePendingPasswordRegistration.mockResolvedValue({ email: "first@example.com", emailVerified: true });
  completeVerifiedRegistration.mockResolvedValue({ user, needsProfile: false });
  render(<AuthFlow onAuthenticated={onAuthenticated} />);
  expect(await screen.findByText(/restoring sign-in/i)).toBeInTheDocument();
  await vi.waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith(user));
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
  await screen.findByRole("heading", { name: /welcome back/i });
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
