import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RegisterForm from "./RegisterForm";
import {
  beginFirebaseRegistration,
  completePendingRegistration
} from "./firebaseSession";

vi.mock("./firebaseSession", () => ({
  beginFirebaseRegistration: vi.fn(),
  completePendingRegistration: vi.fn(),
  resendVerificationEmail: vi.fn()
}));

describe("RegisterForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires email verification before handing the user to App", async () => {
    const onRegister = vi.fn();
    beginFirebaseRegistration.mockResolvedValue({ uid: "firebase-1" });
    completePendingRegistration.mockResolvedValue({
      id: "user-new",
      name: "Bloom",
      accountId: "PP123",
      emailVerified: true
    });

    render(<RegisterForm onRegister={onRegister} />);
    await userEvent.type(screen.getByLabelText(/^display name$/i), "Bloom");
    await userEvent.type(screen.getByLabelText(/^email$/i), "bloom@example.com");
    await userEvent.type(screen.getByLabelText(/^password$/i), "secret12");
    await userEvent.type(screen.getByLabelText(/confirm password/i), "secret12");
    await userEvent.click(screen.getByRole("button", { name: /create my garden/i }));

    expect(await screen.findByText(/checking verification status/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(onRegister).toHaveBeenCalledWith(expect.objectContaining({
        id: "user-new",
        emailVerified: true
      }));
    });
  });
});
