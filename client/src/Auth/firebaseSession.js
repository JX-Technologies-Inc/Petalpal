import {
  createUserWithEmailAndPassword,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "firebase/auth";
import { firebaseAuth } from "../firebase";
import { API_BASE_URL } from "../api";

const PENDING_PROFILE_KEY = "petalPalPendingProfile";

function verificationSettings() {
  return { url: window.location.origin };
}

export function savePendingProfile(profile) {
  localStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(profile));
}

export function readPendingProfile() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_PROFILE_KEY)) || {};
  } catch {
    return {};
  }
}

export async function beginFirebaseRegistration(email, password, profile) {
  const credential = await createUserWithEmailAndPassword(
    firebaseAuth,
    email,
    password
  );

  await updateProfile(credential.user, { displayName: profile.name });
  savePendingProfile(profile);
  await sendEmailVerification(credential.user, verificationSettings());
  return credential.user;
}

export async function resendVerificationEmail() {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error("Please sign in again before resending.");
  await sendEmailVerification(user, verificationSettings());
}

export async function exchangeVerifiedUser(user, profile = {}) {
  await reload(user);

  if (!user.emailVerified) {
    throw new Error("Email is not verified yet. Open the email link first.");
  }

  const idToken = await user.getIdToken(true);
  const response = await fetch(`${API_BASE_URL}/auth/firebase`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idToken,
      ...readPendingProfile(),
      ...profile
    })
  });
  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.user || !data?.token) {
    throw new Error(data?.error || "Unable to start the verified session.");
  }

  localStorage.setItem("petalPalAccessToken", data.token);
  localStorage.setItem("petalPalCurrentUser", JSON.stringify(data.user));
  localStorage.removeItem(PENDING_PROFILE_KEY);
  return data.user;
}

export async function completePendingRegistration() {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error("Please sign in again after verifying your email.");
  return exchangeVerifiedUser(user);
}

export async function loginWithFirebase(email, password) {
  const credential = await signInWithEmailAndPassword(
    firebaseAuth,
    email,
    password
  );

  if (!credential.user.emailVerified) {
    await sendEmailVerification(credential.user, verificationSettings());
    return { pendingVerification: true, user: credential.user };
  }

  return {
    pendingVerification: false,
    user: await exchangeVerifiedUser(credential.user, {
      name: credential.user.displayName || email.split("@")[0]
    })
  };
}

export async function logoutFirebase() {
  await signOut(firebaseAuth).catch(() => {});
}
