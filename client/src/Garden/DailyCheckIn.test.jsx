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

  it("requires a mood or optional journal text", async () => {
    const onBloom = vi.fn();
    render(<DailyCheckIn onBloom={onBloom} />);

    await userEvent.click(screen.getByRole("button", { name: "Bloom" }));

    expect(onBloom).not.toHaveBeenCalled();
    expect(
      screen.getByText(/choose a mood, or write an optional journal/i)
    ).toBeInTheDocument();
  });

  it("allows a manual mood without journal text", async () => {
    const onBloom = vi.fn().mockResolvedValue({ id: "flower-1" });
    render(<DailyCheckIn onBloom={onBloom} />);

    await userEvent.selectOptions(screen.getByRole("combobox"), "calm");
    await userEvent.click(screen.getByRole("button", { name: "Bloom" }));

    expect(onBloom).toHaveBeenCalledWith({ event: "", mood: "calm" });
    expect(await screen.findByText(/bloomed successfully/i)).toBeInTheDocument();
  });

  it("submits journal text for automatic detection", async () => {
    const onBloom = vi.fn().mockResolvedValue({ id: "flower-2" });
    render(<DailyCheckIn onBloom={onBloom} />);

    await userEvent.type(
      screen.getByPlaceholderText(/optional: what happened/i),
      "A peaceful afternoon"
    );
    await userEvent.click(screen.getByRole("button", { name: "Bloom" }));

    expect(onBloom).toHaveBeenCalledWith({
      event: "A peaceful afternoon",
      mood: ""
    });
  });
});
