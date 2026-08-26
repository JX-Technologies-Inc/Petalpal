import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import VerifyEmailPage from "./VerifyEmailPage";
import { completeVerifiedRegistration } from "./firebaseSession";

vi.mock("./firebaseSession", () => ({
  completeVerifiedRegistration: vi.fn(),
  recoverPendingRegistrationEmail: vi.fn().mockResolvedValue(""),
  resendRegistrationVerificationEmail: vi.fn()
}));

beforeEach(() => vi.clearAllMocks());

it("is a standalone verification page without tabs or password fields", () => {
  render(<VerifyEmailPage email="bloom@example.com" />);
  expect(screen.getByRole("heading", { name: /verify your email/i })).toBeInTheDocument();
  expect(screen.getByText("bloom@example.com")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /log in|create account/i })).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
});

it("moves a cross-device verified user to complete profile", async () => {
  const onVerified = vi.fn();
  const result = { user: null, needsProfile: true, email: "bloom@example.com", authMethod: "password" };
  completeVerifiedRegistration.mockResolvedValue(result);
  render(<VerifyEmailPage email="bloom@example.com" onVerified={onVerified} />);
  await userEvent.click(screen.getByRole("button", { name: /i’ve verified my email/i }));
  expect(onVerified).toHaveBeenCalledWith(result);
});

it("stays on verify email when Firebase is not verified", async () => {
  completeVerifiedRegistration.mockRejectedValue(new Error("Email is not verified yet."));
  render(<VerifyEmailPage email="bloom@example.com" />);
  await userEvent.click(screen.getByRole("button", { name: /i’ve verified my email/i }));
  expect(await screen.findByText("Email is not verified yet.")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /verify your email/i })).toBeInTheDocument();
});
