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
