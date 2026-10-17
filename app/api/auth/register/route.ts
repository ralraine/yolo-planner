import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPin } from "@/lib/auth/pin";
import { devOnly, rejectWrongOrigin, jsonRequired, parseJsonObject, fail } from "@/lib/api-helpers";

export async function POST(request: NextRequest) {
  const guard = devOnly() || rejectWrongOrigin(request) || jsonRequired(request);
  if (guard) return guard;
  const body = await parseJsonObject(request);
  if (!body) return fail("Invalid request body.");
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const username = typeof body.username === "string" ? body.username.toLowerCase().trim() : "";
  const pin = typeof body.pin === "string" ? body.pin : "";
  const confirm = typeof body.confirmPin === "string" ? body.confirmPin : "";
  if (name.length < 2 || name.length > 60) return fail("Name must be 2–60 characters.");
  if (!/^[a-z0-9_]{3,20}$/.test(username)) return fail("Invalid username.");
  if (!/^\d{4}$/.test(pin) || pin !== confirm) return fail("PIN must be four digits and match confirmation.");

  try {
    const supabase = createAdminClient();
    const pinHash = await hashPin(pin);
    const { data, error } = await supabase.from("accounts")
      .insert({ display_name: name, username }).select("id").single();
    if (error?.code === "23505") return fail("Username is already taken.", 409);
    if (error || !data) throw error ?? new Error("Missing account result");
    const { error: pinError } = await supabase.from("pin_credentials")
      .insert({ user_id: data.id, pin_hash: pinHash });
    if (pinError) {
      const { error: cleanupError } = await supabase.from("accounts").delete().eq("id", data.id);
      if (cleanupError) console.error("Failed to clean up incomplete registration", cleanupError);
      throw pinError;
    }
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("Register:", err);
    return fail("Unable to create account.", 500);
  }
}
