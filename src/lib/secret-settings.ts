import crypto from "node:crypto";

const PREFIX = "enc:v1:";
const SECRET_KEYS = new Set(["hubtel_client_secret", "sms_client_secret", "smtp_pass"]);

export function isSecretSetting(key: string): boolean {
  return SECRET_KEYS.has(key);
}

export function secretEncryptionReady(): boolean {
  try { getKey(); return true; } catch { return false; }
}

function getKey(): Buffer {
  const raw = process.env.SHILOH_SETTINGS_ENCRYPTION_KEY || "";
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32 || !raw) {
    throw new Error("SHILOH_SETTINGS_ENCRYPTION_KEY must be a base64 encoded 32-byte key");
  }
  return key;
}

export function encryptSettingSecret(value: string): string {
  if (!value) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return PREFIX + [iv, cipher.getAuthTag(), encrypted].map((b) => b.toString("base64url")).join(".");
}

export function decryptSettingSecret(value: string): string {
  if (!value) return "";
  if (!value.startsWith(PREFIX)) {
    // Compatibility with legacy installations: encrypt on next credential
    // update, or run scripts/encrypt-legacy-secrets.ts during migration.
    return value;
  }
  const parts = value.slice(PREFIX.length).split(".");
  if (parts.length !== 3) throw new Error("Invalid encrypted setting format");
  const [iv, tag, ciphertext] = parts.map((x) => Buffer.from(x, "base64url"));
  if (iv.length !== 12 || tag.length !== 16) throw new Error("Invalid encrypted setting metadata");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
