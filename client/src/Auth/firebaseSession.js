import {
  createUserWithEmailAndPassword,
  isSignInWithEmailLink,
  sendEmailVerification,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
  updateProfile
} from "firebase/auth";
import { API_BASE_URL } from "../api";
import { firebaseAuth, googleProvider } from "../firebase";

const EMAIL_FOR_SIGN_IN = "emailForSignIn";
const PENDING_PASSWORD_PROFILE = "petalPalPendingPasswordProfile";

async function syncUser(user, profile = {}) {
  const idToken = await user.getIdToken(true);
  const response = await fetch(`${API_BASE_URL}/auth/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify(profile)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "Unable to start PetalPal session");

  localStorage.setItem("petalPalAccessToken", idToken);
  localStorage.setItem("petalPalCurrentUser", JSON.stringify(data.user));
  return data;
}

export async function sendPasswordlessLoginLink(email) {
  await sendSignInLinkToEmail(firebaseAuth, email, {
    url: `${window.location.origin}/finish-sign-in`,
    handleCodeInApp: true
  });
  localStorage.setItem(EMAIL_FOR_SIGN_IN, email);
}

export function isPasswordlessCallback(url = window.location.href) {
  return isSignInWithEmailLink(firebaseAuth, url);
}

export function savedPasswordlessEmail() {
  return localStorage.getItem(EMAIL_FOR_SIGN_IN) || "";
}

export async function finishPasswordlessLogin(email, url = window.location.href) {
  const credential = await signInWithEmailLink(firebaseAuth, email, url);
  localStorage.removeItem(EMAIL_FOR_SIGN_IN);
  const data = await syncUser(credential.user, { deferProfileCreation: true });
  window.history.replaceState({}, "", "/");
  return data;
}

export async function completePasswordlessProfile(profile) {
  if (!firebaseAuth.currentUser) throw new Error("Your sign-in session has expired. Request a new email link.");
  return syncUser(firebaseAuth.currentUser, profile);
}

export async function loginWithPassword(email, password) {
  const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
  if (!credential.user.emailVerified) {
    throw new Error("Verify your email before signing in with a password.");
  }
  let profile;
  try {
    profile = JSON.parse(localStorage.getItem(PENDING_PASSWORD_PROFILE)) || {};
  } catch {
    profile = {};
  }
  const data = await syncUser(credential.user, profile);
  localStorage.removeItem(PENDING_PASSWORD_PROFILE);
  return data;
}

export async function registerWithPassword(email, password, profile) {
  const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
  await updateProfile(credential.user, { displayName: profile.name });
  localStorage.setItem(PENDING_PASSWORD_PROFILE, JSON.stringify(profile));
  await sendEmailVerification(credential.user, { url: window.location.origin });
  await signOut(firebaseAuth);
}

export async function loginWithGoogle() {
  const credential = await signInWithPopup(firebaseAuth, googleProvider);
  return syncUser(credential.user);
}

export async function logoutFirebase() {
  await signOut(firebaseAuth).catch(() => {});
}
