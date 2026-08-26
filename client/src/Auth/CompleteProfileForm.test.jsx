import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import CompleteProfileForm from "./CompleteProfileForm";
import { completePasswordlessProfile } from "./firebaseSession";

vi.mock("./firebaseSession", () => ({ completePasswordlessProfile: vi.fn() }));

it("completes a passwordless profile without asking for a password", async () => {
  const onComplete = vi.fn();
  completePasswordlessProfile.mockResolvedValue({ user: { id: "new-user" } });
  render(<CompleteProfileForm email="new@example.com" onComplete={onComplete} />);
  expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  await userEvent.type(screen.getByLabelText(/display name/i), "New Bloom");
  await userEvent.click(screen.getByRole("button", { name: /continue to onboarding/i }));
  expect(completePasswordlessProfile).toHaveBeenCalledWith(expect.objectContaining({ name: "New Bloom" }));
  expect(onComplete).toHaveBeenCalledWith({ id: "new-user" });
});
