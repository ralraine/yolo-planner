import "server-only";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const HASH_PATTERN = /^scrypt:password:v1:([0-9a-f]{32}):([0-9a-f]{128})$/;

function secret() {
  const pepper = process.env.DAYBLOOM_PIN_PEPPER;
  if (!pepper || pepper.length < 32) throw new Error("Missing server credential secret");
  return pepper;
}

export function validPassword(password: unknown): password is string {
  return typeof password === "string" && password.length >= 12 &&
    password.length <= 128 && Buffer.byteLength(password, "utf8") <= 512;
}

export async function hashPassword(password: string): Promise<string> {
  if (!validPassword(password)) throw new Error("Password must contain 12–128 characters");
  const salt = randomBytes(16);
  const hash = (await scrypt(`YOLO-password-v1:${secret()}:${password}`, salt, 64)) as Buffer;
  return `scrypt:password:v1:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const match = HASH_PATTERN.exec(stored);
  if (!match || !validPassword(password)) return false;
  const existing = Buffer.from(match[2], "hex");
  const candidate = (await scrypt(`YOLO-password-v1:${secret()}:${password}`, Buffer.from(match[1], "hex"), 64)) as Buffer;
  return timingSafeEqual(existing, candidate);
}
