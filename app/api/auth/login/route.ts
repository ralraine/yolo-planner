import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPin } from "@/lib/auth/pin";
import { allowAuthRequest } from "@/lib/auth/throttle";
import { devOnly, rejectWrongOrigin, jsonRequired, parseJsonObject, fail } from "@/lib/api-helpers";

const SESSION_DAYS = 7;
export async function POST(request: NextRequest) {
  const guard = devOnly() || rejectWrongOrigin(request) || jsonRequired(request);
  if (guard) return guard;
  const body = await parseJsonObject(request);
  if (!body) return fail("Invalid request body.");
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const pin = typeof body.pin === "string" ? body.pin : "";
  if (!/^[a-z0-9_]{3,20}$/.test(username) || !/^\d{4}$/.test(pin))
    return fail("Invalid username or passcode.", 401);
  try {
    if (!await allowAuthRequest(request, "login"))
      return fail("Too many attempts. Please try again later.", 429);
    const db = createAdminClient();
    const { data: account, error: accountError } = await db.from("accounts")
      .select("id").eq("username", username).maybeSingle();
    if (accountError) throw accountError;
    if (!account) return fail("Invalid username or passcode.", 401);
    const { data: cred, error: credError } = await db.from("pin_credentials")
      .select("pin_hash, locked_until").eq("user_id", account.id).maybeSingle();
    if (credError) throw credError;
    if (!cred?.pin_hash) return fail("Invalid username or passcode.", 401);
    const now = Date.now();
    if (cred.locked_until && Date.parse(cred.locked_until) > now)
      return fail("Too many attempts. Try again later.", 429);
    const valid = await verifyPin(pin, cred.pin_hash);
    // Atomic, per-account failed PIN accounting (from YOLO V5.3 migration).
    const { data: verdict, error: attemptError } = await db.rpc("yolo_record_pin_attempt", {
      p_user_id: account.id, p_valid: valid,
    });
    if (attemptError) throw attemptError;
    if (verdict?.locked) return fail("Too many attempts. Try again later.", 429);
    if (!verdict?.ok) return fail("Invalid username or passcode.", 401);
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const { error: sessionError } = await db.from("sessions").insert({
      user_id: account.id, token_hash: tokenHash,
      expires_at: new Date(now + SESSION_DAYS * 86_400_000).toISOString(),
    });
    if (sessionError) throw sessionError;
    const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set("daybloom_session", token, {
      httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:",
      path: "/", maxAge: SESSION_DAYS * 86_400,
    });
    return response;
  } catch (error) {
    console.error("YOLO login", error);
    return fail("Unable to sign in right now.", 500);
  }
}
