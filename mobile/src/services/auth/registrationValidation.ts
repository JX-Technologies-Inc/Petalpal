export function registrationError(email: string, password: string, confirmation: string): string {
  if (!email.trim()) return 'Enter your email address.';
  if (password.length < 6) return 'Use a password with at least 6 characters.';
  if (password !== confirmation) return 'Your passwords do not match.';
  return ''; // Firebase remains authoritative for email/password validity.
}

export interface ProfileInput {
  name: string;
  avatar?: string;
  preferredLocale?: string;
  aiConsent?: boolean;
}
export function profileError(profile: ProfileInput): string {
  if (!profile.name.trim()) return 'Enter a display name.';
  if (profile.name.trim().length > 80) return 'Use a display name with at most 80 characters.';
  return '';
}

export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === 'auth/invalid-email') return 'Enter a valid email address.';
  if (code === 'auth/weak-password') return 'Choose a stronger password and try again.';
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/user-disabled'].includes(code || '')) {
    return 'Check your email and password, then try again.';
  }
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait before trying again.';
  if (code === 'auth/network-request-failed') return 'Check your connection and try again.';
  return 'We couldn’t connect to your account. Please try again.';
}
