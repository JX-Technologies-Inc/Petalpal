export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "";

export async function apiRequest(path, options = {}) {
  await firebaseAuth.authStateReady();
  const token = firebaseAuth.currentUser
    ? await firebaseAuth.currentUser.getIdToken()
    : localStorage.getItem("petalPalAccessToken");

  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token
          ? { Authorization: `Bearer ${token}` }
          : {}),
        ...(options.headers || {})
      }
    }
  );

  const data = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    const error = new Error(
      data?.error ||
      `Request failed with status ${response.status}`
    );

    error.status = response.status;

    if (response.status === 401) {
      localStorage.removeItem("petalPalAccessToken");
      localStorage.removeItem("petalPalCurrentUser");
      window.dispatchEvent(new Event("petalpal:unauthorized"));
    }

    throw error;
  }

  return data;
}
import { firebaseAuth } from "./firebase";
