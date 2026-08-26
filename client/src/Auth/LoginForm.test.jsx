import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginForm from "./LoginForm";
import { loginWithPassword } from "./firebaseSession";

vi.mock("./firebaseSession", () => ({
  loginWithPassword: vi.fn()
}));

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("supports Firebase email and password login separately", async () => {
    const onLogin = vi.fn();
    loginWithPassword.mockResolvedValue({ user: { id: "password-user" } });
    render(<LoginForm onLogin={onLogin} />);
    await userEvent.type(screen.getByLabelText("Email", { selector: "#loginEmail" }), "password@example.com");
    await userEvent.type(screen.getByLabelText(/petalpal password/i), "secret12");
    await userEvent.click(screen.getByRole("button", { name: /sign in with password/i }));
    expect(onLogin).toHaveBeenCalledWith({ id: "password-user" });
  });

  it("shows one email field for password login", () => {
    render(<LoginForm />);
    expect(screen.getAllByLabelText(/^email$/i)).toHaveLength(1);
  });

  it("does not expose Google or passwordless login", () => {
    render(<LoginForm />);
    expect(screen.queryByRole("button", { name: /google/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /login link/i })).not.toBeInTheDocument();
  });
});
