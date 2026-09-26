import { beforeEach, describe, expect, it, vi } from "vitest";

const { firebaseAuth } = vi.hoisted(() => ({
  firebaseAuth: {
    authStateReady: vi.fn(),
    currentUser: { getIdToken: vi.fn() }
  }
}));

vi.mock("./firebase", () => ({ firebaseAuth }));

import { apiRequest } from "./api";

describe("apiRequest", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    firebaseAuth.currentUser.getIdToken.mockResolvedValue("signed-token");
  });

  it("adds JSON and Firebase bearer token headers", async () => {
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
    expect(localStorage.getItem("petalPalAccessToken")).toBeNull();
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

  it("includes local Firebase verification diagnostics when supplied", async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        error: "Authentication service unavailable",
        firebaseErrorCode: "app/invalid-credential",
        firebaseErrorMessage: "Could not load the default credentials."
      })
    });

    await expect(apiRequest("/dev/emotion-preview")).rejects.toThrow(
      "app/invalid-credential: Could not load the default credentials."
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
