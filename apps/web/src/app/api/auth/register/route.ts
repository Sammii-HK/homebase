import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { consumeChallenge } from "@/lib/challenge-store";
import { saveCredential, hasCredential } from "@/lib/passkey-store";

export const dynamic = "force-dynamic";

const rpID = process.env.HOMEBASE_RPID ?? "homebase.sammii.dev";
const SECRET = process.env.HOMEBASE_SECRET ?? "";

function getOrigin(): string[] {
  const origins = [`https://${rpID}`];
  // Allow localhost for dev
  if (rpID === "homebase.sammii.dev") {
    origins.push("http://localhost:3005", "http://localhost:3000");
  } else {
    origins.push(`http://${rpID}:3005`);
  }
  return origins;
}

export async function POST(req: NextRequest) {
  // Require HOMEBASE_SECRET to register — prevents anyone from hijacking the dashboard
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!SECRET || token !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Block re-registration if a credential already exists (must delete passkey.json to reset)
  const alreadyRegistered = await hasCredential();
  if (alreadyRegistered) {
    return NextResponse.json({ error: "Already registered" }, { status: 409 });
  }

  try {
    const body = (await req.json()) as RegistrationResponseJSON & { _clientId?: string };
    const clientId = body._clientId;
    if (!clientId) {
      return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
    }

    const expectedChallenge = consumeChallenge(clientId);
    if (!expectedChallenge) {
      return NextResponse.json({ error: "Challenge expired or not found" }, { status: 400 });
    }

    const origins = getOrigin();

    // Try each origin until one succeeds
    let verification = null;
    let lastError: unknown = null;
    for (const expectedOrigin of origins) {
      try {
        verification = await verifyRegistrationResponse({
          response: body,
          expectedChallenge,
          expectedOrigin,
          expectedRPID: rpID,
        });
        if (verification.verified) break;
      } catch (e) {
        lastError = e;
      }
    }

    if (!verification?.verified || !verification.registrationInfo) {
      console.error("[passkey] registration verification failed:", lastError);
      return NextResponse.json({ error: "Verification failed" }, { status: 400 });
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    await saveCredential({
      credentialID: credential.id,
      credentialPublicKey: Buffer.from(credential.publicKey).toString("base64"),
      counter: credential.counter,
      credentialDeviceType,
      credentialBackedUp,
      transports: body.response?.transports ?? [],
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[passkey] register error:", e);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
