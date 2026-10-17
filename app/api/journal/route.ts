import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { devOnly, rejectWrongOrigin, jsonRequired, parseJsonObject, fail } from "@/lib/api-helpers";

const datePattern = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !datePattern.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
const FIELDS = "id, entry_date, title, content, mood, updated_at";
export async function GET(request: NextRequest) {
  const guard = devOnly(); if (guard) return guard;
  const date = request.nextUrl.searchParams.get("date");
  if (!validDate(date)) return fail("Invalid journal date.");
  try {
    const user = await getCurrentUser(); if (!user) return fail("Please sign in.", 401);
    const { data, error } = await createAdminClient().from("journal_entries").select(FIELDS)
      .eq("user_id", user.id).eq("entry_date", date).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ entry: data ?? null });
  } catch (error) { console.error("GET journal", error); return fail("Unable to load journal.", 500); }
}
export async function PUT(request: NextRequest) {
  const guard = devOnly() || rejectWrongOrigin(request) || jsonRequired(request); if (guard) return guard;
  const body = await parseJsonObject(request); if (!body) return fail("Invalid JSON.");
  const { date, title, content, mood } = body;
  if (!validDate(date)) return fail("Invalid journal date.");
  if (typeof title !== "string" || title.length > 150 || typeof content !== "string" || content.length > 20000) return fail("Journal text is too long.");
  if (typeof mood !== "string" || !["great","good","neutral","low","rough"].includes(mood)) return fail("Invalid mood.");
  try {
    const user = await getCurrentUser(); if (!user) return fail("Please sign in.", 401);
    const { data, error } = await createAdminClient().from("journal_entries")
      .upsert({ user_id: user.id, entry_date: date, title: title.trim(), content, mood, updated_at: new Date().toISOString() },
        { onConflict: "user_id,entry_date" }).select(FIELDS).single();
    if (error) throw error;
    return NextResponse.json({ entry: data });
  } catch (error) { console.error("PUT journal", error); return fail("Unable to save journal.", 500); }
}
