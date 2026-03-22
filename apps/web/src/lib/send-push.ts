// Server-side push notification helper — sends via /api/push/send

export async function sendPush(title: string, body: string, url = "/"): Promise<void> {
  const secret = process.env.HOMEBASE_SECRET;
  const port = process.env.PORT ?? "3005";
  try {
    await fetch(`http://localhost:${port}/api/push/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({ title, body, url }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Best effort — don't fail the cron job if push fails
  }
}
