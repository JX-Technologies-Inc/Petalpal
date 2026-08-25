import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./api";

describe("apiRequest", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it("adds JSON and bearer token headers", async () => {
    localStorage.setItem("petalPalAccessToken", "signed-token");
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    });

    await expect(
      apiRequest("/garden", { method: "GET" })
    ).resolves.toEqual({ success: true });

    expect(fetch).toHaveBeenCalledWith("/garden", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer signed-token"
      }
    });
  });

  it("uses the backend error message", async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "Already checked in" })
    });

    await expect(apiRequest("/check-in")).rejects.toThrow(
      "Already checked in"
    );
  });

  it("handles a non-JSON error response", async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      }
    });

    await expect(apiRequest("/broken")).rejects.toThrow(
      "Request failed with status 500"
    );
  });
});
