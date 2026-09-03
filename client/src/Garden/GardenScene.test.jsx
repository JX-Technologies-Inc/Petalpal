import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import GardenScene from "./GardenScene";

const flower = {
  id: "flower-1",
  name: "Sunflower",
  mood: "happy",
  event: "A bright day",
  meaning: "Joy",
  supportCount: 2,
  left: "37%",
  top: "61%",
  dailyCheckIn: {
    createdAt: "2026-09-03T00:00:00.000Z",
    journal: { content: "A bright day" },
    emotionResult: {
      secondaryEmotions: ["gratitude", "love"],
      intensity: 0.7,
      confidence: 0.91
    }
  },
  messages: []
};

describe("GardenScene", () => {
  it("renders an empty garden", () => {
    render(<GardenScene owner={{ id: "user-1", name: "Petal" }} />);
    expect(screen.getByText(/no flowers yet/i)).toBeInTheDocument();
  });

  it("opens flower details and deletes an owned flower", async () => {
    const onDeleteFlower = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <GardenScene
        owner={{ id: "user-1", name: "Petal" }}
        currentUser={{ id: "user-1", name: "Petal" }}
        flowers={[flower]}
        isOwnGarden
        onDeleteFlower={onDeleteFlower}
      />
    );

    await userEvent.click(screen.getByAltText("Sunflower"));
    expect(screen.getByAltText("Sunflower").closest("article")).toHaveStyle({
      left: "37%",
      top: "61%"
    });
    expect(screen.getByText("A bright day")).toBeInTheDocument();
    expect(screen.getByText(/gratitude, love/i)).toBeInTheDocument();
    expect(screen.getByText("0.7")).toBeInTheDocument();
    expect(screen.getByText("0.91")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Delete Flower" }));
    expect(onDeleteFlower).toHaveBeenCalledWith("flower-1");
  });

  it("shows no secondary result without exposing private ML fields socially", async () => {
    const { rerender } = render(
      <GardenScene
        owner={{ id: "user-1", name: "Petal" }}
        currentUser={{ id: "user-1", name: "Petal" }}
        flowers={[{ ...flower, dailyCheckIn: undefined }]}
        isOwnGarden
      />
    );

    await userEvent.click(screen.getByAltText("Sunflower"));
    expect(screen.getByText("None")).toBeInTheDocument();

    rerender(
      <GardenScene
        owner={{ id: "user-1", name: "Petal" }}
        currentUser={{ id: "friend-1", name: "Friend" }}
        flowers={[flower]}
        isOwnGarden={false}
      />
    );
    expect(screen.queryByText("Secondary:")).not.toBeInTheDocument();
  });
});
