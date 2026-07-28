/**
 * Cookie values the server can prove it issued.
 *
 * The admin section used to be gated on a cookie whose value was the literal string `"1"`.
 * `httpOnly` stops page JavaScript reading or writing a cookie, but it does nothing about an
 * attacker holding their own HTTP client, and the expected value was a constant — so
 * `curl -H 'Cookie: nebula_admin=1'` opened the whole depositor register without ever meeting the
 * password. A flag is not a credential no matter which flags are set on it.
 *
 * These helpers mint a value only the server can produce: the payload, an expiry, and an HMAC over
 * both. Forging one means finding the key.
 *
 * Web Crypto rather than `node:crypto` because `proxy.ts` runs in the Edge runtime, where the Node
 * built-in does not exist. `crypto.subtle` is present in both runtimes, so one implementation
 * covers the proxy and the server components behind it.
 */

const ENCODER = new TextEncoder();

/**
 * UTF-8 bytes as a plain `ArrayBuffer`.
 *
 * `TextEncoder.encode` is typed over `ArrayBufferLike`, which includes `SharedArrayBuffer`, and
 * Web Crypto will not accept that — so the view is copied into a buffer it will.
 */
function bytes(value: string): ArrayBuffer {
  const view = ENCODER.encode(value);
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

/**
 * Key material for every signed cookie.
 *
 * Falls back to the admin password so an existing deployment keeps working without a new variable,
 * which also means rotating the password invalidates live sessions — the behaviour you want from a
 * password change anyway. Returns null rather than a default when neither is set: with no key the
 * gate cannot mint a session or verify one, so it fails shut instead of open.
 */
function secret(): string | null {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || null;
}

async function hmac(key: string, message: string): Promise<string> {
  const imported = await crypto.subtle.importKey(
    "raw",
    bytes(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", imported, bytes(message));

  return base64url(new Uint8Array(signature));
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Compares without leaking where the strings diverged.
 *
 * A `===` on a MAC returns as soon as it finds a differing byte, so how long it took narrows down
 * the correct prefix. Remote timing over the network is a stretch, but a constant-time compare is
 * three lines and removes the question.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** `<payload>.<expiry>.<mac>`, or null when the server has no key to sign with. */
export async function sign(payload: string, ttlSeconds: number): Promise<string | null> {
  const key = secret();
  if (!key) return null;

  const expires = Date.now() + ttlSeconds * 1000;
  const body = `${encodeURIComponent(payload)}.${expires}`;

  return `${body}.${await hmac(key, body)}`;
}

/**
 * Returns the payload if the value was issued by this server and has not expired, else null.
 *
 * The expiry is inside the signed body rather than left to the cookie's `maxAge`. A browser
 * enforces `maxAge`; anything replaying a captured value does not, so the deadline has to be part
 * of what the MAC covers.
 */
export async function verify(value: string | undefined | null): Promise<string | null> {
  const key = secret();
  if (!key || !value) return null;

  const parts = value.split(".");
  if (parts.length !== 3) return null;

  const [payload, expires, mac] = parts as [string, string, string];
  const expected = await hmac(key, `${payload}.${expires}`);
  if (!safeEqual(mac, expected)) return null;

  const deadline = Number(expires);
  if (!Number.isFinite(deadline) || Date.now() > deadline) return null;

  try {
    return decodeURIComponent(payload);
  } catch {
    return null;
  }
}
