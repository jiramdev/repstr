import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import { NetworkFirst, NetworkOnly, Serwist } from "serwist";

interface PushEventLike {
  data: {
    json(): Record<string, unknown>;
    text(): string;
  } | null;
  waitUntil(done: Promise<unknown>): void;
}

interface NotificationClickEventLike {
  notification: { close(): void; data?: { url?: string } };
  waitUntil(done: Promise<unknown>): void;
}

interface WindowClientLike {
  url: string;
  focus(): Promise<unknown>;
  postMessage(message: unknown): void;
}

interface PushSubscriptionLike {
  endpoint: string;
  toJSON(): { endpoint?: string | null; keys?: { p256dh?: string; auth?: string } | null };
}

declare const self: SerwistGlobalConfig & {
  __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  registration: {
    showNotification(title: string, options?: Record<string, unknown>): Promise<void>;
    pushManager: {
      subscribe(options?: Record<string, unknown>): Promise<PushSubscriptionLike>;
    };
  };
  location: { origin: string };
  clients: {
    matchAll(options?: Record<string, unknown>): Promise<WindowClientLike[]>;
    openWindow?: (url: string) => Promise<unknown>;
  };
  addEventListener(type: "push", listener: (event: PushEventLike) => void): void;
  addEventListener(type: "notificationclick", listener: (event: NotificationClickEventLike) => void): void;
  addEventListener(
    type: "pushsubscriptionchange",
    listener: (event: { waitUntil(done: Promise<unknown>): void }) => void
  ): void;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url }) =>
        url.pathname.startsWith("/api/") ||
        url.pathname === "/login" ||
        url.pathname === "/register" ||
        url.pathname.startsWith("/onboarding"),
      handler: new NetworkOnly(),
    } satisfies RuntimeCaching,
    {
      // Dynamic, authenticated documents must never serve stale: try the
      // network first, fall back to cache only when fully offline.
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({ cacheName: "repiq-pages", networkTimeoutSeconds: 3 }),
    } satisfies RuntimeCaching,
  ],
});

serwist.addEventListeners();

self.addEventListener("push", (event) => {
  let data = {
    title: "Rest over ⚡️",
    body: "Time for your next set!",
    url: "/workout/active",
    tag: "rest-over",
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body || "Time for the next set!",
      icon: "/icon.png",
      badge: "/icon.png",
      tag: typeof data.tag === "string" && data.tag ? data.tag : "repiq",
      renotify: (data as { renotify?: unknown }).renotify === true,
      vibrate: [300, 150, 300],
      data: {
        url: data.url || "/workout/active",
      },
    })
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const keyResponse = await fetch("/api/push-key");
      if (!keyResponse.ok) return;
      const { publicKey } = (await keyResponse.json()) as { publicKey?: unknown };
      if (typeof publicKey !== "string" || !publicKey) return;
      const subscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return;
      await fetch("/api/push-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: {
            endpoint: json.endpoint,
            keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          },
        }),
      });
    })().catch(() => {})
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data?.url || "/workout/active";
  let path = "/workout/active";
  try {
    const target = new URL(raw, self.location.origin);
    if (target.origin === self.location.origin) path = target.pathname + target.search;
  } catch {
    path = "/workout/active";
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (!client.url.startsWith(self.location.origin)) continue;
          client.postMessage({ type: "repiq-open", url: path });
          return client.focus();
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(new URL(path, self.location.origin).href);
        }
      })
  );
});
