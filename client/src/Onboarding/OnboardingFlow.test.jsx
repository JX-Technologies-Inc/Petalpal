import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import OnboardingFlow from "./OnboardingFlow";

describe("OnboardingFlow", () => {
  it("persists the transition to mood selection", async () => {
    const onAdvance = vi.fn().mockResolvedValue(undefined);
    render(
      <OnboardingFlow
        fairyState={{ onboardingStep: "EMPTY_GARDEN" }}
        onAdvance={onAdvance}
        onBloom={vi.fn()}
      />
    );

    await userEvent.click(
      screen.getByRole("button", { name: /plant my first flower/i })
    );

    expect(onAdvance).toHaveBeenCalledWith({
      onboardingStep: "MOOD_SELECTION",
      lastEvent: "FAIRY_APPEARS"
    });
  });

  it("resumes at the persisted mood selection step", () => {
    render(
      <OnboardingFlow
        fairyState={{ onboardingStep: "MOOD_SELECTION" }}
        onAdvance={vi.fn()}
        onBloom={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: /how are you feeling/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bloom" })).toBeInTheDocument();
  });
});
