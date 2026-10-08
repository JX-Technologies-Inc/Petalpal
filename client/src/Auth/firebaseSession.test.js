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

import { completeVerifiedRegistration, resendRegistrationVerificationEmail, restorePendingPasswordRegistration, signOutVerificationSession } from "./firebaseSession";
import { sendEmailVerification, signOut } from "firebase/auth";

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

  it("discards stale registration state when the Firebase user no longer exists", async () => {
    mocks.auth.currentUser = null;
    await expect(restorePendingPasswordRegistration()).resolves.toBeNull();
    expect(localStorage.getItem("petalPalPendingPasswordProfile")).toBeNull();
  });

  it("restores an unverified user without a pending registration marker", async () => {
    localStorage.removeItem("petalPalPendingPasswordProfile");
    await expect(restorePendingPasswordRegistration()).resolves.toEqual({ email: mocks.user.email, emailVerified: false });
  });

  it("signs out and removes only PetalPal auth state", async () => {
    localStorage.setItem("otherAppData", "keep");
    localStorage.setItem("petalPalCurrentUser", "cached");
    await signOutVerificationSession();
    expect(signOut).toHaveBeenCalledWith(mocks.auth);
    expect(localStorage.getItem("petalPalPendingPasswordProfile")).toBeNull();
    expect(localStorage.getItem("petalPalCurrentUser")).toBeNull();
    expect(localStorage.getItem("otherAppData")).toBe("keep");
  });

  it("resends verification through the current Firebase user with the current origin as continue URL", async () => {
    await expect(resendRegistrationVerificationEmail()).resolves.toBe(true);
    expect(mocks.user.reload).toHaveBeenCalledOnce();
    expect(sendEmailVerification).toHaveBeenCalledWith(mocks.user, { url: window.location.origin });
  });

  it("does not claim to resend when the user is already verified", async () => {
    mocks.user.reload.mockImplementation(async () => { mocks.user.emailVerified = true; });
    await expect(resendRegistrationVerificationEmail()).resolves.toBe(false);
    expect(sendEmailVerification).not.toHaveBeenCalled();
  });
  it.each([401, 403, 500, 503])('does not echo session diagnostics at status %s', async (status) => {
    mocks.user.emailVerified = true;
    fetch.mockResolvedValue({ ok: false, status, json: async () => ({ error: 'private user-not-found detail', firebaseErrorCode: 'auth/user-not-found', firebaseErrorMessage: mocks.user.email }) });
    await expect(completeVerifiedRegistration()).rejects.toThrow('Unable to start PetalPal session. Please try again.');
  });

});
