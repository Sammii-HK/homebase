/**
 * Returns auth headers for fetch calls from client components.
 * When token is "cookie", the hb_session cookie is sent automatically — no header needed.
 * When token is a Bearer string (legacy), send it as Authorization header.
 */
export function authHeaders(token: string): Record<string, string> {
  if (!token || token === "cookie") return {};
  return { Authorization: `Bearer ${token}` };
}
