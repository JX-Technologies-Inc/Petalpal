import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import RegisterForm from "./RegisterForm";

describe("RegisterForm", () => {
  it("creates a session and immediately hands the user to App", async () => {
    const onRegister = vi.fn();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({
        user: { id: "user-new", name: "Bloom", accountId: "PP123" },
        token: "registration-token"
      })
    });

    render(<RegisterForm onRegister={onRegister} />);
    await userEvent.type(screen.getByLabelText(/^display name$/i), "Bloom");
    await userEvent.type(screen.getByLabelText(/^email$/i), "bloom@example.com");
    await userEvent.type(screen.getByLabelText(/^password$/i), "secret12");
    await userEvent.type(screen.getByLabelText(/confirm password/i), "secret12");
    await userEvent.click(screen.getByRole("button", { name: /create my garden/i }));

    expect(await screen.findByText("Registration successful!")).toBeInTheDocument();
    expect(localStorage.getItem("petalPalAccessToken")).toBe("registration-token");
    expect(onRegister).toHaveBeenCalledWith({
      id: "user-new",
      name: "Bloom",
      accountId: "PP123"
    });
  });
});
