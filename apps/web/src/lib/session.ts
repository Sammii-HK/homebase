import { SignJWT, jwtVerify } from "jose";

function getSecret(): Uint8Array {
  const secret = process.env.HOMEBASE_SECRET;
  if (!secret) {
    // Fallback for local dev without a secret set
    return new TextEncoder().encode("homebase-dev-secret-do-not-use-in-production");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(): Promise<string> {
  const secret = getSecret();
  return new SignJWT({ sub: "sammii" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySession(token: string): Promise<boolean> {
  try {
    const secret = getSecret();
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}
