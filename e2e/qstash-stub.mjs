// e2e/qstash-stub.mjs
// Minimal local stand-in for QStash publish/delete used by the e2e suite.
// Accepts delayed publishes, returns message ids, and delivers them to the
// app after the delay with a correctly signed Upstash JWT so the app's
// signature verification passes. Also serves a fake HTTPS push endpoint so
// web-push delivery succeeds end to end (test-only localhost TLS).
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { readFileSync } from "node:fs";
import { createHmac, createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.QSTASH_STUB_PORT ?? 3210);
const PUSH_PORT = Number(process.env.QSTASH_STUB_PUSH_PORT ?? 3220);
const SIGNING_KEY = process.env.QSTASH_STUB_SIGNING_KEY ?? "e2e-current-key";

const received = [];

let counter = 0;

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function signJwt(bodyBytes) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const hash = createHash("sha256").update(bodyBytes).digest();
  const bodyB64 = hash.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const payload = base64url(
    JSON.stringify({
      iss: "Upstash",
      sub: "stub",
      body: bodyB64,
      iat: Math.floor(Date.now() / 1000),
    })
  );
  const signature = createHmac("sha256", SIGNING_KEY).update(`${header}.${payload}`).digest();
  const sigB64 = signature.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${header}.${payload}.${sigB64}`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseDelaySeconds(value) {
  if (!value) return 0;
  const match = /^(\d+)(s|m|h|d)?$/.exec(value.trim());
  if (!match) return 0;
  const n = Number(match[1]);
  const mult = { s: 1, m: 60, h: 3600, d: 86400 }[match[2] ?? "s"] ?? 1;
  return n * mult;
}

const server = createHttpServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://stub");
    if (req.method === "POST" && url.pathname.startsWith("/v2/publish/")) {
      const destination = url.pathname.slice("/v2/publish/".length);
      const body = await readBody(req);
      const delayHeader = req.headers["upstash-delay"];
      const delaySeconds = parseDelaySeconds(Array.isArray(delayHeader) ? delayHeader[0] : delayHeader);
      const messageId = `stub-${++counter}`;
      // Fire and forget: deliver after the delay like QStash would.
      setTimeout(() => {
        fetch(destination, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Upstash-Signature": signJwt(body),
            "Upstash-Message-Id": messageId,
          },
          body,
        }).catch(() => {});
      }, Math.min(delaySeconds, 120) * 1000).unref?.();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ messageId }));
      return;
    }
    if (req.method === "DELETE" && url.pathname.startsWith("/v2/messages/")) {
      await readBody(req);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ cancelled: true }));
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  } catch {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "stub failed" }));
  }
});

server.listen(PORT, () => {
  console.log(`qstash stub on :${PORT}`);
});

// Fake HTTPS push endpoint: web-push only speaks https. Accepts the
// encrypted push and answers 201 so delivery counts as sent.
const stubDir = path.dirname(fileURLToPath(import.meta.url));
const pushServer = createHttpsServer(
  {
    key: readFileSync(path.join(stubDir, "localhost-key.pem")),
    cert: readFileSync(path.join(stubDir, "localhost-cert.pem")),
  },
  async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "https://stub");
      if (req.method === "POST" && url.pathname.startsWith("/fake-push")) {
        const body = await readBody(req);
        received.push({ headers: req.headers, bytes: body.length });
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
    } catch {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "stub failed" }));
    }
  }
);

pushServer.listen(PUSH_PORT, () => {
  console.log(`fake push on :${PUSH_PORT}`);
});
