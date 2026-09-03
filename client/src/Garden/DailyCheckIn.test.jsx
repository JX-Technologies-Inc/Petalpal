import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DailyCheckIn from "./DailyCheckIn";

describe("DailyCheckIn", () => {
  it("shows the persisted completion state for today", () => {
    render(<DailyCheckIn onBloom={vi.fn()} completed />);
    expect(screen.getByText(/already growing/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bloom" })).not.toBeInTheDocument();
  });

  it("keeps Daily Grow available when the test limit is disabled", () => {
    render(<DailyCheckIn onBloom={vi.fn()} completed limitEnabled={false} />);
    expect(screen.getByRole("button", { name: "Bloom" })).toBeInTheDocument();
    expect(screen.queryByText(/already growing/i)).not.toBeInTheDocument();
  });

  it("requires a canonical Primary Bloom", async () => {
    const onBloom = vi.fn();
    render(<DailyCheckIn onBloom={onBloom} />);

    await userEvent.click(screen.getByRole("button", { name: "Bloom" }));

    expect(onBloom).not.toHaveBeenCalled();
    expect(
      screen.getByText("Choose a Primary Bloom.")
    ).toBeInTheDocument();
  });

  it("allows a manual mood without journal text", async () => {
    const onBloom = vi.fn().mockResolvedValue({ id: "flower-1" });
    render(<DailyCheckIn onBloom={onBloom} />);

    await userEvent.selectOptions(screen.getByRole("combobox"), "PEACEFUL_BLOOM");
    await userEvent.click(screen.getByRole("button", { name: "Bloom" }));

    expect(onBloom).toHaveBeenCalledWith({ event: "", mood: "PEACEFUL_BLOOM" });
    expect(await screen.findByText(/bloomed successfully/i)).toBeInTheDocument();
  });

  it("submits optional journal text with the canonical Primary Bloom", async () => {
    const onBloom = vi.fn().mockResolvedValue({ id: "flower-2" });
    render(<DailyCheckIn onBloom={onBloom} />);

    await userEvent.type(
      screen.getByPlaceholderText(/optional: what happened/i),
      "A peaceful afternoon"
    );
    await userEvent.selectOptions(screen.getByRole("combobox"), "SUNNY_BLOOM");
    await userEvent.click(screen.getByRole("button", { name: "Bloom" }));

    expect(onBloom).toHaveBeenCalledWith({
      event: "A peaceful afternoon",
      mood: "SUNNY_BLOOM"
    });
  });

  it("offers all 8 canonical Primary Bloom codes", () => {
    render(<DailyCheckIn onBloom={vi.fn()} />);

    expect(
      Array.from(screen.getByRole("combobox").options).slice(1).map(({ value }) => value)
    ).toEqual([
      "SUNNY_BLOOM",
      "GENTLE_BLOOM",
      "QUIET_BLOOM",
      "HEALING_BLOOM",
      "FIRE_BLOOM",
      "WONDER_BLOOM",
      "DRIFTING_BLOOM",
      "PEACEFUL_BLOOM"
    ]);
  });

  it("shows the product message for a duplicate Daily Grow", async () => {
    const error = Object.assign(new Error("backend duplicate"), { status: 409 });
    render(<DailyCheckIn onBloom={vi.fn().mockRejectedValue(error)} />);

    await userEvent.selectOptions(screen.getByRole("combobox"), "SUNNY_BLOOM");
    await userEvent.click(screen.getByRole("button", { name: "Bloom" }));

    expect(await screen.findByText("Today’s flower is already growing.")).toBeInTheDocument();
  });
});
