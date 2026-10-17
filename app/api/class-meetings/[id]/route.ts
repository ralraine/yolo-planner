import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { devOnly, rejectWrongOrigin, jsonRequired, parseJsonObject, fail, uuidOk } from "@/lib/api-helpers";
import { parseMeeting, MEETING_FIELDS } from "@/lib/class-meeting-validation";
type Ctx = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const guard = devOnly() || rejectWrongOrigin(request) || jsonRequired(request); if (guard) return guard;
  const { id } = await params; if (!uuidOk(id)) return fail("Invalid meeting ID.");
  const body = await parseJsonObject(request); if (!body) return fail("Invalid JSON.");
  const parsed = parseMeeting(body); if (!parsed.value) return fail(parsed.error || "Invalid meeting.");
  try {
    const user = await getCurrentUser(); if (!user) return fail("Please sign in.", 401);
    const supabase = createAdminClient();
    const { data: subject, error: e1 } = await supabase.from("subjects").select("id")
      .eq("id", parsed.value.subject_id).eq("user_id", user.id).maybeSingle();
    if (e1) throw e1; if (!subject) return fail("Subject not found.");
    const { data, error } = await supabase.from("class_meetings")
      .update(parsed.value).eq("id", id).eq("user_id", user.id).select(MEETING_FIELDS).maybeSingle();
    if (error) throw error; if (!data) return fail("Class meeting not found.", 404);
    return NextResponse.json({ meeting: data });
  } catch (error) { console.error("PATCH meeting", error); return fail("Unable to update class meeting.", 500); }
}
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const guard = devOnly() || rejectWrongOrigin(request); if (guard) return guard;
  const { id } = await params; if (!uuidOk(id)) return fail("Invalid meeting ID.");
  try {
    const user = await getCurrentUser(); if (!user) return fail("Please sign in.", 401);
    const { data, error } = await createAdminClient().from("class_meetings")
      .delete().eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
    if (error) throw error; if (!data) return fail("Class meeting not found.", 404);
    return NextResponse.json({ success: true });
  } catch (error) { console.error("DELETE meeting", error); return fail("Unable to delete class meeting.", 500); }
}
