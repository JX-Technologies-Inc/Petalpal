// Public feedback must not echo provider diagnostics or confirm an account.
export function authErrorMessage(error) {
  const code = error?.code;
  if (code === "auth/invalid-email") return "Enter a valid email address.";
  if (code === "auth/weak-password") return "Choose a stronger password and try again.";
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/user-disabled"].includes(code)) {
    return "Check your email and password, then try again.";
  }
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait before trying again.";
  if (code === "auth/network-request-failed") return "Check your connection and try again.";
  return "We couldn’t connect to your account. Please try again.";
}
