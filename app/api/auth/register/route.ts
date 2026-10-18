import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPin } from "@/lib/auth/pin";
import { allowAuthRequest } from "@/lib/auth/throttle";
import { devOnly, rejectWrongOrigin, jsonRequired, parseJsonObject, fail } from "@/lib/api-helpers";

export async function POST(request: NextRequest) {
  const guard = devOnly() || rejectWrongOrigin(request) || jsonRequired(request);
  if (guard) return guard;
  const body = await parseJsonObject(request);
  if (!body) return fail("Invalid request body.");
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const pin = typeof body.pin === "string" ? body.pin : "";
  const confirmPin = typeof body.confirmPin === "string" ? body.confirmPin : "";
  if (name.length < 2 || name.length > 60) return fail("Name must have 2–60 characters.");
  if (!/^[a-z0-9_]{3,20}$/.test(username)) return fail("Invalid username.");
  if (!/^\d{4}$/.test(pin) || pin !== confirmPin) return fail("PIN must be four digits and match confirmation.");
  try {
    // No invite code is required. Public sign-up is throttled by IP in the database.
    if (!await allowAuthRequest(request, "register"))
      return fail("Too many account requests. Please try later.", 429);
    const db = createAdminClient();
    const pinHash = await hashPin(pin);
    const { data: account, error: accountError } = await db.from("accounts")
      .insert({ display_name: name, username }).select("id").single();
    if (accountError?.code === "23505") return fail("Username is already taken.", 409);
    if (accountError || !account) throw accountError ?? new Error("No account result");
    const { error: credError } = await db.from("pin_credentials")
      .insert({ user_id: account.id, pin_hash: pinHash, password_hash: null });
    if (credError) {
      const { error: cleanup } = await db.from("accounts").delete().eq("id", account.id);
      if (cleanup) console.error("YOLO registration cleanup", cleanup);
      throw credError;
    }
    return NextResponse.json({ success: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("YOLO registration", error);
    return fail("Unable to create account right now.", 500);
  }
}
