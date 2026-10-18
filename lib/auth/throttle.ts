import "server-only";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Server-side, database-backed per-IP throttle. Do not use client-controllable x-forwarded-for
 * when deployed behind an arbitrary proxy; Vercel overwrites the header at its edge.
 * An absent or malformed IP fails closed in production.
 */
export async function allowAuthRequest(
  req: NextRequest,
  action: "login" | "register" | "recover",
): Promise<boolean> {
  if (process.env.NODE_ENV === "development") return true;
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  if (!isIP(forwarded)) return false;
  const pepper = process.env.DAYBLOOM_PIN_PEPPER;
  if (!pepper || pepper.length < 32) return false;
  const key = createHash("sha256").update(`${pepper}:yolo-throttle:v1:${action}:${forwarded}`).digest("hex");
  const limits = action === "login"
    ? { p_limit: 12, p_window_seconds: 900, p_block_seconds: 1800 }
    : action === "register"
      ? { p_limit: 3, p_window_seconds: 3600, p_block_seconds: 3600 }
      : { p_limit: 5, p_window_seconds: 3600, p_block_seconds: 3600 };
  // If the SQL throttle has not been installed, deny public login/sign-up instead of bypassing it.
  const { data, error } = await createAdminClient().rpc("yolo_auth_request_allowed", {
    p_key: key, ...limits,
  });
  if (error) throw error;
  return data === true;
}
