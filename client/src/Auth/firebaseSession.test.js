import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const user = {
    email: "cross-device@example.com",
    emailVerified: false,
    getIdToken: vi.fn(),
    reload: vi.fn()
  };
  return {
    auth: { authStateReady: vi.fn(), currentUser: user },
    user
  };
});

vi.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: vi.fn(),
  isSignInWithEmailLink: vi.fn(),
  sendEmailVerification: vi.fn(),
  sendSignInLinkToEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithEmailLink: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn()
}));
vi.mock("../firebase", () => ({ firebaseAuth: mocks.auth, googleProvider: {} }));
vi.mock("../api", () => ({ API_BASE_URL: "https://render.example.com" }));

import { completeVerifiedRegistration } from "./firebaseSession";

function backendResponse(body) {
  fetch.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(body) });
}

describe("verified registration synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.currentUser = mocks.user;
    mocks.user.emailVerified = false;
    mocks.user.getIdToken.mockResolvedValue("fresh-id-token");
    mocks.user.reload.mockResolvedValue();
    globalThis.fetch = vi.fn();
    localStorage.setItem("petalPalPendingPasswordProfile", JSON.stringify({ email: mocks.user.email }));
  });

  it("continues when verification was completed on the registering computer", async () => {
    mocks.user.emailVerified = true;
    backendResponse({ user: null, needsProfile: true, email: mocks.user.email });
    const result = await completeVerifiedRegistration();
    expect(mocks.user.reload).toHaveBeenCalledOnce();
    expect(mocks.user.getIdToken).toHaveBeenCalledWith(true);
    expect(result.needsProfile).toBe(true);
  });

  it("detects verification completed on another device after reload", async () => {
    mocks.user.reload.mockImplementation(async () => { mocks.user.emailVerified = true; });
    backendResponse({ user: null, needsProfile: true, email: mocks.user.email });
    await completeVerifiedRegistration();
    expect(fetch).toHaveBeenCalledWith(
      "https://render.example.com/auth/session",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer fresh-id-token" }),
        body: JSON.stringify({ deferProfileCreation: true })
      })
    );
  });

  it("uses an existing backend profile completed on another device", async () => {
    mocks.user.reload.mockImplementation(async () => { mocks.user.emailVerified = true; });
    const existingUser = { id: "existing-user", email: mocks.user.email };
    backendResponse({ user: existingUser, needsProfile: false });
    const result = await completeVerifiedRegistration();
    expect(result.user).toEqual(existingUser);
    expect(result.needsProfile).toBe(false);
  });

  it("does not contact the backend before email verification", async () => {
    await expect(completeVerifiedRegistration()).rejects.toThrow(/not verified yet/i);
    expect(mocks.user.reload).toHaveBeenCalledOnce();
    expect(mocks.user.getIdToken).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
