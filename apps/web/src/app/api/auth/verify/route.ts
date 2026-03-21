import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { consumeChallenge } from "@/lib/challenge-store";
import { loadCredential, updateCredentialCounter } from "@/lib/passkey-store";
import { signSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const rpID = process.env.HOMEBASE_RPID ?? "homebase.sammii.dev";

function getOrigins(): string[] {
  const origins = [`https://${rpID}`];
  if (rpID === "homebase.sammii.dev") {
    origins.push("http://localhost:3005", "http://localhost:3000");
  } else {
    origins.push(`http://${rpID}:3005`);
  }
  return origins;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AuthenticationResponseJSON & { _clientId?: string };
    const clientId = body._clientId;
    if (!clientId) {
      return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
    }

    const expectedChallenge = consumeChallenge(clientId);
    if (!expectedChallenge) {
      return NextResponse.json({ error: "Challenge expired or not found" }, { status: 400 });
    }

    const credential = await loadCredential();
    if (!credential) {
      return NextResponse.json({ error: "No passkey registered" }, { status: 400 });
    }

    const origins = getOrigins();

    let verification = null;
    let lastError: unknown = null;

    for (const expectedOrigin of origins) {
      try {
        verification = await verifyAuthenticationResponse({
          response: body,
          expectedChallenge,
          expectedOrigin,
          expectedRPID: rpID,
          credential: {
            id: credential.credentialID,
            publicKey: Buffer.from(credential.credentialPublicKey, "base64"),
            counter: credential.counter,
            transports: credential.transports as AuthenticatorTransport[],
          },
        });
        if (verification.verified) break;
      } catch (e) {
        lastError = e;
      }
    }

    if (!verification?.verified) {
      console.error("[passkey] auth verification failed:", lastError);
      return NextResponse.json({ error: "Verification failed" }, { status: 401 });
    }

    // Update counter
    await updateCredentialCounter(verification.authenticationInfo.newCounter);

    // Issue session cookie
    const token = await signSession();
    const res = NextResponse.json({ ok: true });
    res.cookies.set("hb_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return res;
  } catch (e) {
    console.error("[passkey] verify error:", e);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
