import type { Env, UserTradingAccountSecretPayload } from "./types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function encryptUserTradingPayload(env: Env, payload: UserTradingAccountSecretPayload): Promise<string> {
  const key = await deriveAesKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return JSON.stringify({
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  });
}

export async function decryptUserTradingPayload(env: Env, encryptedPayload: string): Promise<UserTradingAccountSecretPayload> {
  const key = await deriveAesKey(env);
  const parsed = JSON.parse(encryptedPayload) as { iv: string; ciphertext: string };
  const iv = base64ToBytes(parsed.iv);
  const ciphertext = base64ToBytes(parsed.ciphertext);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return JSON.parse(decoder.decode(plaintext)) as UserTradingAccountSecretPayload;
}

async function deriveAesKey(env: Env): Promise<CryptoKey> {
  if (!env.USER_ACCOUNT_ENCRYPTION_SECRET?.trim()) {
    throw new Error("USER_ACCOUNT_ENCRYPTION_SECRET is required for per-user trading account storage");
  }
  const material = await crypto.subtle.digest("SHA-256", encoder.encode(env.USER_ACCOUNT_ENCRYPTION_SECRET.trim()));
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function bytesToBase64(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const output = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) output[i] = binary.charCodeAt(i);
  return output;
}
