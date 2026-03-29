// End-to-end encryption utilities for TermiChat
// Uses Web Crypto API (browser-native) — no npm packages needed
//
// How it works:
// 1. Both users know the room code (e.g., "abc12")
// 2. deriveKey("abc12") -> both users independently get the same secret key
// 3. encrypt("hello", key) -> locked message (gibberish)
// 4. The server relays gibberish — it can't read the messages
// 5. decrypt(gibberish, iv, key) -> "hello" again

// Fixed salt for PBKDF2 — same room code always produces the same key
// This is needed so both users derive the identical key without sharing anything
const SALT_STRING = process.env.SALT_KEY!;

// Convert a string to Uint8Array
function encode(text: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>;
}

// Convert Uint8Array to base64 string
function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

// Convert base64 string back to Uint8Array
function fromBase64(base64: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
}

// Step 1: Turn a room code into a secret key
// Both users call this with the same room code and get the same key
export async function deriveKey(roomId: string): Promise<CryptoKey> {
  // Import the room code as raw key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encode(roomId),
    "PBKDF2",
    false, // not extractable — key can't be stolen from the CryptoKey
    ["deriveKey"]
  );

  // Run PBKDF2: 100,000 rounds of SHA-256 to turn room code into AES-256 key
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encode(SALT_STRING),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 }, // output: AES-256-GCM key
    false, // not extractable
    ["encrypt", "decrypt"]
  );

  return key;
}

// Step 2: Lock a message before sending
// Takes plaintext -> returns gibberish (ciphertext) + a random number (IV)
export async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  // Generate a random 12-byte IV for this message
  // Every message gets a unique IV so identical messages produce different gibberish
  const iv = crypto.getRandomValues(new Uint8Array(12)) as Uint8Array<ArrayBuffer>;

  // Encrypt the plaintext with AES-256-GCM
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encode(plaintext)
  );

  return {
    ciphertext: toBase64(new Uint8Array(encrypted)),
    iv: toBase64(iv),
  };
}

// Step 3: Unlock a received message
// Takes gibberish (ciphertext) + random number (IV) -> returns original plaintext
export async function decrypt(
  ciphertext: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(iv) },
    key,
    fromBase64(ciphertext)
  );

  return new TextDecoder().decode(decrypted);
}
