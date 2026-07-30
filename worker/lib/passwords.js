const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value) {
  const base64 = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function randomToken(bytes = 24) {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256(value) {
  return toBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(String(value)))));
}

async function legacyPasswordHash(password, salt) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(String(password)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 120000 },
    material,
    256
  );
  return { salt, hash: toBase64Url(new Uint8Array(bits)) };
}

export async function hashPassword(password, salt = randomToken(16), secret = "") {
  if (!secret) return legacyPasswordHash(password, salt);
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(String(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${salt}:${String(password)}`)
  );
  return { salt, hash: `h1_${toBase64Url(new Uint8Array(signature))}` };
}

export async function verifyPassword(password, salt, expectedHash, secret = "") {
  const expected = String(expectedHash || "");
  const result = expected.startsWith("h1_")
    ? await hashPassword(password, salt, secret)
    : await legacyPasswordHash(password, salt);
  return constantTimeEqual(result.hash, expected);
}

async function encryptionKey(secret) {
  if (!secret) throw new Error("Share password key is not configured");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(String(secret)));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptPassword(password, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(secret),
    encoder.encode(String(password))
  );
  return `e1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(encrypted))}`;
}

export async function decryptPassword(ciphertext, secret) {
  const [version, ivValue, encryptedValue] = String(ciphertext || "").split(".");
  if (version !== "e1" || !ivValue || !encryptedValue) return "";
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(ivValue) },
    await encryptionKey(secret),
    fromBase64Url(encryptedValue)
  );
  return decoder.decode(decrypted);
}
