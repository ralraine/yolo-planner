import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { devOnly, rejectWrongOrigin, jsonRequired, parseJsonObject, fail } from "@/lib/api-helpers";
import { parseMeeting, MEETING_FIELDS } from "@/lib/class-meeting-validation";

export async function GET() {
  const guard = devOnly(); if (guard) return guard;
  try {
    const user = await getCurrentUser(); if (!user) return fail("Please sign in.", 401);
    const { data, error } = await createAdminClient().from("class_meetings")
      .select(MEETING_FIELDS).eq("user_id", user.id).order("weekday").order("start_time");
    if (error) throw error;
    return NextResponse.json({ meetings: data ?? [] });
  } catch (error) { console.error("GET meetings", error); return fail("Unable to load class schedule.", 500); }
}
export async function POST(request: NextRequest) {
  const guard = devOnly() || rejectWrongOrigin(request) || jsonRequired(request); if (guard) return guard;
  const body = await parseJsonObject(request); if (!body) return fail("Invalid JSON.");
  const parsed = parseMeeting(body); if (!parsed.value) return fail(parsed.error || "Invalid class meeting.");
  try {
    const user = await getCurrentUser(); if (!user) return fail("Please sign in.", 401);
    const supabase = createAdminClient();
    const { data: subject, error: subjectError } = await supabase.from("subjects").select("id")
      .eq("id", parsed.value.subject_id).eq("user_id", user.id).maybeSingle();
    if (subjectError) throw subjectError;
    if (!subject) return fail("Subject not found.");
    const { data, error } = await supabase.from("class_meetings")
      .insert({ ...parsed.value, user_id: user.id }).select(MEETING_FIELDS).single();
    if (error) throw error;
    return NextResponse.json({ meeting: data }, { status: 201 });
  } catch (error) { console.error("POST meeting", error); return fail("Unable to save class meeting.", 500); }
}
