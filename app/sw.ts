import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist, StaleWhileRevalidate } from "serwist";

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

declare const self: SerwistGlobalConfig & {
  __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  registration: {
    showNotification(title: string, options?: Record<string, unknown>): Promise<void>;
  };
  location: { origin: string };
  clients: {
    matchAll(options?: Record<string, unknown>): Promise<WindowClientLike[]>;
    openWindow?: (url: string) => Promise<unknown>;
  };
  addEventListener(type: "push", listener: (event: PushEventLike) => void): void;
  addEventListener(type: "notificationclick", listener: (event: NotificationClickEventLike) => void): void;
};

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
      matcher: ({ request }) => request.mode === "navigate",
      handler: new StaleWhileRevalidate({ cacheName: "repiq-pages" }),
    } satisfies RuntimeCaching,
  ],
});

serwist.addEventListeners();

self.addEventListener("push", (event) => {
  let data = {
    title: "Rust voorbij ⚡️",
    body: "Tijd voor je volgende set!",
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
      body: data.body || "Tijd voor de volgende set!",
      icon: "/icon.png",
      badge: "/icon.png",
      tag: typeof data.tag === "string" && data.tag ? data.tag : "repiq",
      vibrate: [300, 150, 300],
      data: {
        url: data.url || "/workout/active",
      },
    })
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
