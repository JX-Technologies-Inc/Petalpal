import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api";
import GardenScene from "./GardenScene";

vi.mock("../api", () => ({ apiRequest: vi.fn() }));

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

const availableSupportState = {
  localDate: "2026-09-28",
  supportedToday: false,
  canSupport: true,
  isOwner: false
};
const supportedState = {
  ...availableSupportState,
  supportedToday: true,
  canSupport: false
};

function renderVisitor(props = {}) {
  return render(
    <GardenScene
      owner={{ id: "owner-1", name: "Petal" }}
      currentUser={{ id: "visitor-1", name: "Friend", avatar: "🦋" }}
      flowers={[flower]}
      {...props}
    />
  );
}

function expectSupportCount(count) {
  expect(screen.getByText("Support:").parentElement).toHaveTextContent(`Support: ${count}`);
  expect(document.querySelector(".flower-support-count")).toHaveTextContent(String(count));
}

describe("GardenScene", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockResolvedValue({ ...flower, supportState: availableSupportState });
  });

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
    expect(screen.queryByRole("button", { name: /support/i })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Leave a kind message...")).not.toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalled();

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

  it("loads the authenticated viewer's already-supported state on selection", async () => {
    apiRequest.mockResolvedValue({ ...flower, supportCount: 7, supportState: supportedState });
    renderVisitor();

    await userEvent.click(screen.getByAltText("Sunflower"));

    expect(await screen.findByRole("button", { name: "Supported today ✓" })).toBeDisabled();
    expect(apiRequest).toHaveBeenCalledWith("/users/owner-1/flowers/flower-1", { method: "GET" });
    expectSupportCount(7);
    expect(screen.getByText("A bright day")).toBeInTheDocument();
    expect(screen.getByText("Joy")).toBeInTheDocument();
  });

  it("uses the server count after Support succeeds and disables further Support today", async () => {
    let finishSupport;
    apiRequest.mockResolvedValueOnce({ ...flower, supportState: availableSupportState });
    apiRequest.mockImplementationOnce(() => new Promise((resolve) => { finishSupport = resolve; }));
    renderVisitor();
    await userEvent.click(screen.getByAltText("Sunflower"));
    await userEvent.click(await screen.findByRole("button", { name: "Give Support 💗" }));

    expect(screen.getByRole("button", { name: "Working..." })).toBeDisabled();
    expectSupportCount(2);
    expect(apiRequest).toHaveBeenLastCalledWith("/users/owner-1/flowers/flower-1/support", {
      method: "POST",
      body: JSON.stringify({ visitorUserId: "visitor-1", visitorAvatar: "🦋" })
    });

    await act(async () => {
      finishSupport({ ...flower, supportCount: 3, supportState: supportedState });
    });

    const supportedButton = await screen.findByRole("button", { name: "Supported today ✓" });
    expect(supportedButton).toBeDisabled();
    expectSupportCount(3);
    await userEvent.click(supportedButton);
    expect(apiRequest).toHaveBeenCalledTimes(2);
    expect(screen.getByPlaceholderText("Leave a kind message...")).toBeEnabled();
  });

  it("does not add a count when the server reports a duplicate same-day Support", async () => {
    apiRequest.mockResolvedValueOnce({ ...flower, supportState: availableSupportState });
    apiRequest.mockResolvedValueOnce({ ...flower, supportState: supportedState });
    renderVisitor();
    await userEvent.click(screen.getByAltText("Sunflower"));
    await userEvent.click(await screen.findByRole("button", { name: "Give Support 💗" }));

    expect(await screen.findByRole("button", { name: "Supported today ✓" })).toBeDisabled();
    expectSupportCount(2);
  });

  it("shows Support errors without changing the count or losing existing details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    apiRequest.mockResolvedValueOnce({ ...flower, supportState: availableSupportState });
    apiRequest.mockRejectedValueOnce(new Error("Support temporarily unavailable."));
    renderVisitor();
    await userEvent.click(screen.getByAltText("Sunflower"));
    await userEvent.click(await screen.findByRole("button", { name: "Give Support 💗" }));

    expect(await screen.findByText("Support temporarily unavailable.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Give Support 💗" })).toBeEnabled();
    expectSupportCount(2);
    expect(screen.getByText("A bright day")).toBeInTheDocument();
    expect(screen.getByText("Joy")).toBeInTheDocument();
  });

  it("shows a detail-load error and allows an authoritative Support retry", async () => {
    apiRequest.mockRejectedValueOnce(new Error("Could not load support status."));
    apiRequest.mockResolvedValueOnce({ ...flower, supportCount: 3, supportState: supportedState });
    renderVisitor();
    await userEvent.click(screen.getByAltText("Sunflower"));

    expect(await screen.findByText("Could not load support status.")).toBeInTheDocument();
    const supportButton = screen.getByRole("button", { name: "Give Support 💗" });
    expect(supportButton).toBeEnabled();
    await userEvent.click(supportButton);

    expect(await screen.findByRole("button", { name: "Supported today ✓" })).toBeDisabled();
    expect(screen.queryByText("Could not load support status.")).not.toBeInTheDocument();
    expectSupportCount(3);
  });

  it("refreshes daily Support state when the same flower is reopened", async () => {
    apiRequest.mockResolvedValueOnce({ ...flower, supportState: supportedState });
    apiRequest.mockResolvedValueOnce({
      ...flower,
      supportState: { ...availableSupportState, localDate: "2026-09-29" }
    });
    renderVisitor();
    await userEvent.click(screen.getByAltText("Sunflower"));
    expect(await screen.findByRole("button", { name: "Supported today ✓" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Close flower details" }));
    await userEvent.click(screen.getByAltText("Sunflower"));

    await waitFor(() => expect(screen.getByRole("button", { name: "Give Support 💗" })).toBeEnabled());
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });

  it("keeps viewer Support state separate from another visitor's realtime flower state", async () => {
    const handlers = {};
    const socket = {
      on: vi.fn((event, handler) => { handlers[event] = handler; }),
      off: vi.fn(),
      emit: vi.fn()
    };
    renderVisitor({ socket });
    await userEvent.click(screen.getByAltText("Sunflower"));
    expect(await screen.findByRole("button", { name: "Give Support 💗" })).toBeEnabled();

    act(() => {
      handlers.supportUpdated({
        gardenOwnerId: "owner-1",
        flower: { ...flower, supportCount: 8, supportState: supportedState }
      });
      handlers.messageAdded({
        gardenOwnerId: "owner-1",
        flower: {
          ...flower,
          supportCount: 8,
          supportState: supportedState,
          messages: [{ id: "message-1", author: "Friend", text: "Keep blooming" }]
        }
      });
    });

    expect(screen.getByRole("button", { name: "Give Support 💗" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Supported today ✓" })).not.toBeInTheDocument();
    expectSupportCount(8);
    expect(screen.getByText("Friend: Keep blooming")).toBeInTheDocument();
  });
});
