// In-memory challenge store — 60s TTL
const challenges = new Map<string, { challenge: string; expires: number }>();

function pruneExpired() {
  const now = Date.now();
  for (const [key, val] of challenges.entries()) {
    if (val.expires < now) challenges.delete(key);
  }
}

export function storeChallenge(clientId: string, challenge: string): void {
  pruneExpired();
  challenges.set(clientId, {
    challenge,
    expires: Date.now() + 60_000,
  });
}

/** Retrieve and consume a challenge (one-time use) */
export function consumeChallenge(clientId: string): string | null {
  pruneExpired();
  const entry = challenges.get(clientId);
  if (!entry || entry.expires < Date.now()) return null;
  challenges.delete(clientId);
  return entry.challenge;
}
