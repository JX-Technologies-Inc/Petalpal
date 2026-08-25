import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import LoginForm from "./LoginForm";

describe("LoginForm", () => {
  it("stores the authenticated user and access token", async () => {
    const onLogin = vi.fn();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({
        user: { id: "user-1", name: "Petal" },
        token: "signed-token"
      })
    });

    render(<LoginForm onLogin={onLogin} />);
    await userEvent.type(screen.getByLabelText(/email/i), "petal@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "secret12");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));

    expect(await screen.findByText("Login successful!")).toBeInTheDocument();
    expect(localStorage.getItem("petalPalAccessToken")).toBe("signed-token");
    expect(onLogin).toHaveBeenCalledWith({ id: "user-1", name: "Petal" });
  });

  it("shows the backend authentication error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      headers: { get: () => "application/json" },
      json: async () => ({ error: "Invalid email or password" })
    });

    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "bad@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "wrongpass");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));

    expect(
      await screen.findByText("Invalid email or password")
    ).toBeInTheDocument();
  });
});
