import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPin } from "@/lib/auth/pin";
import { devOnly, rejectWrongOrigin, jsonRequired, parseJsonObject, fail } from "@/lib/api-helpers";

const SESSION_DAYS = 7;

export async function POST(request: NextRequest) {
  const guard = devOnly() || rejectWrongOrigin(request) || jsonRequired(request);
  if (guard) return guard;
  const body = await parseJsonObject(request);
  if (!body) return fail("Invalid request body.");
  const username = typeof body.username === "string" ? body.username.toLowerCase().trim() : "";
  const pin = typeof body.pin === "string" ? body.pin : "";
  if (!/^[a-z0-9_]{3,20}$/.test(username) || !/^\d{4}$/.test(pin)) {
    return fail("Invalid username or passcode.", 401);
  }
  try {
    const supabase = createAdminClient();
    const { data: account, error: accountError } = await supabase.from("accounts")
      .select("id").eq("username", username).maybeSingle();
    if (accountError) throw accountError;
    if (!account) return fail("Invalid username or passcode.", 401);
    const { data: cred, error: credError } = await supabase.from("pin_credentials")
      .select("pin_hash, failed_attempts, locked_until")
      .eq("user_id", account.id).maybeSingle();
    if (credError) throw credError;
    if (!cred) return fail("Invalid username or passcode.", 401);
    const now = Date.now();
    const lockUntil = cred.locked_until ? Date.parse(cred.locked_until) : 0;
    if (lockUntil > now) return fail("Too many attempts. Try again in 15 minutes.", 429);
    const isCorrect = await verifyPin(pin, cred.pin_hash);
    // PostgreSQL row lock makes simultaneous PIN-attempt updates atomic.
    const { data: verdict, error: attemptError } = await supabase.rpc("yolo_record_pin_attempt", {
      p_user_id: account.id, p_valid: isCorrect,
    });
    if (attemptError) throw attemptError;
    if (verdict?.locked) return fail("Too many attempts. Try again in 15 minutes.", 429);
    if (!verdict?.ok) return fail("Invalid username or passcode.", 401);
    // Session token is created only after an atomic successful attempt.
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const { error: sessionError } = await supabase.from("sessions").insert({
      user_id: account.id,
      token_hash: tokenHash,
      expires_at: new Date(now + SESSION_DAYS * 86_400_000).toISOString(),
    });
    if (sessionError) throw sessionError;
    const response = NextResponse.json({ success: true });
    response.cookies.set("daybloom_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: SESSION_DAYS * 86_400,
    });
    return response;
  } catch (err) {
    console.error("Login:", err);
    return fail("Unable to sign in right now.", 500);
  }
}
