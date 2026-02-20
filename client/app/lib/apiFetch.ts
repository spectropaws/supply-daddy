/**
 * A wrapper around fetch that automatically handles ngrok's browser warning
 * interstitial page by adding the required header for ngrok URLs.
 * Also works transparently with any other backend URL (localhost, production, etc).
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/+$/, "");

function isNgrokUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("ngrok");
  } catch {
    return url.includes("ngrok");
  }
}

export function apiFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

  if (isNgrokUrl(url)) {
    const headers = new Headers(init?.headers);
    headers.set("ngrok-skip-browser-warning", "true");
    return fetch(input, { ...init, headers });
  }

  return fetch(input, init);
}

export { API_BASE };
