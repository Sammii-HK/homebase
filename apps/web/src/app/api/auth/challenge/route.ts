import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions, generateRegistrationOptions } from "@simplewebauthn/server";
import { storeChallenge } from "@/lib/challenge-store";

export const dynamic = "force-dynamic";

const rpID = process.env.HOMEBASE_RPID ?? "homebase.sammii.dev";
const rpName = "Homebase";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") ?? "authentication";

  if (type === "registration") {
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: "sammii",
      userDisplayName: "Sammii",
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    const clientId = crypto.randomUUID();
    storeChallenge(clientId, options.challenge);

    return NextResponse.json({ ...options, _clientId: clientId });
  }

  // Authentication challenge
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
  });

  const clientId = crypto.randomUUID();
  storeChallenge(clientId, options.challenge);

  return NextResponse.json({ ...options, _clientId: clientId });
}
