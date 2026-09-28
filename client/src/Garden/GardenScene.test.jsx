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
    expect(screen.queryByText("Inferred secondary emotions (unconfirmed):")).not.toBeInTheDocument();
  });

  it("shows Event secondary emotions and existing visual metadata", async () => {
    render(
      <GardenScene
        owner={{ id: "user-1", name: "Petal" }}
        currentUser={{ id: "user-1", name: "Petal" }}
        flowers={[{
          ...flower, dailyCheckIn: null, sourceEventId: "event-1",
          sourceEvent: { secondaryEmotions: ["optimism"] },
          colorAccent: "DAWN_GOLD", visualEffect: "RISING_LIGHT"
        }]}
        isOwnGarden
      />
    );
    await userEvent.click(screen.getByAltText("Sunflower"));
    expect(screen.getByText("Inferred secondary emotions (unconfirmed):")).toBeInTheDocument();
    expect(screen.getByText("optimism")).toBeInTheDocument();
    expect(screen.getByText("DAWN_GOLD")).toBeInTheDocument();
    expect(screen.getByText("RISING_LIGHT")).toBeInTheDocument();
  });

  it("shows None for an Event flower with no secondary emotions", async () => {
    render(
      <GardenScene
        owner={{ id: "user-1", name: "Petal" }}
        currentUser={{ id: "user-1", name: "Petal" }}
        flowers={[{ ...flower, dailyCheckIn: null, sourceEventId: "event-2", sourceEvent: { secondaryEmotions: [] } }]}
        isOwnGarden
      />
    );
    await userEvent.click(screen.getByAltText("Sunflower"));
    expect(screen.getByText("None")).toBeInTheDocument();
  });

  it("renders secondary accents and effects without changing the Primary Mood flower image", () => {
    const base = {
      ...flower, mood: "SUNNY_BLOOM", dailyCheckIn: null, sourceEventId: "event-3",
      sourceEvent: { secondaryEmotions: [] }, colorAccent: null, visualEffect: null
    };
    const props = { owner: { id: "user-1", name: "Petal" }, flowers: [base] };
    const { rerender } = render(<GardenScene {...props} />);
    const imagePath = screen.getByAltText("Sunflower").getAttribute("src");
    let card = screen.getByAltText("Sunflower").closest("article");
    expect(card).not.toHaveClass("flower-card-accented");
    expect(card.querySelector(".flower-accent-halo")).toBeNull();

    rerender(<GardenScene {...props} flowers={[{
      ...base, sourceEvent: { secondaryEmotions: ["gratitude"] },
      colorAccent: "WARM_GOLD", visualEffect: "SOFT_SPARKLE"
    }]} />);
    card = screen.getByAltText("Sunflower").closest("article");
    expect(card).toHaveClass("flower-card-accented", "flower-effect-sparkle");
    expect(card.style.getPropertyValue("--flower-accent")).toBe("#eab84e");
    expect(card.querySelector(".flower-accent-halo")).not.toBeNull();
    expect(screen.getByAltText("Sunflower").getAttribute("src")).toBe(imagePath);

    rerender(<GardenScene {...props} flowers={[{
      ...base, sourceEvent: { secondaryEmotions: ["gratitude", "surprise"] },
      colorAccent: "WARM_GOLD", visualEffect: "FLASH_SPARKLE"
    }]} />);
    card = screen.getByAltText("Sunflower").closest("article");
    expect(card).toHaveClass("flower-card-accented", "flower-effect-flash");
    expect(card).not.toHaveClass("flower-effect-sparkle");
    expect(card.style.getPropertyValue("--flower-accent")).toBe("#eab84e");
    expect(screen.getByAltText("Sunflower").getAttribute("src")).toBe(imagePath);

    rerender(<GardenScene {...props} flowers={[{
      ...base, sourceEvent: { secondaryEmotions: ["gratitude", "fear"] },
      colorAccent: "WARM_GOLD", visualEffect: "SUBTLE_MIST"
    }]} />);
    card = screen.getByAltText("Sunflower").closest("article");
    expect(card).toHaveClass("flower-card-accented", "flower-effect-haze");
    expect(card).not.toHaveClass("flower-effect-sparkle");
    expect(card.style.getPropertyValue("--flower-accent")).toBe("#eab84e");
    expect(screen.getByAltText("Sunflower").getAttribute("src")).toBe(imagePath);

    rerender(<GardenScene {...props} flowers={[{
      ...base, sourceEventId: undefined, sourceEvent: undefined,
      colorAccent: "WARM_GOLD", visualEffect: "SUBTLE_MIST"
    }]} />);
    expect(screen.getByAltText("Sunflower").closest("article")).toHaveClass("flower-card-accented", "flower-effect-haze");
  });
});
