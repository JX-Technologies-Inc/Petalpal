import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import CreateAccountPage from "./CreateAccountPage";
import { registerWithPassword } from "./firebaseSession";

vi.mock("./firebaseSession", () => ({ registerWithPassword: vi.fn() }));

it("creates only Firebase credentials before verification", async () => {
  const onAccountCreated = vi.fn();
  registerWithPassword.mockResolvedValue({ email: "bloom@example.com" });
  render(<CreateAccountPage onAccountCreated={onAccountCreated} />);
  expect(screen.queryByLabelText(/display name|avatar|consent/i)).not.toBeInTheDocument();
  await userEvent.type(screen.getByLabelText(/^email$/i), "bloom@example.com");
  await userEvent.type(screen.getByLabelText(/^petalpal password$/i), "secret12");
  await userEvent.type(screen.getByLabelText(/confirm password/i), "secret12");
  await userEvent.click(screen.getByRole("button", { name: /^create account$/i }));
  expect(registerWithPassword).toHaveBeenCalledWith("bloom@example.com", "secret12");
  expect(onAccountCreated).toHaveBeenCalledWith("bloom@example.com");
});

it.each(['auth/email-already-in-use', 'auth/internal-error', undefined])("keeps signup failure private for provider code %s", async (code) => {
  registerWithPassword.mockRejectedValue(Object.assign(new Error('Firebase: EMAIL_EXISTS private@example.test'), { code }));
  const onAccountCreated = vi.fn();
  render(<CreateAccountPage onAccountCreated={onAccountCreated} />);
  await userEvent.type(screen.getByLabelText(/^email$/i), "bloom@example.com");
  await userEvent.type(screen.getByLabelText(/^petalpal password$/i), "secret12");
  await userEvent.type(screen.getByLabelText(/confirm password/i), "secret12");
  await userEvent.click(screen.getByRole("button", { name: /^create account$/i }));
  expect(await screen.findByText("We couldn’t connect to your account. Please try again.")).toBeInTheDocument();
  expect(screen.queryByText(/EMAIL_EXISTS|already has an account|Firebase:|private@example.test/)).not.toBeInTheDocument();
  expect(onAccountCreated).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: /^create account$/i })).toBeEnabled();
});
