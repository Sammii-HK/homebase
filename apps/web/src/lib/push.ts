export async function registerPush(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  const reg = await navigator.serviceWorker.register("/sw.js");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  const existing = await reg.pushManager.getSubscription();
  // applicationServerKey accepts a base64url string directly in all modern browsers
  const vapidKey = await getVapidKey();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKey,
    }));

  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub }),
  });
}

async function getVapidKey(): Promise<string> {
  const res = await fetch("/api/push/vapid-key");
  const { publicKey } = (await res.json()) as { publicKey: string };
  return publicKey;
}
