export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "";

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem(
    "petalPalAccessToken"
  );

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

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
      `Request failed with status ${response.status}`
    );
  }

  return data;
}
