import "server-only";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);

function pepper() {
  const key = process.env.DAYBLOOM_PIN_PEPPER;
  if (!key || key.length < 32) throw new Error("Missing PIN server protection secret");
  return key;
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scrypt(`${pepper()}:${pin}`, salt, 64)) as Buffer;
  return `scrypt:v1:${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [kind, version, saltHex, hashHex] = stored.split(":");
  if (kind !== "scrypt" || version !== "v1" || !/^[0-9a-f]{32}$/i.test(saltHex ?? "") || !/^[0-9a-f]{128}$/i.test(hashHex ?? "")) {
    throw new Error("Invalid stored PIN hash");
  }
  const existing = Buffer.from(hashHex, "hex");
  const candidate = (await scrypt(`${pepper()}:${pin}`, Buffer.from(saltHex, "hex"), 64)) as Buffer;
  return timingSafeEqual(candidate, existing);
}
