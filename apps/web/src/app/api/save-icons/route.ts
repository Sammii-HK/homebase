import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  const { png512, png192 } = await req.json();

  const publicDir = path.join(process.cwd(), "public");

  const save = async (b64: string, filename: string) => {
    const data = b64.replace(/^data:image\/png;base64,/, "");
    await writeFile(path.join(publicDir, filename), Buffer.from(data, "base64"));
  };

  await Promise.all([
    save(png512, "icon-512.png"),
    save(png192, "icon-192.png"),
    save(png512, "favicon.png"),
  ]);

  // Also write favicon.ico (same as favicon.png, browsers accept PNG as ico)
  const data512 = png512.replace(/^data:image\/png;base64,/, "");
  await writeFile(path.join(publicDir, "favicon.ico"), Buffer.from(data512, "base64"));

  return NextResponse.json({ ok: true });
}
