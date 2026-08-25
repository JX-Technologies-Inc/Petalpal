import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RegisterForm from "./RegisterForm";
import { registerWithPassword } from "./firebaseSession";

vi.mock("./firebaseSession", () => ({ registerWithPassword: vi.fn() }));

describe("RegisterForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a Firebase password account and requests email verification", async () => {
    registerWithPassword.mockResolvedValue();
    render(<RegisterForm />);
    await userEvent.type(screen.getByLabelText(/display name/i), "Bloom");
    await userEvent.type(screen.getByLabelText(/^email$/i), "bloom@example.com");
    await userEvent.type(screen.getByLabelText(/^password$/i), "secret12");
    await userEvent.type(screen.getByLabelText(/confirm password/i), "secret12");
    await userEvent.click(screen.getByRole("button", { name: /^create account$/i }));
    expect(registerWithPassword).toHaveBeenCalledWith(
      "bloom@example.com",
      "secret12",
      expect.objectContaining({ name: "Bloom" })
    );
    expect(await screen.findByText(/check your email to verify/i)).toBeInTheDocument();
  });
});
