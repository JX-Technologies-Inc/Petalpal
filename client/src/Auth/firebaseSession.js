import {
  createUserWithEmailAndPassword,
  isSignInWithEmailLink,
  sendEmailVerification,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPopup,
  signOut
} from "firebase/auth";
import { API_BASE_URL } from "../api";
import { firebaseAuth, googleProvider } from "../firebase";

const EMAIL_FOR_SIGN_IN = "emailForSignIn";
const PENDING_PASSWORD_PROFILE = "petalPalPendingPasswordProfile";

async function syncUser(user, profile = {}, refreshedIdToken) {
  const idToken = refreshedIdToken || await user.getIdToken(true);
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
  const data = await syncUser(credential.user, { deferProfileCreation: true });
  localStorage.removeItem(PENDING_PASSWORD_PROFILE);
  return { ...data, email: credential.user.email, authMethod: "password" };
}

export async function registerWithPassword(email, password) {
  const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
  const registrationEmail = credential.user.email || email;
  localStorage.setItem(PENDING_PASSWORD_PROFILE, JSON.stringify({ email: registrationEmail }));
  await sendEmailVerification(credential.user, { url: window.location.origin });
  return credential.user;
}

export async function resendRegistrationVerificationEmail() {
  await firebaseAuth.authStateReady();
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error("Your registration session is unavailable. Log in with your PetalPal password to continue.");
  await user.reload();
  if (user.emailVerified) return;
  await sendEmailVerification(user, { url: window.location.origin });
}

export function pendingPasswordRegistration() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_PASSWORD_PROFILE)) || null;
  } catch {
    return null;
  }
}

export function clearPendingPasswordRegistration() {
  localStorage.removeItem(PENDING_PASSWORD_PROFILE);
}

export async function restorePendingPasswordRegistration() {
  const pending = pendingPasswordRegistration();
  if (!pending) return null;
  await firebaseAuth.authStateReady();
  const user = firebaseAuth.currentUser;
  if (!user) {
    clearPendingPasswordRegistration();
    return null;
  }
  const email = user.email || pending.email || "";
  if (email !== pending.email) {
    localStorage.setItem(PENDING_PASSWORD_PROFILE, JSON.stringify({ ...pending, email }));
  }
  return { email };
}

export async function recoverPendingRegistrationEmail() {
  await firebaseAuth.authStateReady();
  const email = firebaseAuth.currentUser?.email || "";
  if (!email) return "";
  const profile = pendingPasswordRegistration();
  if (profile && !profile.email) {
    localStorage.setItem(PENDING_PASSWORD_PROFILE, JSON.stringify({ ...profile, email }));
  }
  return email;
}

export async function completeVerifiedRegistration() {
  await firebaseAuth.authStateReady();
  if (!firebaseAuth.currentUser) {
    throw new Error("Your registration session is unavailable. Log in with your PetalPal password after verifying your email.");
  }
  await firebaseAuth.currentUser.reload();
  const refreshedUser = firebaseAuth.currentUser;
  if (!refreshedUser) {
    throw new Error("Your registration session is unavailable. Log in with your PetalPal password after verifying your email.");
  }
  if (!refreshedUser.emailVerified) {
    throw new Error("Email is not verified yet.");
  }
  const refreshedIdToken = await refreshedUser.getIdToken(true);
  const data = await syncUser(refreshedUser, { deferProfileCreation: true }, refreshedIdToken);
  localStorage.removeItem(PENDING_PASSWORD_PROFILE);
  return { ...data, email: refreshedUser.email, authMethod: "password" };
}

export async function loginWithGoogle() {
  const credential = await signInWithPopup(firebaseAuth, googleProvider);
  return syncUser(credential.user);
}

export async function logoutFirebase() {
  await signOut(firebaseAuth).catch(() => {});
}
