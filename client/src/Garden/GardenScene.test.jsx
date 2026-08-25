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
    expect(screen.getByText("A bright day")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Delete Flower" }));
    expect(onDeleteFlower).toHaveBeenCalledWith("flower-1");
  });
});
