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
  it.each([['unknown@example.test', 'auth/user-not-found'], ['known@example.test', 'auth/wrong-password'], ['known@example.test', 'auth/invalid-credential'], ['disabled@example.test', 'auth/user-disabled'], ['known@example.test', undefined]])('keeps rejected login private for %s / %s', async (email, code) => {
    const onLogin = vi.fn();
    loginWithPassword.mockRejectedValue(Object.assign(new Error('private provider detail ' + email), { code }));
    render(<LoginForm onLogin={onLogin} />);
    await userEvent.type(screen.getByLabelText('Email'), email);
    await userEvent.type(screen.getByLabelText(/petalpal password/i), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: /sign in with password/i }));
    expect(await screen.findByText(code ? 'Check your email and password, then try again.' : 'We couldn’t connect to your account. Please try again.')).toBeInTheDocument();
    expect(screen.queryByText(/private provider detail/)).not.toBeInTheDocument();
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('preserves verification recovery after a successful password authentication', async () => {
    const onVerificationRequired = vi.fn();
    loginWithPassword.mockRejectedValue(Object.assign(new Error('verify'), { code: 'email-not-verified' }));
    render(<LoginForm onVerificationRequired={onVerificationRequired} />);
    await userEvent.type(screen.getByLabelText('Email'), 'known@example.test');
    await userEvent.type(screen.getByLabelText(/petalpal password/i), 'correct-password');
    await userEvent.click(screen.getByRole('button', { name: /sign in with password/i }));
    expect(onVerificationRequired).toHaveBeenCalledWith('known@example.test');
  });

  it('honors provider throttling without retrying or routing to verification', async () => {
    const onLogin = vi.fn(), onVerificationRequired = vi.fn();
    loginWithPassword.mockRejectedValue(Object.assign(new Error('private provider throttle'), { code: 'auth/too-many-requests' }));
    render(<LoginForm onLogin={onLogin} onVerificationRequired={onVerificationRequired} />);
    await userEvent.type(screen.getByLabelText('Email'), 'known@example.test');
    await userEvent.type(screen.getByLabelText(/petalpal password/i), 'synthetic-password');
    await userEvent.click(screen.getByRole('button', { name: /sign in with password/i }));
    expect(await screen.findByText('Too many attempts. Please wait before trying again.')).toBeInTheDocument();
    expect(loginWithPassword).toHaveBeenCalledOnce();
    expect(onLogin).not.toHaveBeenCalled(); expect(onVerificationRequired).not.toHaveBeenCalled();
  });

});
