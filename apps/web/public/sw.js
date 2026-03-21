// Service worker — enables PWA install + push notifications

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Pass-through fetch — no offline caching needed for a live dashboard
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

// ── Push notification handling ───────────────────────────────────────

self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const { title, body, tag, url, icon } = data;
    event.waitUntil(
      self.registration.showNotification(title || "Homebase", {
        body: body || "",
        tag: tag || undefined,
        icon: icon || "/icon-192.png",
        data: { url: url || "/" },
      })
    );
  } catch {
    // Fallback for plain text push
    event.waitUntil(
      self.registration.showNotification("Homebase", {
        body: event.data.text(),
        icon: "/icon-192.png",
        data: { url: "/" },
      })
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus existing window if one is open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(url);
    })
  );
});
